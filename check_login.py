"""
Gitea Check Login
Shows students who have never signed into Gitea.
Checks the last_login field from the Gitea API (web UI login only).

Limitations:
  - Only detects web UI logins, not git push/clone over HTTP or SSH.
  - The Gitea API only provides the last login timestamp, not login count.

CSV format: org_name student_id name [team_name]
  114-2_ExampleCourse A1234567 XXXX TeamAlpha

Usage:
  python check_login.py <students.csv>
  Example: python check_login.py students_example.csv
"""

import sys
from config import GITEA_URL, get_credentials
from gitea_api import get_session, parse_csv, validate_single_org

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
        print("Usage: python check_login.py <students.csv>")
        sys.exit(1)

    input_file = sys.argv[1]

    try:
        entries = parse_csv(input_file)
    except FileNotFoundError:
        print(f"Error: File '{input_file}' not found.")
        sys.exit(1)

    if not entries:
        print("Error: No entries found in file.")
        sys.exit(1)

    org_name_global = validate_single_org(entries)
    print(f"Checking {len(entries)} student(s) in org '{org_name_global}'...")
    admin_user, admin_pass = get_credentials()
    session = get_session(admin_user, admin_pass)

    never_signed_in = []

    for _, sid, _ in entries:
        resp = session.get(f"{GITEA_URL}/api/v1/users/{sid}")
        if resp.status_code != 200:
            print(f"  FAIL: {sid} - user does not exist")
            continue

        user = resp.json()
        last_login = user.get("last_login", "")

        if is_never_logged_in(last_login):
            print(f"  NEVER: {sid}")
            never_signed_in.append(sid)
        else:
            print(f"  OK: {sid} (last login: {last_login})")

    print(f"\nDone. Never signed in: {len(never_signed_in)}/{len(entries)}")
    if never_signed_in:
        print("\nStudents who never signed in:")
        for sid in never_signed_in:
            print(f"  {sid}")


if __name__ == "__main__":
    main()
