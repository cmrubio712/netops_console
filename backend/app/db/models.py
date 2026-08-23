from sqlalchemy import (
    Column, Integer, BigInteger, String, Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()


class Target(Base):
    __tablename__ = "targets"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    url = Column(String(512), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    uptime_checks = relationship("UptimeCheck", back_populates="target")
    ssl_certs = relationship("SslCert", back_populates="target")
    whois_records = relationship("DomainWhois", back_populates="target")


class UptimeCheck(Base):
    __tablename__ = "uptime_checks"

    id = Column(Integer, primary_key=True)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False, index=True)
    checked_at = Column(DateTime, server_default=func.now(), index=True)
    http_status = Column(Integer)
    is_up = Column(Boolean, nullable=False)
    dns_ms = Column(Integer)
    connect_ms = Column(Integer)
    tls_ms = Column(Integer)
    ttfb_ms = Column(Integer)
    total_ms = Column(Integer)
    error = Column(String(512))

    target = relationship("Target", back_populates="uptime_checks")


class SslCert(Base):
    __tablename__ = "ssl_certs"

    id = Column(Integer, primary_key=True)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False, index=True)
    checked_at = Column(DateTime, server_default=func.now(), index=True)
    issuer = Column(String(255))
    not_before = Column(DateTime)
    not_after = Column(DateTime)
    days_remaining = Column(Integer)
    protocol = Column(String(32))
    cipher = Column(String(128))

    target = relationship("Target", back_populates="ssl_certs")


class DomainWhois(Base):
    __tablename__ = "domain_whois"

    id = Column(Integer, primary_key=True)
    target_id = Column(Integer, ForeignKey("targets.id"), nullable=False, index=True)
    checked_at = Column(DateTime, server_default=func.now(), index=True)
    registrar = Column(String(255))
    expires_at = Column(DateTime)
    days_remaining = Column(Integer)

    target = relationship("Target", back_populates="whois_records")


class GithubRepo(Base):
    __tablename__ = "github_repos"

    id = Column(Integer, primary_key=True)
    full_name = Column(String(255), nullable=False, unique=True)

    deployment_runs = relationship("DeploymentRun", back_populates="repo")


class DeploymentRun(Base):
    __tablename__ = "deployment_runs"

    id = Column(Integer, primary_key=True)
    repo_id = Column(Integer, ForeignKey("github_repos.id"), nullable=False, index=True)
    run_id = Column(BigInteger, nullable=False, unique=True)
    workflow_name = Column(String(255))
    status = Column(String(32))
    conclusion = Column(String(32))
    started_at = Column(DateTime)
    duration_s = Column(Integer)
    html_url = Column(String(512))

    repo = relationship("GithubRepo", back_populates="deployment_runs")
