/**
 * Gitea API client for browser — uses import.meta.env.VITE_GITEA_* credentials.
 */

// In dev, use Vite proxy (/gitea) to avoid CORS. In production, call Gitea directly.
const GITEA_URL = import.meta.env.DEV
  ? '/gitea'
  : (import.meta.env.VITE_GITEA_URL || 'http://localhost:3000').replace(/\/+$/, '');
const ADMIN_USER = import.meta.env.VITE_GITEA_ADMIN_USER || '';
const ADMIN_PASS = import.meta.env.VITE_GITEA_ADMIN_PASS || '';

const NEVER_MARKERS = ['0001-01-01', '1970-01-01'];

export interface LoginStatus {
  logged_in: boolean;
  last_login: string | null;
  exists: boolean;
}

interface GiteaUser {
  login: string;
  last_login?: string;
  [key: string]: unknown;
}

function auth_headers(): Record<string, string> {
  return {
    Authorization: 'Basic ' + btoa(`${ADMIN_USER}:${ADMIN_PASS}`),
    'ngrok-skip-browser-warning': '1',
  };
}

export async function fetch_all_users(): Promise<Record<string, GiteaUser>> {
  if (!ADMIN_USER || !ADMIN_PASS) return {};
  const users: Record<string, GiteaUser> = {};
  let page = 1;
  while (true) {
    try {
      const resp = await fetch(
        `${GITEA_URL}/api/v1/admin/users?page=${page}&limit=50`,
        { headers: auth_headers() },
      );
      if (!resp.ok) break;
      const data: GiteaUser[] = await resp.json();
      if (!data.length) break;
      for (const user of data) users[user.login] = user;
      page++;
    } catch {
      break;
    }
  }
  return users;
}

export async function get_login_status(student_ids: string[]): Promise<Record<string, LoginStatus>> {
  const all_users = await fetch_all_users();
  const status: Record<string, LoginStatus> = {};
  for (const sid of student_ids) {
    const user = all_users[sid];
    if (!user) {
      status[sid] = { logged_in: false, last_login: null, exists: false };
    } else {
      const last_login = user.last_login || '';
      const never = NEVER_MARKERS.some(m => last_login.includes(m));
      status[sid] = {
        logged_in: !never,
        last_login: never ? null : last_login,
        exists: true,
      };
    }
  }
  return status;
}
