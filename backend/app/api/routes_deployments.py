from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.models import DeploymentRun, GithubRepo
from app.db.session import get_db

router = APIRouter()


@router.get("/deployments")
def list_deployments(limit: int = 20, db: Session = Depends(get_db)):
    runs = (
        db.query(DeploymentRun)
        .order_by(DeploymentRun.started_at.desc())
        .limit(limit)
        .all()
    )
    repos = {r.id: r.full_name for r in db.query(GithubRepo).all()}

    return [
        {
            "repo": repos.get(r.repo_id),
            "workflow_name": r.workflow_name,
            "status": r.status,
            "conclusion": r.conclusion,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "duration_s": r.duration_s,
            "html_url": r.html_url,
        }
        for r in runs
    ]
