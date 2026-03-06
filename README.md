# Course Vault Management

Svelte 5 SPA + CLI scripts for batch-managing a Gitea instance for teaching: create student accounts, courses, groups, and repos via the Gitea API.

## Quick Start

```
pnpm install
pnpm dev          # start dev server (SPA + CSV API)
pnpm build        # build static files to dist/
pnpm preview      # serve built files + CSV API
```

## Architecture

- **Svelte 5 SPA** with Vite, Tailwind CSS v4, hash-based routing
- **Vite plugin** (`vite-plugin-csv-api.js`) serves CSV file API routes during dev/preview
- **Gitea API** called directly from browser (credentials via `import.meta.env`)
- **CLI scripts** in TypeScript, run with `tsx`

```
CourseVaultManagement/
  src/                    # Svelte 5 SPA (TypeScript)
    lib/                  # router, API client, Gitea client
    pages/                # Landing, Course, Groups
    components/           # Nav, CourseCard, Badge, TeamChip
  scripts/                # CLI scripts (TypeScript, run with tsx)
    config.ts             # dotenv, credentials
    gitea_api.ts          # shared Gitea API helpers
    *.ts                  # individual commands
  csv_manager.ts          # shared CSV read/write (used by plugin + CLI)
  vite-plugin-csv-api.js  # Vite plugin for CSV API routes
  courses/                # CSV data files
```

## Typical Workflow

All scripts use `<course_name>` as the argument. CSV files live in the `courses/` folder, named `{course_name}.csv`.

```
1. Create a course
   npx tsx scripts/create_course.ts 114-2_ExampleCourse

2. Add student accounts (and optionally assign to groups)
   npx tsx scripts/add_students.ts 114-2_ExampleCourse

3. Create group repos for group projects (optional)
   npx tsx scripts/create_repos.ts 114-2_ExampleCourse
   npx tsx scripts/create_repos.ts 114-2_ExampleCourse teacher/GameTemplate

4. Verify everything is set up correctly
   npx tsx scripts/check_course.ts 114-2_ExampleCourse
   npx tsx scripts/check_students.ts 114-2_ExampleCourse
   npx tsx scripts/check_login.ts 114-2_ExampleCourse
   npx tsx scripts/check_commits.ts 114-2_ExampleCourse
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
| `create_course.ts <course_name>` | Create a private course |
| `add_students.ts <course_name>` | Batch create student accounts, assign to course and groups |
| `create_repos.ts <course_name> [template]` | Create group repos (blank or from template), assign to groups |
| `reset_password.ts <course_name> <student_id>` | Reset a student's password to default (reversed ID), must change on next login |

### Inspection

| Script | Description |
|---|---|
| `check_course.ts <course_name>` | Display course details: visibility, groups, repos, students |
| `check_students.ts <course_name>` | Verify each student's account, course membership, and group placement |
| `check_login.ts <course_name>` | Show students who have never signed into Gitea |
| `check_commits.ts <course_name> [group]` | Show groups where no student has committed yet. Supports alias files |
| `list_courses.ts` | List all courses |
| `list_repos.ts <course_name>` | List repos in a course with clone URLs |
| `list_templates.ts` | List available template repos for `create_repos` |

## How It Works

### Student Accounts (`add_students.ts`)

- Creates accounts with **reversed student ID** as the default password
- Email: `{StudentID}@mail.shu.edu.tw`
- Accounts are set to `visibility: limited` and `restricted: true`
- `must_change_password: true` - students must reset on first login
- Existing accounts are skipped; visibility/restricted settings are auto-fixed

### Group Repos (`create_repos.ts`)

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

### Commit Checking (`check_commits.ts`)

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

## Web Dashboard

The SPA provides three pages:

- **Landing** (`#/`) — course list with student/group counts
- **Course** (`#/course/:name`) — roster grouped by team, with live Gitea login status
- **Groups** (`#/course/:name/groups`) — create groups, assign/remove students, toggle active/inactive

## Configuration

### `.env` file

Create a `.env` file in the project root:

```
GITEA_URL=http://localhost:3000
GITEA_ADMIN_USER=admin
GITEA_ADMIN_PASS=your_password

# Browser-accessible (Vite exposes VITE_ prefixed vars)
VITE_GITEA_URL=http://localhost:3000
VITE_GITEA_ADMIN_USER=admin
VITE_GITEA_ADMIN_PASS=your_password
```

| Variable | Description |
|---|---|
| `GITEA_URL` | Base URL of the Gitea instance (used by CLI scripts) |
| `GITEA_ADMIN_USER` | Admin account username with API access |
| `GITEA_ADMIN_PASS` | Admin account password |
| `VITE_GITEA_*` | Same values, exposed to the browser SPA |

If `.env` is not present, CLI credentials are prompted interactively. The `.env` file is gitignored.

### Requirements

- Node.js 20+
- pnpm
