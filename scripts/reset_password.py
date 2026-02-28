"""
Gitea Reset Student Password
Resets a student's password to the default (reversed student ID).
Sets must_change_password so the student is forced to change it on next login.

Usage:
  python reset_password.py <course_name> <student_id>
  Example: python reset_password.py 113-SophomoreProjects A113080006
"""

import sys
from config import GITEA_URL, get_credentials
from gitea_api import get_session, user_exists, resolve_csv, parse_csv, validate_single_course


def reset_password(session, student_id):
    """Reset a student's password to their reversed ID and require change on login."""
    # Need login_name and source_id for the admin edit endpoint
    resp = session.get(f"{GITEA_URL}/api/v1/users/{student_id}")
    if resp.status_code != 200:
        return "not_found", f"User '{student_id}' not found."

    user = resp.json()
    new_password = student_id[::-1]

    resp = session.patch(
        f"{GITEA_URL}/api/v1/admin/users/{student_id}",
        json={
            "login_name": student_id,
            "source_id": user.get("source_id", 0),
            "password": new_password,
            "must_change_password": True,
        },
    )
    if resp.status_code == 200:
        return "ok", new_password
    return "error", f"HTTP {resp.status_code}: {resp.text}"


def main():
    if len(sys.argv) < 3:
        print("Usage: python reset_password.py <course_name> <student_id>")
        sys.exit(1)

    course_name_arg = sys.argv[1]
    student_id_arg = sys.argv[2]

    input_file = resolve_csv(course_name_arg)

    try:
        entries = parse_csv(input_file)
    except FileNotFoundError:
        print(f"Error: File '{input_file}' not found.")
        sys.exit(1)

    if not entries:
        print("Error: No student IDs found in file.")
        sys.exit(1)

    course_name = validate_single_course(entries)

    # Verify the student exists in the CSV
    if not any(sid == student_id_arg for _, sid, _ in entries):
        print(f"Error: Student '{student_id_arg}' not found in '{input_file}'.")
        sys.exit(1)

    admin_user, admin_pass = get_credentials()
    session = get_session(admin_user, admin_pass)

    result, detail = reset_password(session, student_id_arg)
    if result == "ok":
        print(f"  OK: {student_id_arg} password reset (must change on next login).")
    else:
        print(f"  FAIL: {student_id_arg} - {detail}")


if __name__ == "__main__":
    main()
