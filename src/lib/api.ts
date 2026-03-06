/**
 * Fetch wrappers for the CSV API endpoints (served by vite-plugin-csv-api).
 */

export interface CourseInfo {
  name: string;
  student_count: number;
  group_count: number;
}

export interface StudentInfo {
  line: number;
  student_id: string;
  student_name: string;
  group_name: string | null;
  active: boolean;
}

export interface CourseDetail {
  course_name: string;
  students: StudentInfo[];
  groups: string[];
}

async function api<T>(url: string, method = 'GET', body: unknown = null): Promise<T> {
  const opts: RequestInit = { method, headers: {} };
  if (body) {
    (opts.headers as Record<string, string>)['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(url, opts);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${resp.status})`);
  }
  return resp.json();
}

export function fetch_courses(): Promise<CourseInfo[]> {
  return api('/api/courses');
}

export function fetch_course(name: string): Promise<CourseDetail> {
  return api(`/api/courses/${encodeURIComponent(name)}`);
}

export function add_student(name: string, data: { student_id: string; student_name: string; group_name?: string | null }): Promise<{ ok: boolean }> {
  return api(`/api/courses/${encodeURIComponent(name)}/students`, 'POST', {
    student_id: data.student_id, student_name: data.student_name, group_name: data.group_name || null,
  });
}

export function update_student(name: string, line: number, data: { student_name?: string; group_name?: string }): Promise<{ ok: boolean }> {
  return api(`/api/courses/${encodeURIComponent(name)}/students/${line}`, 'PUT', data);
}

export function toggle_student(name: string, line: number): Promise<{ ok: boolean }> {
  return api(`/api/courses/${encodeURIComponent(name)}/students/${line}/toggle`, 'PATCH');
}

export function remove_group(name: string, line: number): Promise<{ ok: boolean }> {
  return api(`/api/courses/${encodeURIComponent(name)}/students/${line}/group`, 'DELETE');
}
