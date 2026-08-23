import socket
import ssl
from datetime import datetime
from urllib.parse import urlparse


def check_ssl_cert(url: str, timeout: float = 10.0) -> dict:
    parsed = urlparse(url)
    host = parsed.hostname
    port = parsed.port or 443

    result = {
        "issuer": None,
        "not_before": None,
        "not_after": None,
        "days_remaining": None,
        "protocol": None,
        "cipher": None,
        "error": None,
    }

    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=timeout) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as tls_sock:
                cert = tls_sock.getpeercert()
                result["protocol"] = tls_sock.version()
                cipher = tls_sock.cipher()
                result["cipher"] = cipher[0] if cipher else None

        issuer_parts = dict(x[0] for x in cert.get("issuer", []))
        result["issuer"] = issuer_parts.get("organizationName") or issuer_parts.get("commonName")

        not_before = datetime.strptime(cert["notBefore"], "%b %d %H:%M:%S %Y %Z")
        not_after = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z")
        result["not_before"] = not_before
        result["not_after"] = not_after
        result["days_remaining"] = (not_after - datetime.utcnow()).days

    except Exception as exc:
        result["error"] = str(exc)[:512]

    return result
