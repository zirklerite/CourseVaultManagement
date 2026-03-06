/**
 * Gitea Batch Create Repos
 * Creates repos (from a template or blank) and assigns them to teams within an existing course.
 *
 * Usage:
 *   node create_repos.js <course_name>
 *   node create_repos.js <course_name> <template_owner/template_repo>
 */

import { GITEA_URL, get_credentials } from './config.ts';
import {
  get_session, resolve_csv, parse_csv_teams,
  ensure_team, ensure_repo, create_blank_repo, get_all_teams,
  get_team_members, get_team_repos,
  add_team_member, remove_team_member, add_team_repo,
} from './gitea_api.ts';

async function main(): Promise<void> {
  if (process.argv.length < 3) {
    console.log('Usage: node create_repos.js <course_name> [template_owner/template_repo]');
    process.exit(1);
  }

  const csv_file = resolve_csv(process.argv[2]);
  let template_owner = null, template_repo = null;

  if (process.argv.length >= 4) {
    const template_path = process.argv[3];
    if (!template_path.includes('/')) {
      console.log("Error: Template must be in format 'owner/repo'.");
      process.exit(1);
    }
    [template_owner, template_repo] = template_path.split('/', 2);
  }

  let course_name, teams;
  try {
    [course_name, teams] = parse_csv_teams(csv_file);
  } catch {
    console.log(`Error: File '${csv_file}' not found.`);
    process.exit(1);
  }

  if (!course_name || !teams.size) {
    console.log('Error: No teams found in file. CSV must have: course_name student_id name team_name');
    process.exit(1);
  }

  console.log(`Course: ${course_name}`);
  if (template_owner) console.log(`Template: ${template_owner}/${template_repo}`);
  else console.log('Template: (none, creating blank repos)');
  console.log(`Found ${teams.size} team(s):`);
  for (const [name, members] of teams) console.log(`  ${name}: ${members.join(', ')}`);

  const [admin_user, admin_pass] = await get_credentials();
  const session = get_session(admin_user, admin_pass);

  console.log(`\n=== Course: ${course_name} ===`);
  const resp = await session.get(`${GITEA_URL}/api/v1/orgs/${course_name}`);
  if (resp.status !== 200) {
    console.log(`Error: Course '${course_name}' does not exist.`);
    console.log(`  Create it first: node create_course.js ${course_name}`);
    process.exit(1);
  }
  const org = await resp.json();
  if (org.visibility !== 'private') console.log(`  WARN: Course visibility is '${org.visibility}', expected 'private'.`);
  else console.log(`  OK: Course '${course_name}' exists (private).`);

  const other_teams = await get_all_teams(session, course_name);

  for (const [team_name, members] of teams) {
    const repo_name = team_name;
    console.log(`\n--- Team: ${team_name} ---`);

    const [result, team_data] = await ensure_team(session, course_name, team_name);
    if (result === 'created' || result === 'exists') {
      const team_id = team_data.id;
      const label = result === 'created' ? 'created' : 'exists (verified)';
      console.log(`  OK: Team '${team_name}' ${label} (ID: ${team_id}).`);

      if (result === 'exists') {
        const existing_repos = await get_team_repos(session, team_id);
        for (const r of existing_repos) {
          if (r !== team_name) console.log(`  WARN: Team '${team_name}' has mismatched repo '${r}'.`);
        }
      }

      if (template_owner) {
        const [rr, rd] = await ensure_repo(session, template_owner, template_repo, course_name, repo_name);
        if (rr === 'created') console.log(`  OK: Repo '${course_name}/${repo_name}' created from template.`);
        else if (rr === 'exists') console.log(`  OK: Repo '${course_name}/${repo_name}' already exists (verified private).`);
        else { console.log(`  FAIL: Could not create/get repo: ${rd}`); continue; }
      } else {
        const check = await session.get(`${GITEA_URL}/api/v1/repos/${course_name}/${repo_name}`);
        if (check.status === 200) {
          console.log(`  OK: Repo '${course_name}/${repo_name}' already exists.`);
        } else {
          const [rr, rd] = await create_blank_repo(session, course_name, repo_name);
          if (rr === 'created') console.log(`  OK: Repo '${course_name}/${repo_name}' created (blank).`);
          else { console.log(`  FAIL: Could not create repo: ${rd}`); continue; }
        }
      }

      const [as, ab] = await add_team_repo(session, team_id, course_name, repo_name);
      if (as === 204) console.log(`  OK: Repo '${repo_name}' assigned to team.`);
      else console.log(`  WARN: Assign repo to team (HTTP ${as}) ${ab}`);

      for (const student_id of members) {
        for (const t of other_teams) {
          if (t.name === team_name) continue;
          const tm = await get_team_members(session, t.id);
          if (tm.includes(student_id)) {
            const [rs] = await remove_team_member(session, t.id, student_id);
            if (rs === 204) console.log(`  FIXED: Removed ${student_id} from wrong team '${t.name}'.`);
            else console.log(`  WARN: Could not remove ${student_id} from team '${t.name}'.`);
          }
        }
        const [ms, mb] = await add_team_member(session, team_id, student_id);
        if (ms === 204) console.log(`  OK: ${student_id} added to team.`);
        else console.log(`  WARN: ${student_id} (HTTP ${ms}) ${mb}`);
      }
    } else {
      console.log(`  FAIL: Could not create/get team: ${team_data}`);
    }
  }

  console.log('\nDone.');
}

main();
