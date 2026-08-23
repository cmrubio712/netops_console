from datetime import datetime

import requests

from app.config import GITHUB_TOKEN

API_BASE = "https://api.github.com"


def fetch_recent_runs(full_name: str, per_page: int = 10) -> list[dict]:
    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    resp = requests.get(
        f"{API_BASE}/repos/{full_name}/actions/runs",
        params={"per_page": per_page},
        headers=headers,
        timeout=15,
    )
    resp.raise_for_status()

    runs = []
    for run in resp.json().get("workflow_runs", []):
        started_at = datetime.strptime(run["run_started_at"], "%Y-%m-%dT%H:%M:%SZ")
        updated_at = datetime.strptime(run["updated_at"], "%Y-%m-%dT%H:%M:%SZ")
        duration_s = int((updated_at - started_at).total_seconds())

        runs.append({
            "run_id": run["id"],
            "workflow_name": run.get("name") or run.get("workflow_id"),
            "status": run["status"],
            "conclusion": run.get("conclusion"),
            "started_at": started_at,
            "duration_s": max(duration_s, 0),
            "html_url": run["html_url"],
        })
    return runs
