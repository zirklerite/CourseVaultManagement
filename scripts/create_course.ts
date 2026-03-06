/**
 * Gitea Create Course
 * Creates a private organization for a course.
 *
 * Usage: node create_course.js <course_name>
 */

import { GITEA_URL, get_credentials } from './config.ts';
import { get_session } from './gitea_api.ts';

async function main(): Promise<void> {
  if (process.argv.length < 3) {
    console.log('Usage: node create_course.js <course_name>');
    process.exit(1);
  }

  const course_name = process.argv[2];
  const [admin_user, admin_pass] = await get_credentials();
  const session = get_session(admin_user, admin_pass);

  const resp = await session.get(`${GITEA_URL}/api/v1/orgs/${course_name}`);
  if (resp.status === 200) {
    const org = await resp.json();
    console.log(`Course '${course_name}' already exists.`);
    if (org.visibility !== 'private') {
      const patch = await session.patch(`${GITEA_URL}/api/v1/orgs/${course_name}`, { visibility: 'private' });
      if (patch.status === 200) console.log('  FIXED: Visibility set to private.');
      else console.log(`  WARN: Could not update visibility (HTTP ${patch.status})`);
    } else {
      console.log('  Visibility: private (OK)');
    }
    process.exit(0);
  }

  const create = await session.post(`${GITEA_URL}/api/v1/orgs`, { username: course_name, visibility: 'private' });
  if (create.status === 201) {
    const org = await create.json();
    const vis = org.visibility || 'unknown';
    console.log(`OK: Course '${course_name}' created.`);
    console.log(`  Visibility: ${vis}${vis === 'private' ? ' (OK)' : ' (WARN: expected private)'}`);
  } else {
    console.log(`FAIL: Could not create course (HTTP ${create.status}) ${await create.text()}`);
    process.exit(1);
  }
}

main();
