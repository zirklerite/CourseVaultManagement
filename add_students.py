"""
Gitea Batch Add Students
Reads student IDs from a CSV file.
Creates Gitea accounts with reversed ID as default password.
If the CSV has a team column, ensures the team exists in the org and adds the student.
Within one organization, a student belongs to exactly one team;
removes from wrong teams if needed.
A student may belong to teams in different organizations (different class CSVs).

CSV format: org_name student_id name [team_name]
  113-SophomoreProjects A113080006 XXXX TeamAlpha
  113-SophomoreProjects A113080036 YYYY TeamAlpha

Usage:
  python add_students.py <students.csv>
  Example: python add_students.py students_113-SophomoreProjects.csv
"""

import sys
from config import GITEA_URL, get_credentials
from gitea_api import (
    get_session, user_exists, parse_csv, validate_single_org,
    ensure_team, get_all_teams, get_team_members,
    add_team_member, remove_team_member,
)


def create_user(session, student_id, password):
    resp = session.post(
        f"{GITEA_URL}/api/v1/admin/users",
        json={
            "username": student_id,
            "password": password,
            "email": f"{student_id}@mail.shu.edu.tw",
            "must_change_password": True,
            "visibility": "limited",
            "restricted": True,
        },
    )
    return resp.status_code, resp.text


def main():
    if len(sys.argv) < 2:
        print("Usage: python add_students.py <students.csv>")
        sys.exit(1)

    input_file = sys.argv[1]

    try:
        entries = parse_csv(input_file)
    except FileNotFoundError:
        print(f"Error: File '{input_file}' not found.")
        sys.exit(1)

    if not entries:
        print("Error: No student IDs found in file.")
        sys.exit(1)

    org_name_global = validate_single_org(entries)
    print(f"Found {len(entries)} student(s) in org '{org_name_global}'.")
    admin_user, admin_pass = get_credentials()
    session = get_session(admin_user, admin_pass)

    # Verify organization exists if teams are involved
    has_teams = any(team for _, _, team in entries)
    if has_teams:
        resp = session.get(f"{GITEA_URL}/api/v1/orgs/{org_name_global}")
        if resp.status_code != 200:
            print(f"Error: Organization '{org_name_global}' does not exist.")
            print(f"  Create it first: python create_org.py {org_name_global}")
            sys.exit(1)

    # Get all existing teams for membership cleanup
    other_teams = get_all_teams(session, org_name_global) if has_teams else []

    created, skipped, failed = 0, 0, 0
    team_cache = {}  # team_name -> team_id

    for org_name, sid, team_name in entries:
        # Create user or skip if exists
        if user_exists(session, sid):
            print(f"  SKIP: {sid} already exists.")
            skipped += 1
            # Verify visibility and restricted settings
            resp = session.get(f"{GITEA_URL}/api/v1/users/{sid}")
            if resp.status_code == 200:
                user = resp.json()
                fixes = {}
                if user.get("visibility") != "limited":
                    fixes["visibility"] = "limited"
                if not user.get("restricted"):
                    fixes["restricted"] = True
                if fixes:
                    fixes["login_name"] = sid
                    fixes["source_id"] = user.get("source_id", 0)
                    patch = session.patch(
                        f"{GITEA_URL}/api/v1/admin/users/{sid}",
                        json=fixes,
                    )
                    if patch.status_code == 200:
                        fixes.pop("login_name", None)
                        fixes.pop("source_id", None)
                        print(f"    FIXED: {', '.join(f'{k}={v}' for k, v in fixes.items())}")
                    else:
                        print(f"    WARN: Could not update user settings (HTTP {patch.status_code}) {patch.text}")
        else:
            password = sid[::-1]
            status, body = create_user(session, sid, password)
            if status == 201:
                print(f"  OK: {sid} created.")
                created += 1
            else:
                print(f"  FAIL: {sid} (HTTP {status}) {body}")
                failed += 1
                continue

        # Handle team membership if team name provided
        if team_name:
            if team_name not in team_cache:
                result, data = ensure_team(session, org_name, team_name)
                if result in ("created", "exists"):
                    team_cache[team_name] = data["id"]
                    label = "created" if result == "created" else "exists"
                    print(f"    Team '{org_name}/{team_name}' {label} (ID: {data['id']}).")
                else:
                    print(f"    FAIL: Could not create/get team '{team_name}': {data}")
                    continue

            team_id = team_cache[team_name]

            # Remove from wrong teams (student should only be in one team)
            for t in other_teams:
                if t["name"] == team_name:
                    continue
                if sid in get_team_members(session, t["id"]):
                    status, _ = remove_team_member(session, t["id"], sid)
                    if status == 204:
                        print(f"    FIXED: Removed {sid} from wrong team '{t['name']}'.")
                    else:
                        print(f"    WARN: Could not remove {sid} from team '{t['name']}'.")

            status, _ = add_team_member(session, team_id, sid)
            if status == 204:
                print(f"    OK: {sid} added to team '{team_name}'.")
            else:
                print(f"    WARN: Could not add {sid} to team '{team_name}'.")

    print(f"\nDone. Created: {created}, Skipped: {skipped}, Failed: {failed}")


if __name__ == "__main__":
    main()
