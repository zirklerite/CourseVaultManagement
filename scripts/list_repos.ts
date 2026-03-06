/**
 * Gitea List Repos under a Course
 *
 * Usage: node list_repos.js <course_name>
 */

import { get_credentials } from './config.ts';
import { get_session, get_org_repos } from './gitea_api.ts';

async function main(): Promise<void> {
  if (process.argv.length < 3) {
    console.log('Usage: node list_repos.js <course_name>');
    process.exit(1);
  }

  const course_name = process.argv[2];
  const [admin_user, admin_pass] = await get_credentials();
  const session = get_session(admin_user, admin_pass);

  const repos = await get_org_repos(session, course_name);

  if (!repos.length) {
    console.log(`No repos found in '${course_name}'.`);
    return;
  }

  console.log(`Course: ${course_name} (${repos.length} repos)\n`);
  for (const repo of repos) {
    console.log(`  ${repo.name}`);
    console.log(`    URL:   ${repo.html_url}`);
    console.log(`    Clone: ${repo.clone_url}`);
    console.log(`    Private: ${repo.private}`);
    console.log();
  }
}

main();
