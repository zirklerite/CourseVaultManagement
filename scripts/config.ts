/**
 * Shared configuration for Gitea automation scripts.
 * Reads from .env file if present, falls back to interactive prompt.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function load_env(): void {
  const env_path = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(env_path)) return;
  const content = fs.readFileSync(env_path, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

load_env();

export const GITEA_URL = (process.env.GITEA_URL || 'http://localhost:3000').replace(/\/+$/, '');

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

export async function get_credentials(): Promise<[string, string]> {
  let admin_user = process.env.GITEA_ADMIN_USER || '';
  let admin_pass = process.env.GITEA_ADMIN_PASS || '';

  if (!admin_user) {
    admin_user = await prompt('Enter Gitea admin username: ');
  } else {
    console.log(`Using admin user from .env: ${admin_user}`);
  }

  if (!admin_pass) {
    admin_pass = await prompt('Enter Gitea admin password: ');
  } else {
    console.log('Using admin password from .env.');
  }

  return [admin_user, admin_pass];
}
