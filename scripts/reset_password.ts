/**
 * Gitea Reset Student Password
 * Resets a student's password to the default (reversed student ID).
 *
 * Usage: node reset_password.js <course_name> <student_id>
 */

import { GITEA_URL, get_credentials } from './config.ts';
import { get_session, resolve_csv, parse_csv, validate_single_course } from './gitea_api.ts';

async function reset_password(session, student_id) {
  const resp = await session.get(`${GITEA_URL}/api/v1/users/${student_id}`);
  if (resp.status !== 200) return ['not_found', `User '${student_id}' not found.`];

  const user = await resp.json();
  const new_password = student_id.split('').reverse().join('');

  const patch = await session.patch(`${GITEA_URL}/api/v1/admin/users/${student_id}`, {
    login_name: student_id,
    source_id: user.source_id || 0,
    password: new_password,
    must_change_password: true,
  });
  if (patch.status === 200) return ['ok', new_password];
  return ['error', `HTTP ${patch.status}: ${await patch.text()}`];
}

async function main(): Promise<void> {
  if (process.argv.length < 4) {
    console.log('Usage: node reset_password.js <course_name> <student_id>');
    process.exit(1);
  }

  const course_name_arg = process.argv[2];
  const student_id_arg = process.argv[3];
  const input_file = resolve_csv(course_name_arg);

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

  validate_single_course(entries);

  if (!entries.some(([, sid]) => sid === student_id_arg)) {
    console.log(`Error: Student '${student_id_arg}' not found in '${input_file}'.`);
    process.exit(1);
  }

  const [admin_user, admin_pass] = await get_credentials();
  const session = get_session(admin_user, admin_pass);

  const [result, detail] = await reset_password(session, student_id_arg);
  if (result === 'ok') console.log(`  OK: ${student_id_arg} password reset (must change on next login).`);
  else console.log(`  FAIL: ${student_id_arg} - ${detail}`);
}

main();
