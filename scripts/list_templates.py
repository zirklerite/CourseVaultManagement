"""
Gitea List Templates
Lists all template repos accessible to the admin user.
These can be used with create_repos.py as the template argument.

Usage:
  python list_templates.py
  Example: python list_templates.py
"""

import sys
from config import GITEA_URL, get_credentials
from gitea_api import get_session


def main():
    admin_user, admin_pass = get_credentials()
    session = get_session(admin_user, admin_pass)

    all_templates = []
    page = 1
    while True:
        resp = session.get(
            f"{GITEA_URL}/api/v1/repos/search",
            params={"template": True, "page": page, "limit": 50},
        )
        if resp.status_code != 200:
            print(f"Error: Could not search repos (HTTP {resp.status_code})")
            sys.exit(1)
        data = resp.json().get("data", [])
        if not data:
            break
        all_templates.extend(data)
        page += 1

    if not all_templates:
        print("No template repos found.")
        return

    print(f"Found {len(all_templates)} template(s):\n")
    for repo in all_templates:
        owner = repo["owner"]["login"]
        name = repo["name"]
        desc = repo.get("description", "")
        print(f"  {owner}/{name}")
        if desc:
            print(f"    {desc}")

    print(f"\nUsage: python create_repos.py <course_name> <owner/template>")


if __name__ == "__main__":
    main()
