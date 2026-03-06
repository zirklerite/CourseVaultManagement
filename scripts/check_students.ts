/**
 * Gitea Check Students
 * Verifies student accounts, course membership, and group placement.
 *
 * Usage: node check_students.js <course_name>
 */

import { GITEA_URL, get_credentials } from './config.ts';
import {
  get_session, get_user_orgs, resolve_csv, parse_csv, validate_single_course,
  get_org_teams_dict, is_team_member, get_team_repos,
} from './gitea_api.ts';

async function main(): Promise<void> {
  if (process.argv.length < 3) {
    console.log('Usage: node check_students.js <course_name>');
    process.exit(1);
  }

  const input_file = resolve_csv(process.argv[2]);
  let entries;
  try {
    entries = parse_csv(input_file);
  } catch {
    console.log(`Error: File '${input_file}' not found.`);
    process.exit(1);
  }

  if (!entries.length) {
    console.log('Error: No entries found in file.');
    process.exit(1);
  }

  const course_name = validate_single_course(entries);
  console.log(`Checking ${entries.length} student(s) in course '${course_name}'...`);
  const [admin_user, admin_pass] = await get_credentials();
  const session = get_session(admin_user, admin_pass);

  const all_course_teams = await get_org_teams_dict(session, course_name);
  const non_owner_teams = Object.fromEntries(Object.entries(all_course_teams).filter(([k]) => k !== 'Owners'));

  let ok = 0, issues = 0;

  for (const [, student_id, team_name] of entries) {
    const errors = [];

    const resp = await session.get(`${GITEA_URL}/api/v1/users/${student_id}`);
    if (resp.status !== 200) {
      console.log(`  FAIL: ${student_id} - student does not exist`);
      issues++;
      continue;
    }

    const user = await resp.json();
    if (user.visibility !== 'limited') errors.push(`visibility is '${user.visibility}', expected 'limited'`);
    if (!user.restricted) errors.push('not restricted');

    const user_orgs = await get_user_orgs(session, student_id);
    if (user_orgs === null) errors.push('could not fetch courses');
    else if (!user_orgs.includes(course_name)) errors.push(`not in course '${course_name}'`);

    if (team_name) {
      const team_data = all_course_teams[team_name];
      if (!team_data) {
        errors.push(`team '${team_name}' does not exist`);
      } else {
        const team_id = team_data.id;
        if (!(await is_team_member(session, team_id, student_id))) errors.push(`not in team '${team_name}'`);

        for (const [other_name, other_data] of Object.entries(non_owner_teams)) {
          if (other_name === team_name) continue;
          if (await is_team_member(session, other_data.id, student_id)) errors.push(`also in wrong team '${other_name}'`);
        }

        const team_repos = await get_team_repos(session, team_id);
        if (!team_repos.includes(team_name)) errors.push(`team has no matching repo '${team_name}'`);
        for (const r of team_repos) {
          if (r !== team_name) errors.push(`team has mismatched repo '${r}'`);
        }
      }
    }

    if (errors.length) {
      console.log(`  FAIL: ${student_id} - ${errors.join('; ')}`);
      issues++;
    } else {
      const label = team_name ? ` (course: ${course_name}, team: ${team_name})` : ` (course: ${course_name})`;
      console.log(`  OK: ${student_id}${label}`);
      ok++;
    }
  }

  console.log(`\nDone. OK: ${ok}, Issues: ${issues}`);
}

main();
