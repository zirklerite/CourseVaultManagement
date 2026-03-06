/**
 * Gitea Batch Add Students
 * Creates Gitea accounts with reversed ID as default password.
 *
 * Usage: node add_students.js <course_name>
 */

import { GITEA_URL, get_credentials } from './config.ts';
import {
  get_session, user_exists, resolve_csv, parse_csv, validate_single_course,
  ensure_team, get_all_teams, get_team_members,
  add_team_member, remove_team_member,
} from './gitea_api.ts';

async function create_user(session, student_id, password) {
  const resp = await session.post(`${GITEA_URL}/api/v1/admin/users`, {
    username: student_id,
    password,
    email: `${student_id}@mail.shu.edu.tw`,
    must_change_password: true,
    visibility: 'limited',
    restricted: true,
  });
  return [resp.status, await resp.text()];
}

async function main(): Promise<void> {
  if (process.argv.length < 3) {
    console.log('Usage: node add_students.js <course_name>');
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
    console.log('Error: No student IDs found in file.');
    process.exit(1);
  }

  const course_name = validate_single_course(entries);
  console.log(`Found ${entries.length} student(s) in course '${course_name}'.`);
  const [admin_user, admin_pass] = await get_credentials();
  const session = get_session(admin_user, admin_pass);

  const has_teams = entries.some(([, , team]) => team);
  if (has_teams) {
    const resp = await session.get(`${GITEA_URL}/api/v1/orgs/${course_name}`);
    if (resp.status !== 200) {
      console.log(`Error: Course '${course_name}' does not exist.`);
      console.log(`  Create it first: node create_course.js ${course_name}`);
      process.exit(1);
    }
  }

  const other_teams = has_teams ? await get_all_teams(session, course_name) : [];
  let created = 0, skipped = 0, failed = 0;
  const team_cache = {};

  for (const [, student_id, team_name] of entries) {
    if (await user_exists(session, student_id)) {
      console.log(`  SKIP: ${student_id} already exists.`);
      skipped++;

      const resp = await session.get(`${GITEA_URL}/api/v1/users/${student_id}`);
      if (resp.status === 200) {
        const user = await resp.json();
        const fixes = {};
        if (user.visibility !== 'limited') fixes.visibility = 'limited';
        if (!user.restricted) fixes.restricted = true;
        if (Object.keys(fixes).length) {
          fixes.login_name = student_id;
          fixes.source_id = user.source_id || 0;
          const patch = await session.patch(`${GITEA_URL}/api/v1/admin/users/${student_id}`, fixes);
          if (patch.status === 200) {
            delete fixes.login_name;
            delete fixes.source_id;
            console.log(`    FIXED: ${Object.entries(fixes).map(([k, v]) => `${k}=${v}`).join(', ')}`);
          } else {
            console.log(`    WARN: Could not update user settings (HTTP ${patch.status}) ${await patch.text()}`);
          }
        }
      }
    } else {
      const password = student_id.split('').reverse().join('');
      const [status, body] = await create_user(session, student_id, password);
      if (status === 201) {
        console.log(`  OK: ${student_id} created.`);
        created++;
      } else {
        console.log(`  FAIL: ${student_id} (HTTP ${status}) ${body}`);
        failed++;
        continue;
      }
    }

    if (team_name) {
      if (!(team_name in team_cache)) {
        const [result, data] = await ensure_team(session, course_name, team_name);
        if (result === 'created' || result === 'exists') {
          team_cache[team_name] = data.id;
          console.log(`    Team '${course_name}/${team_name}' ${result} (ID: ${data.id}).`);
        } else {
          console.log(`    FAIL: Could not create/get team '${team_name}': ${data}`);
          continue;
        }
      }

      const team_id = team_cache[team_name];

      for (const t of other_teams) {
        if (t.name === team_name) continue;
        const members = await get_team_members(session, t.id);
        if (members.includes(student_id)) {
          const [status] = await remove_team_member(session, t.id, student_id);
          if (status === 204) console.log(`    FIXED: Removed ${student_id} from wrong team '${t.name}'.`);
          else console.log(`    WARN: Could not remove ${student_id} from team '${t.name}'.`);
        }
      }

      const [status] = await add_team_member(session, team_id, student_id);
      if (status === 204) console.log(`    OK: ${student_id} added to team '${team_name}'.`);
      else console.log(`    WARN: Could not add ${student_id} to team '${team_name}'.`);
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`);
}

main();
