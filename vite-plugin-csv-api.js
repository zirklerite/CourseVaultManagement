/**
 * Vite plugin that adds CSV file API routes to the dev/preview server.
 * Imports csv_manager.js for all file operations.
 */

import fs from 'fs';
import {
  list_course_files, resolve_csv_path, read_csv, write_csv,
  get_students, get_groups, get_course_name,
  add_student, update_student, toggle_student, remove_group,
} from './csv_manager.ts';

function json(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function parse_body(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function add_routes(server) {
  server.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    // GET /api/courses
    if (req.method === 'GET' && pathname === '/api/courses') {
      try {
        const courses = [];
        for (const name of list_course_files()) {
          const file_path = resolve_csv_path(name);
          const lines = read_csv(file_path);
          const students = get_students(lines);
          const groups = get_groups(lines);
          const active_count = students.filter(s => s.active).length;
          courses.push({ name, student_count: active_count, group_count: groups.length });
        }
        return json(res, courses);
      } catch (e) {
        return json(res, { error: e.message }, 500);
      }
    }

    // Match /api/courses/:name routes
    const courseMatch = pathname.match(/^\/api\/courses\/([^/]+)$/);
    if (req.method === 'GET' && courseMatch) {
      const name = decodeURIComponent(courseMatch[1]);
      try {
        const file_path = resolve_csv_path(name);
        if (!fs.existsSync(file_path)) return json(res, { error: 'Course not found' }, 404);
        const lines = read_csv(file_path);
        const students = get_students(lines);
        const result = {
          course_name: name,
          students: students.map(s => ({
            line: s.line_number,
            student_id: s.student_id,
            student_name: s.student_name,
            group_name: s.group_name,
            active: s.active,
          })),
          groups: get_groups(lines),
        };
        return json(res, result);
      } catch (e) {
        return json(res, { error: e.message }, 500);
      }
    }

    // POST /api/courses/:name/students
    const addStudentMatch = pathname.match(/^\/api\/courses\/([^/]+)\/students$/);
    if (req.method === 'POST' && addStudentMatch) {
      const name = decodeURIComponent(addStudentMatch[1]);
      try {
        const file_path = resolve_csv_path(name);
        if (!fs.existsSync(file_path)) return json(res, { error: 'Course not found' }, 404);
        const data = await parse_body(req);
        const student_id = (data.student_id || '').trim();
        const student_name = (data.student_name || '').trim();
        const group_name = (data.group_name || '').trim() || null;
        if (!student_id || !student_name) return json(res, { error: 'student_id and student_name are required' }, 400);
        const lines = read_csv(file_path);
        const course_name = get_course_name(lines) || name;
        add_student(lines, course_name, student_id, student_name, group_name);
        write_csv(file_path, lines);
        return json(res, { ok: true }, 201);
      } catch (e) {
        return json(res, { error: e.message }, 500);
      }
    }

    // PUT /api/courses/:name/students/:line
    const updateMatch = pathname.match(/^\/api\/courses\/([^/]+)\/students\/(\d+)$/);
    if (req.method === 'PUT' && updateMatch) {
      const name = decodeURIComponent(updateMatch[1]);
      const line = parseInt(updateMatch[2], 10);
      try {
        const file_path = resolve_csv_path(name);
        if (!fs.existsSync(file_path)) return json(res, { error: 'Course not found' }, 404);
        const data = await parse_body(req);
        const lines = read_csv(file_path);
        update_student(lines, line, {
          student_name: data.student_name,
          group_name: data.group_name,
        });
        write_csv(file_path, lines);
        return json(res, { ok: true });
      } catch (e) {
        return json(res, { error: e.message }, 500);
      }
    }

    // PATCH /api/courses/:name/students/:line/toggle
    const toggleMatch = pathname.match(/^\/api\/courses\/([^/]+)\/students\/(\d+)\/toggle$/);
    if (req.method === 'PATCH' && toggleMatch) {
      const name = decodeURIComponent(toggleMatch[1]);
      const line = parseInt(toggleMatch[2], 10);
      try {
        const file_path = resolve_csv_path(name);
        if (!fs.existsSync(file_path)) return json(res, { error: 'Course not found' }, 404);
        const lines = read_csv(file_path);
        toggle_student(lines, line);
        write_csv(file_path, lines);
        return json(res, { ok: true });
      } catch (e) {
        return json(res, { error: e.message }, 500);
      }
    }

    // DELETE /api/courses/:name/students/:line/group
    const removeGroupMatch = pathname.match(/^\/api\/courses\/([^/]+)\/students\/(\d+)\/group$/);
    if (req.method === 'DELETE' && removeGroupMatch) {
      const name = decodeURIComponent(removeGroupMatch[1]);
      const line = parseInt(removeGroupMatch[2], 10);
      try {
        const file_path = resolve_csv_path(name);
        if (!fs.existsSync(file_path)) return json(res, { error: 'Course not found' }, 404);
        const lines = read_csv(file_path);
        remove_group(lines, line);
        write_csv(file_path, lines);
        return json(res, { ok: true });
      } catch (e) {
        return json(res, { error: e.message }, 500);
      }
    }

    next();
  });
}

export default function csvApiPlugin() {
  return {
    name: 'csv-api',
    configureServer(server) {
      add_routes(server);
    },
    configurePreviewServer(server) {
      add_routes(server);
    },
  };
}
