"""
Shared configuration for Gitea automation scripts.
Reads from .env file if present, falls back to interactive prompt.
"""

import os
import getpass


def load_env():
    """Load .env file from the project root (parent of scripts/)."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


load_env()

GITEA_URL = os.environ.get("GITEA_URL", "http://localhost:3000")


def get_credentials():
    """Get admin credentials from .env or prompt interactively."""
    admin_user = os.environ.get("GITEA_ADMIN_USER", "")
    admin_pass = os.environ.get("GITEA_ADMIN_PASS", "")

    if not admin_user:
        admin_user = input("Enter Gitea admin username: ")
    else:
        print(f"Using admin user from .env: {admin_user}")

    if not admin_pass:
        admin_pass = getpass.getpass("Enter Gitea admin password: ")
    else:
        print("Using admin password from .env.")

    return admin_user, admin_pass
