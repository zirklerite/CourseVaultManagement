"""
Gitea List Organizations
Lists all organizations visible to the authenticated user.

Usage:
  python list_orgs.py
"""

from config import GITEA_URL, get_credentials
from gitea_api import get_session


def main():
    admin_user, admin_pass = get_credentials()
    session = get_session(admin_user, admin_pass)

    orgs = []
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
                print(f"Error: Could not list organizations (HTTP {resp.status_code})")
                break
        data = resp.json()
        if not data:
            break
        orgs.extend(data)
        page += 1

    if not orgs:
        print("No organizations found.")
        return

    print(f"Organizations ({len(orgs)}):\n")
    for org in orgs:
        vis = org.get("visibility", "unknown")
        desc = org.get("description") or ""
        print(f"  {org['username']} ({vis}){('  ' + desc) if desc else ''}")


if __name__ == "__main__":
    main()
