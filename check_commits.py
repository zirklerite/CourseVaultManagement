"""
Gitea Check Commits
Shows teams where no non-admin commit has been made to the team repo yet.
Fetches teams, members, and repos directly from the Gitea API.
Skips the Owners team.

An optional {org_name}.aliases.csv file can map git emails to student IDs,
so commits from unlinked git accounts are attributed correctly.

Limitations:
  - Only detects web-linked or alias-mapped authors. Commits with unknown
    git emails are counted as non-admin but reported as unknown.

Usage:
  python check_commits.py <org_name> [team_name]
  Example: python check_commits.py 113-SophomoreProjects
  Example: python check_commits.py 113-SophomoreProjects IngrainedMemory
"""

import os
import sys
from config import GITEA_URL, get_credentials
from gitea_api import (
    get_session, get_all_teams, get_team_members, get_team_repos,
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def load_aliases(org_name):
    """Load git email -> student_id mapping from {org_name}.aliases.csv.

    Format: git_email student_id
    Returns dict {email_lower: student_id_lower}.
    """
    aliases_file = os.path.join(SCRIPT_DIR, f"{org_name}.aliases.csv")
    aliases = {}
    if not os.path.exists(aliases_file):
        return aliases
    with open(aliases_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) >= 2:
                aliases[parts[0].lower()] = parts[1].lower()
    count = len(aliases)
    if count:
        print(f"Loaded {count} alias(es) from {org_name}.aliases.csv.")
    return aliases


def get_repo_commits(session, owner, repo):
    """Get all commits for a repo. Returns list of commit dicts or None on error."""
    all_commits = []
    page = 1
    while True:
        resp = session.get(
            f"{GITEA_URL}/api/v1/repos/{owner}/{repo}/commits",
            params={"page": page, "limit": 50},
        )
        if resp.status_code != 200:
            return None
        commits = resp.json()
        if not commits:
            break
        all_commits.extend(commits)
        page += 1
    return all_commits


def analyze_commits(commits, admin_logins, admin_emails, member_logins, org_name, aliases):
    """Analyze commits and categorize authors.

    Returns (non_admin_count, unknown_authors).
    unknown_authors is a set of "name <email>" strings for commits that
    are not from admins and not linked to any team member's Gitea account.
    aliases maps git emails to student IDs for unlinked accounts.
    """
    non_admin_count = 0
    unknown_authors = set()

    for c in commits:
        git_name = c.get("commit", {}).get("author", {}).get("name", "")
        git_email = c.get("commit", {}).get("author", {}).get("email", "").lower()

        # Skip template commits (org name as author)
        if git_name == org_name:
            continue

        # Check linked Gitea account
        author = c.get("author")
        if author and author.get("login"):
            login = author["login"].lower()
            if login in admin_logins:
                continue
            non_admin_count += 1
            if login not in member_logins:
                unknown_authors.add(f"{git_name} <{git_email}> (gitea: {author['login']})")
            continue

        # No linked Gitea account - check alias
        if git_email in aliases:
            alias_sid = aliases[git_email]
            if alias_sid in admin_logins:
                continue
            non_admin_count += 1
            # Alias resolved to a known member - not unknown
            if alias_sid not in member_logins:
                unknown_authors.add(f"{git_name} <{git_email}> (alias: {alias_sid})")
            continue

        # No alias - check admin email
        if git_email not in admin_emails:
            non_admin_count += 1
            unknown_authors.add(f"{git_name} <{git_email}>")

    return non_admin_count, unknown_authors


def main():
    if len(sys.argv) < 2:
        print("Usage: python check_commits.py <org_name> [team_name]")
        sys.exit(1)

    org_name = sys.argv[1]
    filter_team = sys.argv[2] if len(sys.argv) >= 3 else None
    aliases = load_aliases(org_name)
    admin_user, admin_pass = get_credentials()
    session = get_session(admin_user, admin_pass)

    # Verify org exists
    resp = session.get(f"{GITEA_URL}/api/v1/orgs/{org_name}")
    if resp.status_code != 200:
        print(f"Error: Organization '{org_name}' not found.")
        sys.exit(1)

    # Get admin/owner logins and emails to exclude their commits
    from gitea_api import get_all_teams as _get_all_teams
    owner_teams = [t for t in _get_all_teams(session, org_name, include_owners=True)
                   if t["name"] == "Owners"]
    admin_logins = set()
    admin_emails = set()
    if owner_teams:
        for m in get_team_members(session, owner_teams[0]["id"]):
            admin_logins.add(m.lower())
            resp = session.get(f"{GITEA_URL}/api/v1/users/{m}")
            if resp.status_code == 200:
                email = resp.json().get("email", "").lower()
                if email:
                    admin_emails.add(email)

    teams = get_all_teams(session, org_name)
    if filter_team:
        teams = [t for t in teams if t["name"] == filter_team]
        if not teams:
            print(f"Error: Team '{filter_team}' not found in '{org_name}'.")
            sys.exit(1)

    if not teams:
        print(f"No teams found in '{org_name}' (excluding Owners).")
        return

    print(f"Checking {len(teams)} team(s) in org '{org_name}'...")

    no_commits = []
    all_unknown = set()

    for team in teams:
        team_name = team["name"]
        team_id = team["id"]
        members = get_team_members(session, team_id)
        repos = get_team_repos(session, team_id)

        if not repos:
            print(f"  SKIP: {team_name} - no repo assigned")
            continue

        member_logins = set(sid.lower() for sid in members)

        for repo_name in repos:
            commits = get_repo_commits(session, org_name, repo_name)
            if commits is None:
                print(f"  FAIL: {team_name} - could not read repo '{org_name}/{repo_name}'")
                continue

            non_admin, unknown = analyze_commits(
                commits, admin_logins, admin_emails, member_logins, org_name, aliases
            )
            total = len(commits)
            if non_admin > 0:
                print(f"  OK: {team_name}/{repo_name} ({non_admin} non-admin commit(s) out of {total})")
            else:
                print(f"  NO COMMITS: {team_name}/{repo_name} ({total} commit(s), all from admin)")
                no_commits.append(team_name)
            if unknown:
                all_unknown.update(
                    (team_name, repo_name, author) for author in unknown
                )

    print(f"\nDone. Teams with no student commits: {len(no_commits)}/{len(teams)}")
    if no_commits:
        print("\nTeams with no student commits:")
        for name in no_commits:
            print(f"  {name}")

    if all_unknown:
        print(f"\nUnknown git authors (not linked to any team member account):")
        current_team = None
        for team_name, repo_name, author in sorted(all_unknown):
            if team_name != current_team:
                current_team = team_name
                print(f"  {team_name}/{repo_name}:")
            print(f"    {author}")


if __name__ == "__main__":
    main()
