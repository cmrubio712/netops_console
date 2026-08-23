from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.models import SslCert, DomainWhois, Target
from app.db.session import get_db

router = APIRouter()


@router.get("/ssl")
def list_ssl(db: Session = Depends(get_db)):
    latest_by_target = {}
    for cert in db.query(SslCert).order_by(SslCert.checked_at.desc()).all():
        latest_by_target.setdefault(cert.target_id, cert)

    whois_by_target = {}
    for record in db.query(DomainWhois).order_by(DomainWhois.checked_at.desc()).all():
        whois_by_target.setdefault(record.target_id, record)

    targets = {t.id: t for t in db.query(Target).all()}

    return [
        {
            "target": targets[target_id].name,
            "issuer": cert.issuer,
            "not_after": cert.not_after.isoformat() if cert.not_after else None,
            "cert_days_remaining": cert.days_remaining,
            "protocol": cert.protocol,
            "cipher": cert.cipher,
            "domain_registrar": whois_by_target[target_id].registrar if target_id in whois_by_target else None,
            "domain_days_remaining": whois_by_target[target_id].days_remaining if target_id in whois_by_target else None,
        }
        for target_id, cert in latest_by_target.items()
        if target_id in targets
    ]
