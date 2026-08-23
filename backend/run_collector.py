"""Entrypoint invoked by Hostinger's Cron Job Manager every 5-15 min.

Runs uptime/SSL/DNS/WHOIS checks against every configured target and pulls
recent GitHub Actions runs for every configured repo, writing results to
MySQL. Also prunes rows older than RETENTION_DAYS.
"""
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from app.config import TARGETS, GITHUB_REPOS, RETENTION_DAYS
from app.db.models import Base, Target, UptimeCheck, SslCert, DomainWhois, GithubRepo, DeploymentRun
from app.db.session import SessionLocal, engine
from app.collectors.uptime_collector import measure_https_request
from app.collectors.ssl_collector import check_ssl_cert
from app.collectors.whois_collector import check_domain_expiry
from app.collectors.github_collector import fetch_recent_runs


def get_or_create_target(db, name: str, url: str) -> Target:
    target = db.query(Target).filter_by(name=name).first()
    if not target:
        target = Target(name=name, url=url)
        db.add(target)
        db.flush()
    return target


def get_or_create_repo(db, full_name: str) -> GithubRepo:
    repo = db.query(GithubRepo).filter_by(full_name=full_name).first()
    if not repo:
        repo = GithubRepo(full_name=full_name)
        db.add(repo)
        db.flush()
    return repo


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        for entry in TARGETS:
            target = get_or_create_target(db, entry["name"], entry["url"])

            uptime = measure_https_request(entry["url"])
            db.add(UptimeCheck(target_id=target.id, **uptime))

            ssl_info = check_ssl_cert(entry["url"])
            if not ssl_info["error"]:
                db.add(SslCert(target_id=target.id, **{k: v for k, v in ssl_info.items() if k != "error"}))

            whois_info = check_domain_expiry(entry["url"].split("//")[-1])
            if not whois_info["error"]:
                db.add(DomainWhois(target_id=target.id, **{k: v for k, v in whois_info.items() if k != "error"}))

        for full_name in GITHUB_REPOS:
            repo = get_or_create_repo(db, full_name)
            for run_data in fetch_recent_runs(full_name):
                existing = db.query(DeploymentRun).filter_by(run_id=run_data["run_id"]).first()
                if existing:
                    for key, value in run_data.items():
                        setattr(existing, key, value)
                else:
                    db.add(DeploymentRun(repo_id=repo.id, **run_data))

        cutoff = datetime.utcnow() - timedelta(days=RETENTION_DAYS)
        db.query(UptimeCheck).filter(UptimeCheck.checked_at < cutoff).delete()
        db.query(SslCert).filter(SslCert.checked_at < cutoff).delete()
        db.query(DomainWhois).filter(DomainWhois.checked_at < cutoff).delete()

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    run()
