/**
 * Gitea List Courses
 * Lists all courses (organizations) visible to the authenticated user.
 *
 * Usage: node list_courses.js
 */

import { GITEA_URL, get_credentials } from './config.ts';
import { get_session } from './gitea_api.ts';

async function main(): Promise<void> {
  const [admin_user, admin_pass] = await get_credentials();
  const session = get_session(admin_user, admin_pass);

  const courses = [];
  let page = 1;
  while (true) {
    let resp = await session.get(`${GITEA_URL}/api/v1/admin/orgs`, { page, limit: 50 });
    if (resp.status !== 200) {
      resp = await session.get(`${GITEA_URL}/api/v1/user/orgs`, { page, limit: 50 });
      if (resp.status !== 200) {
        console.log(`Error: Could not list courses (HTTP ${resp.status})`);
        break;
      }
    }
    const data = await resp.json();
    if (!data.length) break;
    courses.push(...data);
    page++;
  }

  if (!courses.length) {
    console.log('No courses found.');
    return;
  }

  console.log(`Courses (${courses.length}):\n`);
  for (const course of courses) {
    const vis = course.visibility || 'unknown';
    const desc = course.description || '';
    console.log(`  ${course.username} (${vis})${desc ? '  ' + desc : ''}`);
  }
}

main();
