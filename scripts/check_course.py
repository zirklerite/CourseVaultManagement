"""
Gitea Check Course
Displays course details including visibility, teams, repos, and students.
Warns if team name does not match its assigned repo name.

Usage:
  python check_course.py <course_name>
  Example: python check_course.py 113-SophomoreProjects
"""

import sys
from config import GITEA_URL, get_credentials
from gitea_api import (
    get_session, get_org_repos, get_all_teams,
    get_team_members, get_team_repos,
)


def main():
    if len(sys.argv) < 2:
        print("Usage: python check_course.py <course_name>")
        sys.exit(1)

    course_name = sys.argv[1]
    admin_user, admin_pass = get_credentials()
    session = get_session(admin_user, admin_pass)

    # Course info
    resp = session.get(f"{GITEA_URL}/api/v1/orgs/{course_name}")
    if resp.status_code != 200:
        print(f"Error: Course '{course_name}' not found.")
        sys.exit(1)
    org = resp.json()

    print(f"Course: {course_name}")
    print(f"  Visibility: {org.get('visibility', 'unknown')}")
    print(f"  Description: {org.get('description') or '(none)'}")

    # Repos
    repos = get_org_repos(session, course_name)
    repo_names = set(r["name"] for r in repos)
    print(f"\nRepos ({len(repos)}):")
    if repos:
        for repo in repos:
            private = "private" if repo["private"] else "public"
            print(f"  {repo['name']} ({private})")
    else:
        print("  (none)")

    # Teams
    teams = get_all_teams(session, course_name, include_owners=True)
    print(f"\nTeams ({len(teams)}):")
    for team in teams:
        includes_all = "all repos" if team.get("includes_all_repositories") else "specific repos"
        units = team.get("units_map", {})
        perms = ", ".join(f"{u.split('.')[-1]}:{p}" for u, p in units.items())
        is_owners = team["name"] == "Owners"

        # Check team name matches a repo
        if not is_owners and team["name"] not in repo_names:
            print(f"  {team['name']} (ID: {team['id']}, {includes_all}, {perms}) WARN: no matching repo")
        else:
            print(f"  {team['name']} (ID: {team['id']}, {includes_all}, {perms})")

        # Team repos
        team_repos = get_team_repos(session, team["id"])
        if team_repos:
            for r in team_repos:
                if not is_owners and r != team["name"]:
                    print(f"    Repo: {r} WARN: name mismatch with team")
                else:
                    print(f"    Repo: {r}")
        else:
            if not is_owners:
                print(f"    Repos: (none) WARN: no repo assigned")
            else:
                print(f"    Repos: (none)")

        # Team students
        members = get_team_members(session, team["id"])
        if members:
            for m in members:
                print(f"    Student: {m}")
        else:
            print(f"    Students: (none)")


if __name__ == "__main__":
    main()
