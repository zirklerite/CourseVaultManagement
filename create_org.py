"""
Gitea Create Organization
Creates a private organization. The API caller becomes Owner automatically.

Usage:
  python create_org.py <org_name>
  Example: python create_org.py 114-2-DesignProject
"""

import sys
import requests
from config import GITEA_URL, get_credentials


def main():
    if len(sys.argv) < 2:
        print("Usage: python create_org.py <org_name>")
        sys.exit(1)

    org_name = sys.argv[1]
    admin_user, admin_pass = get_credentials()

    session = requests.Session()
    session.auth = (admin_user, admin_pass)

    # Check if org already exists
    resp = session.get(f"{GITEA_URL}/api/v1/orgs/{org_name}")
    if resp.status_code == 200:
        org = resp.json()
        print(f"Organization '{org_name}' already exists.")
        if org.get("visibility") != "private":
            patch = session.patch(
                f"{GITEA_URL}/api/v1/orgs/{org_name}",
                json={"visibility": "private"},
            )
            if patch.status_code == 200:
                print("  FIXED: Visibility set to private.")
            else:
                print(f"  WARN: Could not update visibility (HTTP {patch.status_code})")
        else:
            print("  Visibility: private (OK)")
        sys.exit(0)

    # Create new org
    resp = session.post(
        f"{GITEA_URL}/api/v1/orgs",
        json={
            "username": org_name,
            "visibility": "private",
        },
    )
    if resp.status_code == 201:
        org = resp.json()
        vis = org.get("visibility", "unknown")
        print(f"OK: Organization '{org_name}' created.")
        print(f"  Visibility: {vis}" + (" (OK)" if vis == "private" else " (WARN: expected private)"))
    else:
        print(f"FAIL: Could not create organization (HTTP {resp.status_code}) {resp.text}")
        sys.exit(1)


if __name__ == "__main__":
    main()
