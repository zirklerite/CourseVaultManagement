"""
Gitea Check Login
Shows students who have never signed into Gitea.
Checks the last_login field from the Gitea API (web UI login only).

Limitations:
  - Only detects web UI logins, not git push/clone over HTTP or SSH.
  - The Gitea API only provides the last login timestamp, not login count.

CSV format ({course_name}.csv): course_name student_id name [team_name]
  114-2_ExampleCourse A1234567 XXXX TeamAlpha

Usage:
  python check_login.py <course_name>
  Example: python check_login.py 113-SophomoreProjects
"""

import sys
from config import GITEA_URL, get_credentials
from gitea_api import get_session, resolve_csv, parse_csv, validate_single_course

NEVER_LOGGED_IN_MARKERS = [
    "0001-01-01",
    "1970-01-01",
]


def is_never_logged_in(last_login):
    """Check if last_login indicates the user has never signed in."""
    if not last_login:
        return True
    return any(marker in last_login for marker in NEVER_LOGGED_IN_MARKERS)


def main():
    if len(sys.argv) < 2:
        print("Usage: python check_login.py <course_name>")
        sys.exit(1)

    input_file = resolve_csv(sys.argv[1])

    try:
        entries = parse_csv(input_file)
    except FileNotFoundError:
        print(f"Error: File '{input_file}' not found.")
        sys.exit(1)

    if not entries:
        print("Error: No entries found in file.")
        sys.exit(1)

    course_name = validate_single_course(entries)
    print(f"Checking {len(entries)} student(s) in course '{course_name}'...")
    admin_user, admin_pass = get_credentials()
    session = get_session(admin_user, admin_pass)

    never_signed_in = []

    for _, student_id, _ in entries:
        resp = session.get(f"{GITEA_URL}/api/v1/users/{student_id}")
        if resp.status_code != 200:
            print(f"  FAIL: {student_id} - student does not exist")
            continue

        user = resp.json()
        last_login = user.get("last_login", "")

        if is_never_logged_in(last_login):
            print(f"  NEVER: {student_id}")
            never_signed_in.append(student_id)
        else:
            print(f"  OK: {student_id} (last login: {last_login})")

    print(f"\nDone. Never signed in: {len(never_signed_in)}/{len(entries)}")
    if never_signed_in:
        print("\nStudents who never signed in:")
        for student_id in never_signed_in:
            print(f"  {student_id}")


if __name__ == "__main__":
    main()
