import re
import socket
from datetime import datetime
from typing import Optional

IANA_WHOIS = "whois.iana.org"
EXPIRY_PATTERNS = [
    r"Registry Expiry Date:\s*(.+)",
    r"Expiry Date:\s*(.+)",
    r"Expiration Date:\s*(.+)",
    r"paid-till:\s*(.+)",
]


def _query(server: str, query: str, timeout: float = 10.0) -> str:
    with socket.create_connection((server, 43), timeout=timeout) as sock:
        sock.sendall((query + "\r\n").encode())
        chunks = []
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            chunks.append(chunk)
    return b"".join(chunks).decode(errors="ignore")


def _parse_expiry(text: str) -> Optional[datetime]:
    for pattern in EXPIRY_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue
        raw = match.group(1).strip()
        for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d", "%d-%b-%Y", "%Y.%m.%d"):
            try:
                return datetime.strptime(raw, fmt)
            except ValueError:
                continue
    return None


def _root_domain(host: str) -> str:
    parts = host.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def check_domain_expiry(host: str, timeout: float = 10.0) -> dict:
    domain = _root_domain(host)
    result = {"registrar": None, "expires_at": None, "days_remaining": None, "error": None}

    try:
        referral = _query(IANA_WHOIS, domain, timeout)
        server_match = re.search(r"whois:\s*(\S+)", referral, re.IGNORECASE)
        if not server_match:
            result["error"] = "no authoritative whois server found"
            return result

        record = _query(server_match.group(1), domain, timeout)

        registrar_match = re.search(r"Registrar:\s*(.+)", record, re.IGNORECASE)
        if registrar_match:
            result["registrar"] = registrar_match.group(1).strip()

        expires_at = _parse_expiry(record)
        if expires_at:
            result["expires_at"] = expires_at
            result["days_remaining"] = (expires_at - datetime.utcnow()).days
        else:
            result["error"] = "could not parse expiry date from whois response"

    except Exception as exc:
        result["error"] = str(exc)[:512]

    return result
