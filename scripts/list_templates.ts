/**
 * Gitea List Templates
 * Lists all template repos accessible to the admin user.
 *
 * Usage: node list_templates.js
 */

import { GITEA_URL, get_credentials } from './config.ts';
import { get_session } from './gitea_api.ts';

async function main(): Promise<void> {
  const [admin_user, admin_pass] = await get_credentials();
  const session = get_session(admin_user, admin_pass);

  const all_templates = [];
  let page = 1;
  while (true) {
    const resp = await session.get(`${GITEA_URL}/api/v1/repos/search`, { template: true, page, limit: 50 });
    if (resp.status !== 200) {
      console.log(`Error: Could not search repos (HTTP ${resp.status})`);
      process.exit(1);
    }
    const json = await resp.json();
    const data = json.data || [];
    if (!data.length) break;
    all_templates.push(...data);
    page++;
  }

  if (!all_templates.length) {
    console.log('No template repos found.');
    return;
  }

  console.log(`Found ${all_templates.length} template(s):\n`);
  for (const repo of all_templates) {
    const owner = repo.owner.login;
    console.log(`  ${owner}/${repo.name}`);
    if (repo.description) console.log(`    ${repo.description}`);
  }
  console.log(`\nUsage: node create_repos.js <course_name> <owner/template>`);
}

main();
