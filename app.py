"""
Flask web dashboard for CourseVaultManagement.
Manages courses, students, and teams using CSV files as database
with Gitea API integration for login status.
"""

import os
import sys

import requests
from flask import Flask, render_template, jsonify, request, abort
from collections import OrderedDict

# Add scripts directory to path so we can import config
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts'))
from config import GITEA_URL

import csv_manager

app = Flask(__name__)

NEVER_MARKERS = ["0001-01-01", "1970-01-01"]


# --- Gitea helpers ---

def _gitea_session():
    """Create a Gitea API session using .env credentials."""
    admin_user = os.environ.get('GITEA_ADMIN_USER', '')
    admin_pass = os.environ.get('GITEA_ADMIN_PASS', '')
    if not admin_user or not admin_pass:
        return None
    s = requests.Session()
    s.auth = (admin_user, admin_pass)
    return s


def fetch_all_gitea_users():
    """Fetch all users from Gitea admin API. Returns {login: user_data}."""
    session = _gitea_session()
    if not session:
        return {}
    base_url = GITEA_URL.rstrip('/')
    users = {}
    page = 1
    while True:
        try:
            resp = session.get(
                f"{base_url}/api/v1/admin/users",
                params={"page": page, "limit": 50},
            )
            if resp.status_code != 200:
                break
            data = resp.json()
            if not data:
                break
            for user in data:
                users[user['login']] = user
            page += 1
        except requests.RequestException:
            break
    return users


def get_login_status(student_ids):
    """Get login status for student IDs.
    Returns {student_id: {logged_in: bool, last_login: str|None, exists: bool}}.
    """
    all_users = fetch_all_gitea_users()
    status = {}
    for sid in student_ids:
        user = all_users.get(sid)
        if not user:
            status[sid] = {'logged_in': False, 'last_login': None, 'exists': False}
        else:
            last_login = user.get('last_login', '')
            never = any(m in last_login for m in NEVER_MARKERS)
            status[sid] = {
                'logged_in': not never,
                'last_login': None if never else last_login,
                'exists': True,
            }
    return status


# --- Page Routes ---

@app.route('/')
def landing():
    courses = []
    for name in csv_manager.list_course_files():
        file_path = csv_manager.resolve_csv_path(name)
        lines = csv_manager.read_csv(file_path)
        students = csv_manager.get_students(lines)
        teams = csv_manager.get_teams(lines)
        active_count = sum(1 for s in students if s.active)
        courses.append({
            'name': name,
            'student_count': active_count,
            'team_count': len(teams),
        })
    return render_template('landing.html', courses=courses)


@app.route('/course/<name>')
def course_page(name):
    file_path = csv_manager.resolve_csv_path(name)
    if not os.path.exists(file_path):
        abort(404)
    lines = csv_manager.read_csv(file_path)
    students = csv_manager.get_students(lines)

    teams = OrderedDict()
    unassigned = []
    for s in students:
        if s.team_name:
            teams.setdefault(s.team_name, []).append(s)
        else:
            unassigned.append(s)

    return render_template('course.html',
                           course_name=name, teams=teams, unassigned=unassigned)


@app.route('/course/<name>/teams')
def teams_page(name):
    file_path = csv_manager.resolve_csv_path(name)
    if not os.path.exists(file_path):
        abort(404)
    lines = csv_manager.read_csv(file_path)
    students = csv_manager.get_students(lines)
    team_names = csv_manager.get_teams(lines)

    teams = OrderedDict()
    unassigned = []
    for s in students:
        if s.team_name:
            teams.setdefault(s.team_name, []).append(s)
        else:
            unassigned.append(s)

    return render_template('teams.html',
                           course_name=name, teams=teams,
                           unassigned=unassigned, team_names=team_names)


# --- API Routes ---

@app.route('/api/courses')
def api_courses():
    courses = []
    for name in csv_manager.list_course_files():
        file_path = csv_manager.resolve_csv_path(name)
        lines = csv_manager.read_csv(file_path)
        students = csv_manager.get_students(lines)
        teams = csv_manager.get_teams(lines)
        active_count = sum(1 for s in students if s.active)
        courses.append({
            'name': name,
            'student_count': active_count,
            'team_count': len(teams),
        })
    return jsonify(courses)


@app.route('/api/courses/<name>')
def api_course(name):
    file_path = csv_manager.resolve_csv_path(name)
    if not os.path.exists(file_path):
        return jsonify({'error': 'Course not found'}), 404

    lines = csv_manager.read_csv(file_path)
    students = csv_manager.get_students(lines)

    student_ids = [s.student_id for s in students]
    login_status = get_login_status(student_ids)

    result = {
        'course_name': name,
        'students': [],
        'teams': csv_manager.get_teams(lines),
    }
    for s in students:
        result['students'].append({
            'line': s.line_number,
            'student_id': s.student_id,
            'student_name': s.student_name,
            'team_name': s.team_name,
            'active': s.active,
            'login_status': login_status.get(s.student_id),
        })
    return jsonify(result)


@app.route('/api/courses/<name>/students', methods=['POST'])
def api_add_student(name):
    file_path = csv_manager.resolve_csv_path(name)
    if not os.path.exists(file_path):
        return jsonify({'error': 'Course not found'}), 404

    data = request.get_json()
    student_id = data.get('student_id', '').strip()
    student_name = data.get('student_name', '').strip()
    team_name = data.get('team_name', '').strip() or None

    if not student_id or not student_name:
        return jsonify({'error': 'student_id and student_name are required'}), 400

    lines = csv_manager.read_csv(file_path)
    course_name = csv_manager.get_course_name(lines) or name
    csv_manager.add_student(lines, course_name, student_id, student_name, team_name)
    csv_manager.write_csv(file_path, lines)

    return jsonify({'ok': True}), 201


@app.route('/api/courses/<name>/students/<int:line>', methods=['PUT'])
def api_update_student(name, line):
    file_path = csv_manager.resolve_csv_path(name)
    if not os.path.exists(file_path):
        return jsonify({'error': 'Course not found'}), 404

    data = request.get_json()
    lines = csv_manager.read_csv(file_path)
    csv_manager.update_student(
        lines, line,
        student_name=data.get('student_name'),
        team_name=data.get('team_name'),
    )
    csv_manager.write_csv(file_path, lines)

    return jsonify({'ok': True})


@app.route('/api/courses/<name>/students/<int:line>/toggle', methods=['PATCH'])
def api_toggle_student(name, line):
    file_path = csv_manager.resolve_csv_path(name)
    if not os.path.exists(file_path):
        return jsonify({'error': 'Course not found'}), 404

    lines = csv_manager.read_csv(file_path)
    csv_manager.toggle_student(lines, line)
    csv_manager.write_csv(file_path, lines)

    return jsonify({'ok': True})


@app.route('/api/courses/<name>/students/<int:line>/team', methods=['DELETE'])
def api_remove_team(name, line):
    file_path = csv_manager.resolve_csv_path(name)
    if not os.path.exists(file_path):
        return jsonify({'error': 'Course not found'}), 404

    lines = csv_manager.read_csv(file_path)
    csv_manager.remove_team(lines, line)
    csv_manager.write_csv(file_path, lines)

    return jsonify({'ok': True})


if __name__ == '__main__':
    app.run(debug=True)
