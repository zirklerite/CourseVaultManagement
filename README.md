# GitVaultAutomation

Python scripts for batch-managing a Gitea instance for teaching: create student accounts, organizations, teams, and repositories via the Gitea API.

## Typical Workflow

```
1. Create an organization for the course
   python create_org.py 114-2_ExampleCourse

2. Add student accounts (and optionally assign to teams)
   python add_students.py students_example.csv

3. Create team repos for group projects (optional)
   python create_repos.py students_example.csv
   python create_repos.py students_example.csv teacher/GameTemplate

4. Verify everything is set up correctly
   python check_org.py 114-2_ExampleCourse
   python check_students.py students_example.csv
```

## CSV Format

Each CSV file represents **one class/course** (one Gitea organization).

```
# CourseName StudentID StudentName GroupName
# Lines starting with # are ignored
# Format: CourseName StudentID StudentName [GroupName]
# GroupName is optional
# All entries in a file should use the same CourseName
# CourseName (organization) and GroupName (team) must not contain spaces

114-2_ExampleCourse A1234567 StudentA
114-2_ExampleCourse B9876543 StudentB
114-2_ExampleCourse E1234567 StudentE TeamAlpha
114-2_ExampleCourse F1234567 StudentF TeamAlpha
```

| Field | Description |
|---|---|
| CourseName | Gitea organization name (no spaces) |
| StudentID | Gitea username |
| StudentName | For human reference only |
| GroupName | Optional. Gitea team name (no spaces). Team name = repo name |

## Scripts

### Setup

| Script | Description |
|---|---|
| `create_org.py <org_name>` | Create a private organization |
| `add_students.py <csv>` | Batch create student accounts, assign to org and teams |
| `create_repos.py <csv> [template]` | Create team repos (blank or from template), assign to teams |

### Inspection

| Script | Description |
|---|---|
| `check_org.py <org_name>` | Display org details: visibility, teams, repos, members |
| `check_students.py <csv>` | Verify each student's account, org membership, and team placement |
| `list_orgs.py` | List all organizations |
| `list_repos.py <org_name>` | List repos in an organization with clone URLs |

## How It Works

### Student Accounts (`add_students.py`)

- Creates accounts with **reversed student ID** as the default password
- Email: `{StudentID}@mail.shu.edu.tw`
- Accounts are set to `visibility: limited` and `restricted: true`
- `must_change_password: true` - students must reset on first login
- Existing accounts are skipped; visibility/restricted settings are auto-fixed

### Team Repos (`create_repos.py`)

Each team gets its own private repo. Teams can only access their own repo.

```
Organization: 114-2_ExampleCourse (private)
├── Team: TeamAlpha   →  Repo: TeamAlpha
│   ├── A1234567
│   └── B9876543
└── Team: TeamBeta    →  Repo: TeamBeta
    └── C1122334
```

- Repos can be created blank or from a template (`owner/repo`)
- Within one org, a student belongs to exactly one team (auto-corrected)
- A student may belong to teams in different organizations (different CSVs)

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
