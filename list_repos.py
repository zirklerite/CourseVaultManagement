"""
Gitea List Repositories under an Organization
Lists all repos in a given organization with their clone URLs.

Usage:
  python list_repos.py <org_name>
  Example: python list_repos.py 114-2-DesignProject
"""

import sys
from config import get_credentials
from gitea_api import get_session, get_org_repos


def main():
    if len(sys.argv) < 2:
        print("Usage: python list_repos.py <org_name>")
        sys.exit(1)

    org_name = sys.argv[1]
    admin_user, admin_pass = get_credentials()
    session = get_session(admin_user, admin_pass)

    repos = get_org_repos(session, org_name)

    if not repos:
        print(f"No repositories found in '{org_name}'.")
        return

    print(f"Organization: {org_name} ({len(repos)} repos)\n")
    for repo in repos:
        print(f"  {repo['name']}")
        print(f"    URL:   {repo['html_url']}")
        print(f"    Clone: {repo['clone_url']}")
        print(f"    Private: {repo['private']}")
        print()


if __name__ == "__main__":
    main()
