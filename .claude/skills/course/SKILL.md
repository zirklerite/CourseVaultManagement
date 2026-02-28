---
name: course
description: Manage courses on Gitea — create courses, add students, create repos, and check status. Use when the user wants to manage their teaching Gitea setup.
argument-hint: <command> <course_name> [extra_args]
allowed-tools: Bash(python:*), Bash(ls:*), Read
---

## Context

Script directory: `G:/Teaching/Students/GitVaultAutomation/scripts`

Available course CSV files:
!`ls -1 G:/Teaching/Students/GitVaultAutomation/*.csv 2>/dev/null | sed 's/.*\///' | sed 's/\.csv$//'`

## Terminology

| This project | Gitea |
|---|---|
| Course | Organization (private) |
| Student | User account (limited, restricted) |
| StudentID | Username |
| Team | Team + Repository (same name) |

## Typical workflow

1. `create_course` — create the Gitea organization
2. `add_students` — create accounts and assign to teams
3. `create_repos` — create team repos (blank or from template)
4. `check_*` / `list_*` — verify setup

## Available commands

| Command | Args | Description |
|---|---|---|
| `create_course` | `<course_name>` | Create a private course |
| `add_students` | `<course_name>` | Batch create student accounts and assign to teams |
| `create_repos` | `<course_name> [owner/template]` | Create team repos (blank or from template) |
| `check_course` | `<course_name>` | Show course details: visibility, teams, repos, students |
| `check_students` | `<course_name>` | Verify student accounts, course membership, team placement |
| `check_login` | `<course_name>` | Show students who never signed into Gitea |
| `check_commits` | `<course_name> [team]` | Show teams with no student commits yet |
| `list_courses` | *(none)* | List all courses |
| `list_repos` | `<course_name>` | List repos with clone URLs |
| `list_templates` | *(none)* | List available template repos for `create_repos` |

## CSV format

File: `{course_name}.csv` in the project root. Whitespace-delimited.

Fields: `CourseName StudentID StudentName [TeamName]`
- `#` lines are comments
- All rows must use the same CourseName
- CourseName and TeamName must not contain spaces
- TeamName is optional (students without teams won't be assigned to any)

Alias file: `{course_name}.aliases.csv` (optional, auto-loaded by `check_commits`)
- Format: `git_email student_id`
- Maps personal git emails to student IDs for commits from unlinked accounts

## Key behaviors

- **Passwords**: reversed student ID (e.g., `A1234567` → `7654321A`)
- **Email**: `{StudentID}@mail.shu.edu.tw`
- **Account settings**: `visibility: limited`, `restricted: true`, `must_change_password: true`
- **Idempotency**: setup scripts are safe to re-run; they skip existing items and auto-fix settings
- **Team constraint**: within one course, a student belongs to exactly one team

## Important rules

- **Never edit CSV files** unless the user explicitly says to do so.
- When output shows FAIL/NEVER/OK, highlight failures clearly to the user.
- When presenting script output, read the CSV file to look up **student names** by StudentID (the scripts only output IDs). Include names alongside IDs in your report to the user.
- If students show "does not exist", suggest running `add_students` first.
- When the user says **"local"** (e.g., "show me the local teams", "check local students"), read directly from the CSV files instead of calling scripts that query the remote Gitea server. For example, "local teams" means parse `{course_name}.csv` and list the team names and members found in the file.

## Your task

The user invoked `/course` with: $ARGUMENTS

1. Determine the **course name**:
   - If the user said "let's work on XXX" or "switch to XXX", set XXX as the current course for all following commands. Confirm: "Working on **XXX**. Using `XXX.csv`."
   - If the command includes a course name explicitly, use it (does NOT change the current course).
   - If no course name is given, use the current course if one is set.
   - If no current course and only one CSV exists, use it.
   - Otherwise, ask.
   - The current course determines which data files are used:
     - `{course_name}.csv` — student/team roster (required)
     - `{course_name}.aliases.csv` — git email mappings (optional, used by `check_commits`)

2. Parse the **command** from the arguments.
   - The first word should match one of the commands above.
   - If the user wrote natural language (e.g., "check login"), infer the correct command.

3. Run the script:
   ```
   python G:/Teaching/Students/GitVaultAutomation/scripts/<command>.py [args]
   ```

4. Present the output clearly. If there are warnings or failures, highlight them.

5. If no command is given or the request is unclear, show the available commands table and the available courses, then ask what the user wants to do.
