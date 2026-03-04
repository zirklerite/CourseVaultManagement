"""
Line-preserving CSV manager for course files.
Every line is tracked as a dataclass so round-trip read/write is safe:
  write_csv(path, read_csv(path)) produces identical output.

Mutations: toggle_student(), update_student(), add_student(), set_team(), remove_team()
"""

import os
import re
from dataclasses import dataclass
from typing import Optional, List

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
COURSES_DIR = os.path.join(PROJECT_DIR, 'courses')
STUDENT_ID_PATTERN = re.compile(r'^[A-Z]\d{8,}$')


@dataclass
class CsvLine:
    """Represents a single line in the CSV file."""
    line_number: int  # 1-based
    raw: str
    kind: str  # 'student', 'comment_student', 'comment', 'blank'
    course_name: Optional[str] = None
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    team_name: Optional[str] = None

    @property
    def active(self):
        return self.kind == 'student'

    def to_line(self) -> str:
        if self.kind in ('blank', 'comment'):
            return self.raw
        parts = [self.course_name, self.student_id, self.student_name]
        if self.team_name:
            parts.append(self.team_name)
        content = ' '.join(parts)
        if self.kind == 'comment_student':
            return f'# {content}'
        return content


def _parse_student_fields(text):
    """Try to parse 'CourseName StudentID StudentName [TeamName]' from text.
    Returns (course_name, student_id, student_name, team_name) or None.
    """
    parts = text.split()
    if len(parts) < 3:
        return None
    if not STUDENT_ID_PATTERN.match(parts[1]):
        return None
    return parts[0], parts[1], parts[2], parts[3] if len(parts) >= 4 else None


def read_csv(file_path: str) -> List[CsvLine]:
    """Read a CSV file, preserving every line."""
    lines = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for i, raw_line in enumerate(f, 1):
            raw = raw_line.rstrip('\n').rstrip('\r')
            if not raw.strip():
                lines.append(CsvLine(line_number=i, raw=raw, kind='blank'))
            elif raw.startswith('#'):
                content = raw.lstrip('#').strip()
                parsed = _parse_student_fields(content)
                if parsed:
                    cn, sid, sname, tname = parsed
                    lines.append(CsvLine(
                        line_number=i, raw=raw, kind='comment_student',
                        course_name=cn, student_id=sid,
                        student_name=sname, team_name=tname,
                    ))
                else:
                    lines.append(CsvLine(line_number=i, raw=raw, kind='comment'))
            else:
                parsed = _parse_student_fields(raw)
                if parsed:
                    cn, sid, sname, tname = parsed
                    lines.append(CsvLine(
                        line_number=i, raw=raw, kind='student',
                        course_name=cn, student_id=sid,
                        student_name=sname, team_name=tname,
                    ))
                else:
                    lines.append(CsvLine(line_number=i, raw=raw, kind='comment'))
    return lines


def write_csv(file_path: str, lines: List[CsvLine]):
    """Write lines back to CSV file."""
    with open(file_path, 'w', encoding='utf-8') as f:
        for line in lines:
            f.write(line.to_line() + '\n')


def get_course_name(lines: List[CsvLine]) -> Optional[str]:
    """Extract course name from parsed lines."""
    for line in lines:
        if line.kind in ('student', 'comment_student') and line.course_name:
            return line.course_name
    return None


def get_students(lines: List[CsvLine]) -> List[CsvLine]:
    """Get all student lines (active and inactive)."""
    return [l for l in lines if l.kind in ('student', 'comment_student')]


def get_teams(lines: List[CsvLine]) -> List[str]:
    """Get unique team names from all students (preserving order)."""
    teams = []
    seen = set()
    for line in lines:
        if line.kind in ('student', 'comment_student') and line.team_name:
            if line.team_name not in seen:
                teams.append(line.team_name)
                seen.add(line.team_name)
    return teams


def toggle_student(lines: List[CsvLine], line_number: int) -> List[CsvLine]:
    """Toggle a student between active and inactive (comment/uncomment)."""
    for line in lines:
        if line.line_number == line_number:
            if line.kind == 'student':
                line.kind = 'comment_student'
            elif line.kind == 'comment_student':
                line.kind = 'student'
            break
    return lines


def update_student(lines: List[CsvLine], line_number: int,
                   student_name: Optional[str] = None,
                   team_name: Optional[str] = None) -> List[CsvLine]:
    """Update a student's name and/or team. Pass None to leave unchanged."""
    for line in lines:
        if line.line_number == line_number and line.kind in ('student', 'comment_student'):
            if student_name is not None:
                line.student_name = student_name
            if team_name is not None:
                line.team_name = team_name if team_name else None
            break
    return lines


def set_team(lines: List[CsvLine], line_number: int, team_name: str) -> List[CsvLine]:
    """Set a student's team."""
    return update_student(lines, line_number, team_name=team_name)


def remove_team(lines: List[CsvLine], line_number: int) -> List[CsvLine]:
    """Remove a student from their team."""
    return update_student(lines, line_number, team_name='')


def add_student(lines: List[CsvLine], course_name: str, student_id: str,
                student_name: str, team_name: Optional[str] = None) -> List[CsvLine]:
    """Add a new student at the end of the file."""
    new_line_number = max((l.line_number for l in lines), default=0) + 1
    parts = [course_name, student_id, student_name]
    if team_name:
        parts.append(team_name)
    raw = ' '.join(parts)
    lines.append(CsvLine(
        line_number=new_line_number, raw=raw, kind='student',
        course_name=course_name, student_id=student_id,
        student_name=student_name, team_name=team_name,
    ))
    return lines


def list_course_files() -> List[str]:
    """List all course CSV files (excluding .aliases.csv and .example)."""
    courses = []
    for f in os.listdir(COURSES_DIR):
        if (f.endswith('.csv')
                and not f.endswith('.aliases.csv')
                and not f.endswith('.example')):
            courses.append(f[:-4])
    return sorted(courses)


def resolve_csv_path(course_name: str) -> str:
    """Resolve course name to CSV file path, with path traversal protection."""
    path = os.path.join(COURSES_DIR, f'{course_name}.csv')
    if not os.path.abspath(path).startswith(os.path.abspath(COURSES_DIR)):
        raise ValueError(f'Invalid course name: {course_name}')
    return path
