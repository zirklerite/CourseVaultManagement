/**
 * Gitea Check Login
 * Shows students who have never signed into Gitea.
 *
 * Usage: node check_login.js <course_name>
 */

import { GITEA_URL, get_credentials } from './config.ts';
import { get_session, resolve_csv, parse_csv, validate_single_course } from './gitea_api.ts';

const NEVER_MARKERS = ['0001-01-01', '1970-01-01'];

function is_never_logged_in(last_login) {
  if (!last_login) return true;
  return NEVER_MARKERS.some(m => last_login.includes(m));
}

async function main(): Promise<void> {
  if (process.argv.length < 3) {
    console.log('Usage: node check_login.js <course_name>');
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

  const never_signed_in = [];

  for (const [, student_id] of entries) {
    const resp = await session.get(`${GITEA_URL}/api/v1/users/${student_id}`);
    if (resp.status !== 200) {
      console.log(`  FAIL: ${student_id} - student does not exist`);
      continue;
    }
    const user = await resp.json();
    const last_login = user.last_login || '';

    if (is_never_logged_in(last_login)) {
      console.log(`  NEVER: ${student_id}`);
      never_signed_in.push(student_id);
    } else {
      console.log(`  OK: ${student_id} (last login: ${last_login})`);
    }
  }

  console.log(`\nDone. Never signed in: ${never_signed_in.length}/${entries.length}`);
  if (never_signed_in.length) {
    console.log('\nStudents who never signed in:');
    for (const sid of never_signed_in) console.log(`  ${sid}`);
  }
}

main();
