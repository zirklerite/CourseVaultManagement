/**
 * Gitea Check Course
 * Displays course details including visibility, teams, repos, and students.
 *
 * Usage: node check_course.js <course_name>
 */

import { GITEA_URL, get_credentials } from './config.ts';
import { get_session, get_org_repos, get_all_teams, get_team_members, get_team_repos } from './gitea_api.ts';

async function main(): Promise<void> {
  if (process.argv.length < 3) {
    console.log('Usage: node check_course.js <course_name>');
    process.exit(1);
  }

  const course_name = process.argv[2];
  const [admin_user, admin_pass] = await get_credentials();
  const session = get_session(admin_user, admin_pass);

  const resp = await session.get(`${GITEA_URL}/api/v1/orgs/${course_name}`);
  if (resp.status !== 200) {
    console.log(`Error: Course '${course_name}' not found.`);
    process.exit(1);
  }
  const org = await resp.json();

  console.log(`Course: ${course_name}`);
  console.log(`  Visibility: ${org.visibility || 'unknown'}`);
  console.log(`  Description: ${org.description || '(none)'}`);

  const repos = await get_org_repos(session, course_name);
  const repo_names = new Set(repos.map(r => r.name));
  console.log(`\nRepos (${repos.length}):`);
  if (repos.length) {
    for (const repo of repos) {
      console.log(`  ${repo.name} (${repo.private ? 'private' : 'public'})`);
    }
  } else {
    console.log('  (none)');
  }

  const teams = await get_all_teams(session, course_name, true);
  console.log(`\nTeams (${teams.length}):`);
  for (const team of teams) {
    const includes_all = team.includes_all_repositories ? 'all repos' : 'specific repos';
    const units = team.units_map || {};
    const perms = Object.entries(units).map(([u, p]) => `${u.split('.').pop()}:${p}`).join(', ');
    const is_owners = team.name === 'Owners';

    if (!is_owners && !repo_names.has(team.name)) {
      console.log(`  ${team.name} (ID: ${team.id}, ${includes_all}, ${perms}) WARN: no matching repo`);
    } else {
      console.log(`  ${team.name} (ID: ${team.id}, ${includes_all}, ${perms})`);
    }

    const team_repos = await get_team_repos(session, team.id);
    if (team_repos.length) {
      for (const r of team_repos) {
        if (!is_owners && r !== team.name) console.log(`    Repo: ${r} WARN: name mismatch with team`);
        else console.log(`    Repo: ${r}`);
      }
    } else {
      if (!is_owners) console.log('    Repos: (none) WARN: no repo assigned');
      else console.log('    Repos: (none)');
    }

    const members = await get_team_members(session, team.id);
    if (members.length) {
      for (const m of members) console.log(`    Student: ${m}`);
    } else {
      console.log('    Students: (none)');
    }
  }
}

main();
