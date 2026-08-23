from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import Target, UptimeCheck, SslCert, DomainWhois
from app.db.session import get_db

router = APIRouter()


@router.get("/targets")
def list_targets(db: Session = Depends(get_db)):
    targets = db.query(Target).all()
    return [{"id": t.id, "name": t.name, "url": t.url} for t in targets]


@router.get("/uptime")
def uptime_history(target: str, range: str = "24h", db: Session = Depends(get_db)):
    hours = {"24h": 24, "7d": 24 * 7, "30d": 24 * 30}.get(range, 24)
    since = datetime.utcnow() - timedelta(hours=hours)

    checks = (
        db.query(UptimeCheck)
        .join(Target)
        .filter(Target.name == target, UptimeCheck.checked_at >= since)
        .order_by(UptimeCheck.checked_at.asc())
        .all()
    )
    return [
        {
            "checked_at": c.checked_at.isoformat(),
            "http_status": c.http_status,
            "is_up": c.is_up,
            "dns_ms": c.dns_ms,
            "connect_ms": c.connect_ms,
            "tls_ms": c.tls_ms,
            "ttfb_ms": c.ttfb_ms,
            "total_ms": c.total_ms,
        }
        for c in checks
    ]


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(hours=24)
    targets = db.query(Target).all()

    overall_up = overall_total = 0
    for t in targets:
        total = db.query(func.count(UptimeCheck.id)).filter(
            UptimeCheck.target_id == t.id, UptimeCheck.checked_at >= since
        ).scalar()
        up = db.query(func.count(UptimeCheck.id)).filter(
            UptimeCheck.target_id == t.id, UptimeCheck.checked_at >= since, UptimeCheck.is_up.is_(True)
        ).scalar()
        overall_total += total
        overall_up += up

    uptime_pct = round((overall_up / overall_total) * 100, 2) if overall_total else None

    next_cert = (
        db.query(SslCert).order_by(SslCert.days_remaining.asc()).first()
    )
    next_domain = (
        db.query(DomainWhois).order_by(DomainWhois.days_remaining.asc()).first()
    )

    return {
        "uptime_pct_24h": uptime_pct,
        "targets_monitored": len(targets),
        "next_cert_expiring": {
            "target_id": next_cert.target_id,
            "days_remaining": next_cert.days_remaining,
        } if next_cert else None,
        "next_domain_expiring": {
            "target_id": next_domain.target_id,
            "days_remaining": next_domain.days_remaining,
        } if next_domain else None,
    }
