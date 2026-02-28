"""
Gitea Batch Create Repos
Creates repos (from a template or blank) and assigns them to teams within an existing course.
Course must be created beforehand with create_course.py.
All rows in the CSV must belong to the same course.
If a team or repo already exists, it is reused and its settings are verified.
Within one course, a student belongs to exactly one team;
removes from wrong teams if needed.
A student may belong to teams in different courses (different course CSVs).
Team name must match the repo name.

Steps:
  1. Verify the course exists (terminate if not)
  2. For each team in the CSV:
     a. Create a Team with "Specific Repositories" permission (write access)
     b. Create a repo (from template or blank) under the course
     c. Assign the repo to the Team
     d. Add each student to the Team

  Each Team only has access to its own repo, so students cannot see other teams' repos.

CSV format: course_name student_id name team_name
  113-SophomoreProjects A113080006 XXXX TeamAlpha
  113-SophomoreProjects A113080042 YYYY TeamAlpha
  113-SophomoreProjects A113080081 ZZZZ AnotherGame

Usage:
  python create_repos.py <course_name>
  python create_repos.py <course_name> <template_owner/template_repo>
  Example: python create_repos.py 113-SophomoreProjects
  Example: python create_repos.py 113-SophomoreProjects teacher/GameTemplate

Result:
  Course: 113-SophomoreProjects (private)
  +-- Team: TeamAlpha      ->  Repo: TeamAlpha
  |   +-- A113080006
  |   +-- A113080042
  +-- Team: AnotherGame    ->  Repo: AnotherGame
      +-- A113080081
"""

import sys
from config import GITEA_URL, get_credentials
from gitea_api import (
    get_session, resolve_csv, parse_csv_teams,
    ensure_team, ensure_repo, create_blank_repo, get_all_teams,
    get_team_members, get_team_repos,
    add_team_member, remove_team_member, add_team_repo,
)


def main():
    if len(sys.argv) < 2:
        print("Usage: python create_repos.py <course_name> [template_owner/template_repo]")
        print("Example: python create_repos.py 113-SophomoreProjects")
        print("Example: python create_repos.py 113-SophomoreProjects teacher/GameTemplate")
        sys.exit(1)

    csv_file = resolve_csv(sys.argv[1])
    template_owner = template_repo = None

    if len(sys.argv) >= 3:
        template_path = sys.argv[2]
        if "/" not in template_path:
            print("Error: Template must be in format 'owner/repo'.")
            sys.exit(1)
        template_owner, template_repo = template_path.split("/", 1)

    try:
        course_name, teams = parse_csv_teams(csv_file)
    except FileNotFoundError:
        print(f"Error: File '{csv_file}' not found.")
        sys.exit(1)

    if not course_name or not teams:
        print("Error: No teams found in file. CSV must have: course_name student_id name team_name")
        sys.exit(1)

    print(f"Course: {course_name}")
    if template_owner:
        print(f"Template: {template_owner}/{template_repo}")
    else:
        print("Template: (none, creating blank repos)")
    print(f"Found {len(teams)} team(s):")
    for name, members in teams.items():
        print(f"  {name}: {', '.join(members)}")

    admin_user, admin_pass = get_credentials()
    session = get_session(admin_user, admin_pass)

    # Step 1: Verify course exists
    print(f"\n=== Course: {course_name} ===")
    resp = session.get(f"{GITEA_URL}/api/v1/orgs/{course_name}")
    if resp.status_code != 200:
        print(f"Error: Course '{course_name}' does not exist.")
        print(f"  Create it first: python create_course.py {course_name}")
        sys.exit(1)
    org = resp.json()
    if org.get("visibility") != "private":
        print(f"  WARN: Course visibility is '{org.get('visibility')}', expected 'private'.")
    else:
        print(f"  OK: Course '{course_name}' exists (private).")

    # Get all existing teams (excluding Owners) for membership cleanup
    other_teams = get_all_teams(session, course_name)

    # Step 2: For each team, ensure team + repo + assign
    for team_name, members in teams.items():
        repo_name = team_name
        print(f"\n--- Team: {team_name} ---")

        # Ensure team
        result, team_data = ensure_team(session, course_name, team_name)
        if result in ("created", "exists"):
            team_id = team_data.get("id")
            label = "created" if result == "created" else "exists (verified)"
            print(f"  OK: Team '{team_name}' {label} (ID: {team_id}).")
        else:
            print(f"  FAIL: Could not create/get team: {team_data}")
            continue

        # Verify team only has its matching repo
        if result == "exists":
            existing_repos = get_team_repos(session, team_id)
            for r in existing_repos:
                if r != team_name:
                    print(f"  WARN: Team '{team_name}' has mismatched repo '{r}'.")

        # Ensure repo
        if template_owner:
            result, repo_data = ensure_repo(
                session, template_owner, template_repo, course_name, repo_name
            )
            if result == "created":
                print(f"  OK: Repo '{course_name}/{repo_name}' created from template.")
            elif result == "exists":
                print(f"  OK: Repo '{course_name}/{repo_name}' already exists (verified private).")
            else:
                print(f"  FAIL: Could not create/get repo: {repo_data}")
                continue
        else:
            # Check if repo exists, otherwise create blank
            resp = session.get(f"{GITEA_URL}/api/v1/repos/{course_name}/{repo_name}")
            if resp.status_code == 200:
                print(f"  OK: Repo '{course_name}/{repo_name}' already exists.")
            else:
                result, repo_data = create_blank_repo(session, course_name, repo_name)
                if result == "created":
                    print(f"  OK: Repo '{course_name}/{repo_name}' created (blank).")
                else:
                    print(f"  FAIL: Could not create repo: {repo_data}")
                    continue

        # Assign repo to team (idempotent)
        status, body = add_team_repo(session, team_id, course_name, repo_name)
        if status == 204:
            print(f"  OK: Repo '{repo_name}' assigned to team.")
        else:
            print(f"  WARN: Assign repo to team (HTTP {status}) {body}")

        # Add students to team, ensure each student is only in this team
        for student_id in members:
            # Remove from other teams first
            for t in other_teams:
                if t["name"] == team_name:
                    continue
                if student_id in get_team_members(session, t["id"]):
                    rm_status, _ = remove_team_member(session, t["id"], student_id)
                    if rm_status == 204:
                        print(f"  FIXED: Removed {student_id} from wrong team '{t['name']}'.")
                    else:
                        print(f"  WARN: Could not remove {student_id} from team '{t['name']}'.")

            # Add to correct team
            status, body = add_team_member(session, team_id, student_id)
            if status == 204:
                print(f"  OK: {student_id} added to team.")
            else:
                print(f"  WARN: {student_id} (HTTP {status}) {body}")

    print("\nDone.")


if __name__ == "__main__":
    main()
