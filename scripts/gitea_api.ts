/**
 * Shared Gitea API helper functions used by multiple scripts.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GITEA_URL } from './config.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_DIR = path.dirname(__dirname);
export const COURSES_DIR = path.join(PROJECT_DIR, 'courses');

export type CsvEntry = [string, string, string | null]; // [course_name, student_id, team_name]

export interface Session {
  admin_user: string;
  admin_pass: string;
  get(url: string, params?: Record<string, unknown>): Promise<Response>;
  post(url: string, body?: unknown): Promise<Response>;
  put(url: string, body?: unknown): Promise<Response>;
  patch(url: string, body?: unknown): Promise<Response>;
  delete(url: string): Promise<Response>;
}

interface ApiOpts {
  admin_user: string;
  admin_pass: string;
  body?: unknown;
  params?: Record<string, unknown>;
}

function auth_headers(admin_user: string, admin_pass: string): Record<string, string> {
  return { Authorization: 'Basic ' + Buffer.from(`${admin_user}:${admin_pass}`).toString('base64') };
}

async function api(method: string, url: string, opts: ApiOpts): Promise<Response> {
  const u = new URL(url, GITEA_URL);
  if (opts.params) for (const [k, v] of Object.entries(opts.params)) u.searchParams.set(k, String(v));
  const fetchOpts: RequestInit = {
    method,
    headers: { ...auth_headers(opts.admin_user, opts.admin_pass), 'Content-Type': 'application/json' },
  };
  if (opts.body) fetchOpts.body = JSON.stringify(opts.body);
  return fetch(u.href, fetchOpts);
}

export function get_session(admin_user: string, admin_pass: string): Session {
  const creds = { admin_user, admin_pass };
  return {
    ...creds,
    get: (url, params) => api('GET', url, { ...creds, params }),
    post: (url, body) => api('POST', url, { ...creds, body }),
    put: (url, body) => api('PUT', url, { ...creds, body }),
    patch: (url, body) => api('PATCH', url, { ...creds, body }),
    delete: (url) => api('DELETE', url, creds),
  };
}

export async function user_exists(session: Session, username: string): Promise<boolean> {
  const resp = await session.get(`${GITEA_URL}/api/v1/users/${username}`);
  return resp.status === 200;
}

export async function get_user_orgs(session: Session, username: string): Promise<string[] | null> {
  const orgs: string[] = [];
  let page = 1;
  while (true) {
    const resp = await session.get(`${GITEA_URL}/api/v1/users/${username}/orgs`, { page, limit: 50 });
    if (resp.status !== 200) return null;
    const data = await resp.json();
    if (!data.length) break;
    orgs.push(...data.map((o: { username: string }) => o.username));
    page++;
  }
  return orgs;
}

// --- Teams ---

export async function find_team(session: Session, course_name: string, team_name: string): Promise<Record<string, unknown> | null> {
  let page = 1;
  while (true) {
    const resp = await session.get(`${GITEA_URL}/api/v1/orgs/${course_name}/teams`, { page, limit: 50 });
    if (resp.status !== 200) return null;
    const teams = await resp.json();
    if (!teams.length) return null;
    const found = teams.find((t: { name: string }) => t.name === team_name);
    if (found) return found;
    page++;
  }
}

export async function get_all_teams(session: Session, course_name: string, include_owners = false): Promise<Record<string, unknown>[]> {
  const teams: Record<string, unknown>[] = [];
  let page = 1;
  while (true) {
    const resp = await session.get(`${GITEA_URL}/api/v1/orgs/${course_name}/teams`, { page, limit: 50 });
    if (resp.status !== 200) break;
    const data = await resp.json();
    if (!data.length) break;
    for (const t of data) {
      if (include_owners || t.name !== 'Owners') teams.push(t);
    }
    page++;
  }
  return teams;
}

export async function get_org_teams_dict(session: Session, course_name: string): Promise<Record<string, Record<string, unknown>>> {
  const teams: Record<string, Record<string, unknown>> = {};
  let page = 1;
  while (true) {
    const resp = await session.get(`${GITEA_URL}/api/v1/orgs/${course_name}/teams`, { page, limit: 50 });
    if (resp.status !== 200) return teams;
    const data = await resp.json();
    if (!data.length) break;
    for (const t of data) teams[t.name as string] = t;
    page++;
  }
  return teams;
}

export async function ensure_team(session: Session, course_name: string, team_name: string, permission = 'write'): Promise<[string, unknown]> {
  const expected_units = ['repo.code', 'repo.issues', 'repo.pulls'];

  const resp = await session.post(`${GITEA_URL}/api/v1/orgs/${course_name}/teams`, {
    name: team_name, permission, includes_all_repositories: false, units: expected_units,
  });
  if (resp.status === 201) return ['created', await resp.json()];

  const team = await find_team(session, course_name, team_name) as Record<string, unknown> | null;
  if (!team) return ['error', await resp.text()];

  const issues: string[] = [];
  if (team.permission !== permission) issues.push(`permission: ${team.permission} -> ${permission}`);
  if (team.includes_all_repositories) issues.push('includes_all_repositories: true -> false');
  const current_units = ((team.units as string[]) || []).slice().sort();
  if (JSON.stringify(current_units) !== JSON.stringify(expected_units.slice().sort())) {
    issues.push(`units: ${JSON.stringify(current_units)} -> ${JSON.stringify(expected_units.slice().sort())}`);
  }

  if (issues.length) {
    const patch = await session.patch(`${GITEA_URL}/api/v1/teams/${team.id}`, {
      permission, includes_all_repositories: false, units: expected_units,
    });
    if (patch.status === 200) {
      console.log(`  FIXED: Team settings updated (${issues.join(', ')}).`);
      return ['exists', await patch.json()];
    } else {
      console.log(`  WARN: Could not update team settings (HTTP ${patch.status})`);
    }
  }

  return ['exists', team];
}

export async function get_team_members(session: Session, team_id: number): Promise<string[]> {
  const members: string[] = [];
  let page = 1;
  while (true) {
    const resp = await session.get(`${GITEA_URL}/api/v1/teams/${team_id}/members`, { page, limit: 50 });
    if (resp.status !== 200) break;
    const data = await resp.json();
    if (!data.length) break;
    members.push(...data.map((m: { login: string }) => m.login));
    page++;
  }
  return members;
}

export async function get_team_repos(session: Session, team_id: number): Promise<string[]> {
  const repos: string[] = [];
  let page = 1;
  while (true) {
    const resp = await session.get(`${GITEA_URL}/api/v1/teams/${team_id}/repos`, { page, limit: 50 });
    if (resp.status !== 200) break;
    const data = await resp.json();
    if (!data.length) break;
    repos.push(...data.map((r: { name: string }) => r.name));
    page++;
  }
  return repos;
}

export async function is_team_member(session: Session, team_id: number, username: string): Promise<boolean> {
  const resp = await session.get(`${GITEA_URL}/api/v1/teams/${team_id}/members/${username}`);
  return resp.status === 200;
}

export async function add_team_member(session: Session, team_id: number, username: string): Promise<[number, string]> {
  const resp = await session.put(`${GITEA_URL}/api/v1/teams/${team_id}/members/${username}`);
  return [resp.status, await resp.text()];
}

export async function remove_team_member(session: Session, team_id: number, username: string): Promise<[number, string]> {
  const resp = await session.delete(`${GITEA_URL}/api/v1/teams/${team_id}/members/${username}`);
  return [resp.status, await resp.text()];
}

export async function add_team_repo(session: Session, team_id: number, course_name: string, repo_name: string): Promise<[number, string]> {
  const resp = await session.put(`${GITEA_URL}/api/v1/teams/${team_id}/repos/${course_name}/${repo_name}`);
  return [resp.status, await resp.text()];
}

// --- Repos ---

export async function create_blank_repo(session: Session, owner: string, repo_name: string): Promise<[string, unknown]> {
  const resp = await session.post(`${GITEA_URL}/api/v1/orgs/${owner}/repos`, {
    name: repo_name, private: true, auto_init: true,
  });
  if (resp.status === 201) return ['created', await resp.json()];
  return ['error', await resp.text()];
}

export async function ensure_repo(session: Session, template_owner: string, template_repo: string, new_owner: string, new_repo: string): Promise<[string, unknown]> {
  const resp = await session.get(`${GITEA_URL}/api/v1/repos/${new_owner}/${new_repo}`);
  if (resp.status === 200) {
    const repo = await resp.json();
    if (!repo.private) {
      const patch = await session.patch(`${GITEA_URL}/api/v1/repos/${new_owner}/${new_repo}`, { private: true });
      if (patch.status === 200) console.log(`  FIXED: Repo '${new_owner}/${new_repo}' set to private.`);
      else console.log(`  WARN: Could not set repo to private (HTTP ${patch.status})`);
    }
    return ['exists', repo];
  }
  const gen = await session.post(`${GITEA_URL}/api/v1/repos/${template_owner}/${template_repo}/generate`, {
    owner: new_owner, name: new_repo, private: true, git_content: true, topics: true, labels: true,
  });
  if (gen.status === 201) return ['created', await gen.json()];
  return ['error', await gen.text()];
}

export async function get_org_repos(session: Session, course_name: string): Promise<Record<string, unknown>[]> {
  const repos: Record<string, unknown>[] = [];
  let page = 1;
  while (true) {
    const resp = await session.get(`${GITEA_URL}/api/v1/orgs/${course_name}/repos`, { page, limit: 50 });
    if (resp.status !== 200) break;
    const data = await resp.json();
    if (!data.length) break;
    repos.push(...data);
    page++;
  }
  return repos;
}

// --- CSV file resolution ---

export function resolve_csv(course_name: string): string {
  return path.join(COURSES_DIR, `${course_name}.csv`);
}

export function parse_csv(file_path: string): CsvEntry[] {
  const content = fs.readFileSync(file_path, 'utf-8');
  const entries: CsvEntry[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    entries.push([parts[0], parts[1], parts.length >= 4 ? parts[3] : null]);
  }
  return entries;
}

export function parse_csv_teams(file_path: string): [string | null, Map<string, string[]>] {
  const content = fs.readFileSync(file_path, 'utf-8');
  const course_names = new Set<string>();
  const teams = new Map<string, string[]>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) continue;
    course_names.add(parts[0]);
    if (!teams.has(parts[3])) teams.set(parts[3], []);
    teams.get(parts[3])!.push(parts[1]);
  }

  if (course_names.size > 1) {
    console.log(`Error: Multiple courses found in CSV: ${[...course_names].sort().join(', ')}`);
    console.log('  All rows must belong to the same course.');
    process.exit(1);
  }

  if (!course_names.size) return [null, teams];
  return [[...course_names][0], teams];
}

export function validate_single_course(entries: CsvEntry[]): string {
  const course_names = new Set(entries.map(([c]) => c));
  if (course_names.size > 1) {
    console.log(`Error: Multiple courses found in CSV: ${[...course_names].sort().join(', ')}`);
    console.log('  All rows must belong to the same course.');
    process.exit(1);
  }
  return [...course_names][0];
}
