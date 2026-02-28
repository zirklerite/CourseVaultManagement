"""
Gitea List Courses
Lists all courses (organizations) visible to the authenticated user.

Usage:
  python list_courses.py
"""

from config import GITEA_URL, get_credentials
from gitea_api import get_session


def main():
    admin_user, admin_pass = get_credentials()
    session = get_session(admin_user, admin_pass)

    courses = []
    page = 1
    while True:
        resp = session.get(
            f"{GITEA_URL}/api/v1/admin/orgs",
            params={"page": page, "limit": 50},
        )
        if resp.status_code != 200:
            resp = session.get(
                f"{GITEA_URL}/api/v1/user/orgs",
                params={"page": page, "limit": 50},
            )
            if resp.status_code != 200:
                print(f"Error: Could not list courses (HTTP {resp.status_code})")
                break
        data = resp.json()
        if not data:
            break
        courses.extend(data)
        page += 1

    if not courses:
        print("No courses found.")
        return

    print(f"Courses ({len(courses)}):\n")
    for course in courses:
        vis = course.get("visibility", "unknown")
        desc = course.get("description") or ""
        print(f"  {course['username']} ({vis}){('  ' + desc) if desc else ''}")


if __name__ == "__main__":
    main()
