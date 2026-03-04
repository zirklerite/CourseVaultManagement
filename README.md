# Course Vault Management

Python scripts for batch-managing a Gitea instance for teaching: create student accounts, courses, groups, and repos via the Gitea API.

## Typical Workflow

All scripts use `<course_name>` as the argument. CSV files live in the `courses/` folder, named `{course_name}.csv`.

```
1. Create a course
   python scripts/create_course.py 114-2_ExampleCourse

2. Add student accounts (and optionally assign to groups)
   python scripts/add_students.py 114-2_ExampleCourse

3. Create group repos for group projects (optional)
   python scripts/create_repos.py 114-2_ExampleCourse
   python scripts/create_repos.py 114-2_ExampleCourse teacher/GameTemplate

4. Verify everything is set up correctly
   python scripts/check_course.py 114-2_ExampleCourse
   python scripts/check_students.py 114-2_ExampleCourse
   python scripts/check_login.py 114-2_ExampleCourse
   python scripts/check_commits.py 114-2_ExampleCourse
```

## CSV Format

Each CSV file represents **one course** (one Gitea organization).

```
# Course StudentID StudentName Group
# Lines starting with # are ignored
# Format: Course StudentID StudentName [Group]
# Group is optional
# All entries in a file should use the same Course
# Course (organization) and Group must not contain spaces

114-2_ExampleCourse A1234567 StudentA
114-2_ExampleCourse B9876543 StudentB
114-2_ExampleCourse E1234567 StudentE TeamAlpha
114-2_ExampleCourse F1234567 StudentF TeamAlpha
```

| Field | Description |
|---|---|
| Course | Gitea organization name (no spaces) |
| StudentID | Gitea username |
| StudentName | For human reference only |
| Group | Optional. Gitea team name (no spaces). Group name = repo name |

## Scripts

### Setup

| Script | Description |
|---|---|
| `create_course.py <course_name>` | Create a private course |
| `add_students.py <course_name>` | Batch create student accounts, assign to course and groups |
| `create_repos.py <course_name> [template]` | Create group repos (blank or from template), assign to groups |
| `reset_password.py <course_name> <student_id>` | Reset a student's password to default (reversed ID), must change on next login |

### Inspection

| Script | Description |
|---|---|
| `check_course.py <course_name>` | Display course details: visibility, groups, repos, students |
| `check_students.py <course_name>` | Verify each student's account, course membership, and group placement |
| `check_login.py <course_name>` | Show students who have never signed into Gitea |
| `check_commits.py <course_name> [group]` | Show groups where no student has committed yet. Supports alias files |
| `list_courses.py` | List all courses |
| `list_repos.py <course_name>` | List repos in a course with clone URLs |
| `list_templates.py` | List available template repos for `create_repos` |

## How It Works

### Student Accounts (`add_students.py`)

- Creates accounts with **reversed student ID** as the default password
- Email: `{StudentID}@mail.shu.edu.tw`
- Accounts are set to `visibility: limited` and `restricted: true`
- `must_change_password: true` - students must reset on first login
- Existing accounts are skipped; visibility/restricted settings are auto-fixed

### Group Repos (`create_repos.py`)

Each group gets its own private repo. Groups can only access their own repo.

```
Course: 114-2_ExampleCourse (private)
+-- Group: TeamAlpha   ->  Repo: TeamAlpha
|   +-- A1234567
|   +-- B9876543
+-- Group: TeamBeta    ->  Repo: TeamBeta
    +-- C1122334
```

- Repos can be created blank or from a template (`owner/repo`)
- Within one course, a student belongs to exactly one group (auto-corrected)
- A student may belong to groups in different courses (different CSVs)

### Commit Checking (`check_commits.py`)

Checks whether group repos have any non-admin commits. Commits are identified by
comparing the git author against Owners team members and admin emails.

Students may commit with a personal git account (different name/email) that Gitea
cannot link to their student account. To handle this, create an alias file named
`courses/{course_name}.aliases.csv`:

```
# Git email to StudentID mapping
# Format: git_email student_id
someone@gmail.com A1234567
another@example.com B9876543
```

The script loads this file automatically if it exists. Unresolved authors are
reported as "unknown git authors" at the end of the output.

## Configuration

### `.env` file

Create a `.env` file in the project root:

```
GITEA_URL=http://localhost:3000
GITEA_ADMIN_USER=admin
GITEA_ADMIN_PASS=your_password
```

| Variable | Description |
|---|---|
| `GITEA_URL` | Base URL of the Gitea instance |
| `GITEA_ADMIN_USER` | Admin account username with API access |
| `GITEA_ADMIN_PASS` | Admin account password |

If `.env` is not present, credentials are prompted interactively. The `.env` file is gitignored.

### Requirements

- Python 3
- `requests` (`pip install requests`)
