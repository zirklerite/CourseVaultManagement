/**
 * Gitea Check Commits
 * Shows teams where no non-admin commit has been made to the team repo yet.
 *
 * Usage:
 *   node check_commits.js <course_name> [team_name]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GITEA_URL, get_credentials } from './config.ts';
import { get_session, get_all_teams, get_team_members, get_team_repos } from './gitea_api.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.dirname(__dirname);

function load_aliases(course_name) {
  const aliases_file = path.join(PROJECT_DIR, 'courses', `${course_name}.aliases.csv`);
  const aliases = {};
  if (!fs.existsSync(aliases_file)) return aliases;
  const content = fs.readFileSync(aliases_file, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) aliases[parts[0].toLowerCase()] = parts[1].toLowerCase();
  }
  if (Object.keys(aliases).length) console.log(`Loaded ${Object.keys(aliases).length} alias(es) from ${course_name}.aliases.csv.`);
  return aliases;
}

async function get_repo_commits(session, owner, repo) {
  const all_commits = [];
  let page = 1;
  while (true) {
    const resp = await session.get(`${GITEA_URL}/api/v1/repos/${owner}/${repo}/commits`, { page, limit: 50 });
    if (resp.status !== 200) return null;
    const commits = await resp.json();
    if (!commits.length) break;
    all_commits.push(...commits);
    page++;
  }
  return all_commits;
}

function analyze_commits(commits, admin_logins, admin_emails, student_logins, course_name, aliases) {
  let non_admin_count = 0;
  const unknown_authors = new Set();

  for (const c of commits) {
    const git_name = c.commit?.author?.name || '';
    const git_email = (c.commit?.author?.email || '').toLowerCase();

    if (git_name === course_name) continue;

    const author = c.author;
    if (author?.login) {
      const login = author.login.toLowerCase();
      if (admin_logins.has(login)) continue;
      non_admin_count++;
      if (!student_logins.has(login)) unknown_authors.add(`${git_name} <${git_email}> (gitea: ${author.login})`);
      continue;
    }

    if (git_email in aliases) {
      const alias_sid = aliases[git_email];
      if (admin_logins.has(alias_sid)) continue;
      non_admin_count++;
      if (!student_logins.has(alias_sid)) unknown_authors.add(`${git_name} <${git_email}> (alias: ${alias_sid})`);
      continue;
    }

    if (!admin_emails.has(git_email)) {
      non_admin_count++;
      unknown_authors.add(`${git_name} <${git_email}>`);
    }
  }

  return [non_admin_count, unknown_authors];
}

async function main(): Promise<void> {
  if (process.argv.length < 3) {
    console.log('Usage: node check_commits.js <course_name> [team_name]');
    process.exit(1);
  }

  const course_name = process.argv[2];
  const filter_team = process.argv[3] || null;
  const aliases = load_aliases(course_name);
  const [admin_user, admin_pass] = await get_credentials();
  const session = get_session(admin_user, admin_pass);

  const resp = await session.get(`${GITEA_URL}/api/v1/orgs/${course_name}`);
  if (resp.status !== 200) {
    console.log(`Error: Course '${course_name}' not found.`);
    process.exit(1);
  }

  const owner_teams = (await get_all_teams(session, course_name, true)).filter(t => t.name === 'Owners');
  const admin_logins = new Set();
  const admin_emails = new Set();
  if (owner_teams.length) {
    for (const m of await get_team_members(session, owner_teams[0].id)) {
      admin_logins.add(m.toLowerCase());
      const r = await session.get(`${GITEA_URL}/api/v1/users/${m}`);
      if (r.status === 200) {
        const u = await r.json();
        if (u.email) admin_emails.add(u.email.toLowerCase());
      }
    }
  }

  let teams = await get_all_teams(session, course_name);
  if (filter_team) {
    teams = teams.filter(t => t.name === filter_team);
    if (!teams.length) {
      console.log(`Error: Team '${filter_team}' not found in '${course_name}'.`);
      process.exit(1);
    }
  }

  if (!teams.length) {
    console.log(`No teams found in '${course_name}' (excluding Owners).`);
    return;
  }

  console.log(`Checking ${teams.length} team(s) in course '${course_name}'...`);

  const no_commits = [];
  const all_unknown = [];

  for (const team of teams) {
    const members = await get_team_members(session, team.id);
    const repos = await get_team_repos(session, team.id);

    if (!repos.length) {
      console.log(`  SKIP: ${team.name} - no repo assigned`);
      continue;
    }

    const student_logins = new Set(members.map(m => m.toLowerCase()));

    for (const repo_name of repos) {
      const commits = await get_repo_commits(session, course_name, repo_name);
      if (commits === null) {
        console.log(`  FAIL: ${team.name} - could not read repo '${course_name}/${repo_name}'`);
        continue;
      }

      const [non_admin, unknown] = analyze_commits(commits, admin_logins, admin_emails, student_logins, course_name, aliases);
      if (non_admin > 0) {
        console.log(`  OK: ${team.name}/${repo_name} (${non_admin} non-admin commit(s) out of ${commits.length})`);
      } else {
        console.log(`  NO COMMITS: ${team.name}/${repo_name} (${commits.length} commit(s), all from admin)`);
        no_commits.push(team.name);
      }
      for (const author of unknown) all_unknown.push([team.name, repo_name, author]);
    }
  }

  console.log(`\nDone. Teams with no student commits: ${no_commits.length}/${teams.length}`);
  if (no_commits.length) {
    console.log('\nTeams with no student commits:');
    for (const name of no_commits) console.log(`  ${name}`);
  }

  if (all_unknown.length) {
    console.log('\nUnknown git authors (not linked to any team student account):');
    let current_team = null;
    for (const [team_name, repo_name, author] of all_unknown.sort()) {
      if (team_name !== current_team) {
        current_team = team_name;
        console.log(`  ${team_name}/${repo_name}:`);
      }
      console.log(`    ${author}`);
    }
  }
}

main();
