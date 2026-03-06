/**
 * Line-preserving CSV manager for course files.
 * Every line is tracked so round-trip read/write is safe:
 *   write_csv(path, read_csv(path)) produces identical output.
 *
 * Mutations: toggle_student(), update_student(), add_student(), set_group(), remove_group()
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_DIR = __dirname;
export const COURSES_DIR = path.join(PROJECT_DIR, 'courses');
const STUDENT_ID_PATTERN = /^[A-Z]\d{8,}$/;

export type LineKind = 'student' | 'comment_student' | 'comment' | 'blank';

interface CsvLineInit {
  line_number: number;
  raw: string;
  kind: LineKind;
  course_name?: string | null;
  student_id?: string | null;
  student_name?: string | null;
  group_name?: string | null;
}

export class CsvLine {
  line_number: number;
  raw: string;
  kind: LineKind;
  course_name: string | null;
  student_id: string | null;
  student_name: string | null;
  group_name: string | null;

  constructor({ line_number, raw, kind, course_name = null, student_id = null, student_name = null, group_name = null }: CsvLineInit) {
    this.line_number = line_number;
    this.raw = raw;
    this.kind = kind;
    this.course_name = course_name;
    this.student_id = student_id;
    this.student_name = student_name;
    this.group_name = group_name;
  }

  get active(): boolean {
    return this.kind === 'student';
  }

  to_line(): string {
    if (this.kind === 'blank' || this.kind === 'comment') {
      return this.raw;
    }
    const parts: string[] = [this.course_name!, this.student_id!, this.student_name!];
    if (this.group_name) parts.push(this.group_name);
    const content = parts.join(' ');
    if (this.kind === 'comment_student') return `# ${content}`;
    return content;
  }
}

function _parse_student_fields(text: string): [string, string, string, string | null] | null {
  const parts = text.split(/\s+/);
  if (parts.length < 3) return null;
  if (!STUDENT_ID_PATTERN.test(parts[1])) return null;
  return [parts[0], parts[1], parts[2], parts.length >= 4 ? parts[3] : null];
}

export function read_csv(file_path: string): CsvLine[] {
  const content = fs.readFileSync(file_path, 'utf-8');
  const raw_lines = content.split('\n');
  if (raw_lines.length > 0 && raw_lines[raw_lines.length - 1] === '') {
    raw_lines.pop();
  }
  const lines: CsvLine[] = [];
  for (let i = 0; i < raw_lines.length; i++) {
    const raw = raw_lines[i].replace(/\r$/, '');
    const line_number = i + 1;
    if (!raw.trim()) {
      lines.push(new CsvLine({ line_number, raw, kind: 'blank' }));
    } else if (raw.startsWith('#')) {
      const stripped = raw.replace(/^#+/, '').trim();
      const parsed = _parse_student_fields(stripped);
      if (parsed) {
        const [cn, sid, sname, tname] = parsed;
        lines.push(new CsvLine({
          line_number, raw, kind: 'comment_student',
          course_name: cn, student_id: sid, student_name: sname, group_name: tname,
        }));
      } else {
        lines.push(new CsvLine({ line_number, raw, kind: 'comment' }));
      }
    } else {
      const parsed = _parse_student_fields(raw);
      if (parsed) {
        const [cn, sid, sname, tname] = parsed;
        lines.push(new CsvLine({
          line_number, raw, kind: 'student',
          course_name: cn, student_id: sid, student_name: sname, group_name: tname,
        }));
      } else {
        lines.push(new CsvLine({ line_number, raw, kind: 'comment' }));
      }
    }
  }
  return lines;
}

export function write_csv(file_path: string, lines: CsvLine[]): void {
  const content = lines.map(l => l.to_line()).join('\n') + '\n';
  fs.writeFileSync(file_path, content, 'utf-8');
}

export function get_course_name(lines: CsvLine[]): string | null {
  for (const line of lines) {
    if ((line.kind === 'student' || line.kind === 'comment_student') && line.course_name) {
      return line.course_name;
    }
  }
  return null;
}

export function get_students(lines: CsvLine[]): CsvLine[] {
  return lines.filter(l => l.kind === 'student' || l.kind === 'comment_student');
}

export function get_groups(lines: CsvLine[]): string[] {
  const groups: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if ((line.kind === 'student' || line.kind === 'comment_student') && line.group_name) {
      if (!seen.has(line.group_name)) {
        groups.push(line.group_name);
        seen.add(line.group_name);
      }
    }
  }
  return groups;
}

export function toggle_student(lines: CsvLine[], line_number: number): CsvLine[] {
  for (const line of lines) {
    if (line.line_number === line_number) {
      if (line.kind === 'student') line.kind = 'comment_student';
      else if (line.kind === 'comment_student') line.kind = 'student';
      break;
    }
  }
  return lines;
}

interface UpdateOpts {
  student_name?: string;
  group_name?: string;
}

export function update_student(lines: CsvLine[], line_number: number, opts: UpdateOpts = {}): CsvLine[] {
  for (const line of lines) {
    if (line.line_number === line_number && (line.kind === 'student' || line.kind === 'comment_student')) {
      if (opts.student_name !== undefined) line.student_name = opts.student_name;
      if (opts.group_name !== undefined) line.group_name = opts.group_name || null;
      break;
    }
  }
  return lines;
}

export function set_group(lines: CsvLine[], line_number: number, group_name: string): CsvLine[] {
  return update_student(lines, line_number, { group_name });
}

export function remove_group(lines: CsvLine[], line_number: number): CsvLine[] {
  return update_student(lines, line_number, { group_name: '' });
}

export function add_student(lines: CsvLine[], course_name: string, student_id: string, student_name: string, group_name: string | null = null): CsvLine[] {
  const new_line_number = lines.reduce((max, l) => Math.max(max, l.line_number), 0) + 1;
  const parts: string[] = [course_name, student_id, student_name];
  if (group_name) parts.push(group_name);
  const raw = parts.join(' ');
  lines.push(new CsvLine({
    line_number: new_line_number, raw, kind: 'student',
    course_name, student_id, student_name, group_name,
  }));
  return lines;
}

export function list_course_files(): string[] {
  const courses: string[] = [];
  for (const f of fs.readdirSync(COURSES_DIR)) {
    if (f.endsWith('.csv') && !f.endsWith('.aliases.csv') && !f.endsWith('.attendance.csv') && !f.endsWith('.example')) {
      courses.push(f.slice(0, -4));
    }
  }
  return courses.sort();
}

export function resolve_csv_path(course_name: string): string {
  const file_path = path.join(COURSES_DIR, `${course_name}.csv`);
  if (!path.resolve(file_path).startsWith(path.resolve(COURSES_DIR))) {
    throw new Error(`Invalid course name: ${course_name}`);
  }
  return file_path;
}
