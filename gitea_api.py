"""
Shared Gitea API helper functions used by multiple scripts.
"""

import requests
from config import GITEA_URL


def get_session(admin_user, admin_pass):
    """Create an authenticated requests session."""
    session = requests.Session()
    session.auth = (admin_user, admin_pass)
    return session


def user_exists(session, username):
    """Check if a user exists."""
    resp = session.get(f"{GITEA_URL}/api/v1/users/{username}")
    return resp.status_code == 200


def get_user_orgs(session, username):
    """Get list of organization names a user belongs to."""
    orgs = []
    page = 1
    while True:
        resp = session.get(
            f"{GITEA_URL}/api/v1/users/{username}/orgs",
            params={"page": page, "limit": 50},
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        if not data:
            break
        orgs.extend(o["username"] for o in data)
        page += 1
    return orgs


# --- Teams ---

def find_team(session, org_name, team_name):
    """Find an existing team by name in an organization."""
    page = 1
    while True:
        resp = session.get(
            f"{GITEA_URL}/api/v1/orgs/{org_name}/teams",
            params={"page": page, "limit": 50},
        )
        if resp.status_code != 200:
            return None
        teams = resp.json()
        if not teams:
            return None
        for team in teams:
            if team.get("name") == team_name:
                return team
        page += 1


def get_all_teams(session, org_name, include_owners=False):
    """Get all teams in an org. Returns list of team dicts."""
    teams = []
    page = 1
    while True:
        resp = session.get(
            f"{GITEA_URL}/api/v1/orgs/{org_name}/teams",
            params={"page": page, "limit": 50},
        )
        if resp.status_code != 200:
            break
        data = resp.json()
        if not data:
            break
        for t in data:
            if include_owners or t["name"] != "Owners":
                teams.append(t)
        page += 1
    return teams


def get_org_teams_dict(session, org_name):
    """Get all teams in an org as dict {team_name: team_data}."""
    teams = {}
    page = 1
    while True:
        resp = session.get(
            f"{GITEA_URL}/api/v1/orgs/{org_name}/teams",
            params={"page": page, "limit": 50},
        )
        if resp.status_code != 200:
            return teams
        data = resp.json()
        if not data:
            break
        for t in data:
            teams[t["name"]] = t
        page += 1
    return teams


def ensure_team(session, org_name, team_name, permission="write"):
    """Create a team or use existing one, verifying settings."""
    expected_units = ["repo.code", "repo.issues", "repo.pulls"]

    resp = session.post(
        f"{GITEA_URL}/api/v1/orgs/{org_name}/teams",
        json={
            "name": team_name,
            "permission": permission,
            "includes_all_repositories": False,
            "units": expected_units,
        },
    )
    if resp.status_code == 201:
        return "created", resp.json()

    team = find_team(session, org_name, team_name)
    if not team:
        return "error", resp.text

    issues = []
    if team.get("permission") != permission:
        issues.append(f"permission: {team.get('permission')} -> {permission}")
    if team.get("includes_all_repositories"):
        issues.append("includes_all_repositories: true -> false")
    current_units = sorted(team.get("units", []))
    if current_units != sorted(expected_units):
        issues.append(f"units: {current_units} -> {sorted(expected_units)}")

    if issues:
        patch = session.patch(
            f"{GITEA_URL}/api/v1/teams/{team['id']}",
            json={
                "permission": permission,
                "includes_all_repositories": False,
                "units": expected_units,
            },
        )
        if patch.status_code == 200:
            print(f"  FIXED: Team settings updated ({', '.join(issues)}).")
            team = patch.json()
        else:
            print(f"  WARN: Could not update team settings (HTTP {patch.status_code})")

    return "exists", team


def get_team_members(session, team_id):
    """Get all member logins of a team."""
    members = []
    page = 1
    while True:
        resp = session.get(
            f"{GITEA_URL}/api/v1/teams/{team_id}/members",
            params={"page": page, "limit": 50},
        )
        if resp.status_code != 200:
            break
        data = resp.json()
        if not data:
            break
        members.extend(m["login"] for m in data)
        page += 1
    return members


def get_team_repos(session, team_id):
    """Get repo names assigned to a team."""
    repos = []
    page = 1
    while True:
        resp = session.get(
            f"{GITEA_URL}/api/v1/teams/{team_id}/repos",
            params={"page": page, "limit": 50},
        )
        if resp.status_code != 200:
            break
        data = resp.json()
        if not data:
            break
        repos.extend(r["name"] for r in data)
        page += 1
    return repos


def is_team_member(session, team_id, username):
    """Check if a user is a member of a team."""
    resp = session.get(
        f"{GITEA_URL}/api/v1/teams/{team_id}/members/{username}",
    )
    return resp.status_code == 200


def add_team_member(session, team_id, username):
    """Add a user to a team."""
    resp = session.put(
        f"{GITEA_URL}/api/v1/teams/{team_id}/members/{username}",
    )
    return resp.status_code, resp.text


def remove_team_member(session, team_id, username):
    """Remove a user from a team."""
    resp = session.delete(
        f"{GITEA_URL}/api/v1/teams/{team_id}/members/{username}",
    )
    return resp.status_code, resp.text


def add_team_repo(session, team_id, org_name, repo_name):
    """Assign a repo to a team."""
    resp = session.put(
        f"{GITEA_URL}/api/v1/teams/{team_id}/repos/{org_name}/{repo_name}",
    )
    return resp.status_code, resp.text


# --- Repos ---

def create_blank_repo(session, owner, repo_name):
    """Create a blank private repo under an organization."""
    resp = session.post(
        f"{GITEA_URL}/api/v1/orgs/{owner}/repos",
        json={
            "name": repo_name,
            "private": True,
            "auto_init": True,
        },
    )
    if resp.status_code == 201:
        return "created", resp.json()
    return "error", resp.text


def ensure_repo(session, template_owner, template_repo, new_owner, new_repo):
    """Create a repo from template, or verify existing one is private."""
    resp = session.get(f"{GITEA_URL}/api/v1/repos/{new_owner}/{new_repo}")
    if resp.status_code == 200:
        repo = resp.json()
        if not repo.get("private"):
            patch = session.patch(
                f"{GITEA_URL}/api/v1/repos/{new_owner}/{new_repo}",
                json={"private": True},
            )
            if patch.status_code == 200:
                print(f"  FIXED: Repo '{new_owner}/{new_repo}' set to private.")
            else:
                print(f"  WARN: Could not set repo to private (HTTP {patch.status_code})")
        return "exists", repo
    resp = session.post(
        f"{GITEA_URL}/api/v1/repos/{template_owner}/{template_repo}/generate",
        json={
            "owner": new_owner,
            "name": new_repo,
            "private": True,
            "git_content": True,
            "topics": True,
            "labels": True,
        },
    )
    if resp.status_code == 201:
        return "created", resp.json()
    return "error", resp.text


def get_org_repos(session, org_name):
    """Get all repos in an organization."""
    repos = []
    page = 1
    while True:
        resp = session.get(
            f"{GITEA_URL}/api/v1/orgs/{org_name}/repos",
            params={"page": page, "limit": 50},
        )
        if resp.status_code != 200:
            break
        data = resp.json()
        if not data:
            break
        repos.extend(data)
        page += 1
    return repos


# --- CSV parsing ---

def parse_csv(file_path):
    """Parse CSV. Returns list of (org_name, student_id, team_name_or_None).

    CSV format: org_name student_id name [team_name]
    """
    entries = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            org_name = parts[0]
            student_id = parts[1]
            team_name = parts[3] if len(parts) >= 4 else None
            entries.append((org_name, student_id, team_name))
    return entries


def parse_csv_groups(file_path):
    """Parse CSV into org name and groups for repo creation.

    CSV format: org_name student_id name team_name
    Returns (org_name, OrderedDict {team_name: [student_ids]}).
    """
    import sys
    from collections import OrderedDict

    org_names = set()
    groups = OrderedDict()

    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) < 4:
                continue
            org_names.add(parts[0])
            groups.setdefault(parts[3], []).append(parts[1])

    if len(org_names) > 1:
        print(f"Error: Multiple organizations found in CSV: {', '.join(sorted(org_names))}")
        print("  All rows must belong to the same organization.")
        sys.exit(1)

    if not org_names:
        return None, groups

    return next(iter(org_names)), groups


def validate_single_org(entries):
    """Validate all entries belong to the same org. Returns org name or exits."""
    import sys
    org_names = set(org for org, _, _ in entries)
    if len(org_names) > 1:
        print(f"Error: Multiple organizations found in CSV: {', '.join(sorted(org_names))}")
        print("  All rows must belong to the same organization.")
        sys.exit(1)
    return next(iter(org_names))
