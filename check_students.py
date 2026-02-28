"""
Gitea Check Students
Verifies that each student in the CSV:
  - User account exists
  - Belongs to the correct course
  - Is in exactly one team within this course
  - Team name matches its repo name

CSV format ({course_name}.csv): course_name student_id name [team_name]
  113-SophomoreProjects A113080006 XXXX TeamAlpha

Usage:
  python check_students.py <course_name>
  Example: python check_students.py 113-SophomoreProjects
"""

import sys
from config import GITEA_URL, get_credentials
from gitea_api import (
    get_session, get_user_orgs, resolve_csv, parse_csv, validate_single_course,
    get_org_teams_dict, is_team_member, get_team_repos,
)


def main():
    if len(sys.argv) < 2:
        print("Usage: python check_students.py <course_name>")
        sys.exit(1)

    input_file = resolve_csv(sys.argv[1])

    try:
        entries = parse_csv(input_file)
    except FileNotFoundError:
        print(f"Error: File '{input_file}' not found.")
        sys.exit(1)

    if not entries:
        print("Error: No entries found in file.")
        sys.exit(1)

    course_name = validate_single_course(entries)
    print(f"Checking {len(entries)} student(s) in course '{course_name}'...")
    admin_user, admin_pass = get_credentials()
    session = get_session(admin_user, admin_pass)

    # Load all teams in the course once
    all_course_teams = get_org_teams_dict(session, course_name)
    non_owner_teams = {k: v for k, v in all_course_teams.items() if k != "Owners"}

    ok, issues = 0, 0

    for course_name, student_id, team_name in entries:
        errors = []

        # Check user exists
        resp = session.get(f"{GITEA_URL}/api/v1/users/{student_id}")
        if resp.status_code != 200:
            print(f"  FAIL: {student_id} - student does not exist")
            issues += 1
            continue

        user = resp.json()
        # Check visibility and restricted
        if user.get("visibility") != "limited":
            errors.append(f"visibility is '{user.get('visibility')}', expected 'limited'")
        if not user.get("restricted"):
            errors.append("not restricted")

        # Check course membership
        user_orgs = get_user_orgs(session, student_id)
        if user_orgs is None:
            errors.append("could not fetch courses")
        elif course_name not in user_orgs:
            errors.append(f"not in course '{course_name}'")

        # Check team membership
        if team_name:
            team_data = all_course_teams.get(team_name)
            if team_data is None:
                errors.append(f"team '{team_name}' does not exist")
            else:
                team_id = team_data["id"]

                # Check student is in the correct team
                if not is_team_member(session, team_id, student_id):
                    errors.append(f"not in team '{team_name}'")

                # Check student is not in other teams
                for other_name, other_data in non_owner_teams.items():
                    if other_name == team_name:
                        continue
                    if is_team_member(session, other_data["id"], student_id):
                        errors.append(f"also in wrong team '{other_name}'")

                # Check team name matches repo name
                team_repos = get_team_repos(session, team_id)
                if team_name not in team_repos:
                    errors.append(f"team has no matching repo '{team_name}'")
                for r in team_repos:
                    if r != team_name:
                        errors.append(f"team has mismatched repo '{r}'")

        if errors:
            print(f"  FAIL: {student_id} - {'; '.join(errors)}")
            issues += 1
        else:
            label = f" (course: {course_name}, team: {team_name})" if team_name else f" (course: {course_name})"
            print(f"  OK: {student_id}{label}")
            ok += 1

    print(f"\nDone. OK: {ok}, Issues: {issues}")


if __name__ == "__main__":
    main()
