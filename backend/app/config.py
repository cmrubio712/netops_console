import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "mysql+pymysql://user:password@localhost/netops_console"
)
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
CORS_ORIGINS = [o.strip() for o in os.environ.get(
    "CORS_ORIGINS", "https://status.cmrubio.com"
).split(",") if o.strip()]

RETENTION_DAYS = int(os.environ.get("RETENTION_DAYS", "90"))

# Sites/subdomains to monitor. Edit this list to match real infrastructure.
TARGETS = [
    {"name": "cmrubio.com", "url": "https://cmrubio.com"},
    {"name": "status.cmrubio.com", "url": "https://status.cmrubio.com"},
]

# Repos to pull GitHub Actions run history from, "owner/repo" format.
GITHUB_REPOS = [
    "cmrubio712/netops_console",
]
