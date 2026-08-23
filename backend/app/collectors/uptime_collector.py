import socket
import ssl
import time
from urllib.parse import urlparse


def measure_https_request(url: str, timeout: float = 10.0) -> dict:
    """Manually time each phase of an HTTPS request: DNS, TCP connect,
    TLS handshake, and time-to-first-byte, rather than relying on a
    library that hides the handshake behind one blended latency number.
    """
    parsed = urlparse(url)
    host = parsed.hostname
    port = parsed.port or 443
    path = parsed.path or "/"
    if parsed.query:
        path += f"?{parsed.query}"

    result = {
        "http_status": None,
        "is_up": False,
        "dns_ms": None,
        "connect_ms": None,
        "tls_ms": None,
        "ttfb_ms": None,
        "total_ms": None,
        "error": None,
    }

    start = time.perf_counter()
    sock = None
    try:
        t0 = time.perf_counter()
        addr_info = socket.getaddrinfo(host, port, socket.AF_UNSPEC, socket.SOCK_STREAM)
        result["dns_ms"] = round((time.perf_counter() - t0) * 1000)
        ip = addr_info[0][4][0]

        t0 = time.perf_counter()
        sock = socket.create_connection((ip, port), timeout=timeout)
        result["connect_ms"] = round((time.perf_counter() - t0) * 1000)

        t0 = time.perf_counter()
        ctx = ssl.create_default_context()
        tls_sock = ctx.wrap_socket(sock, server_hostname=host)
        result["tls_ms"] = round((time.perf_counter() - t0) * 1000)

        request = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}\r\n"
            f"User-Agent: netops-console-collector\r\n"
            f"Connection: close\r\n\r\n"
        ).encode()
        tls_sock.settimeout(timeout)

        t0 = time.perf_counter()
        tls_sock.sendall(request)
        first_byte = tls_sock.recv(1)
        result["ttfb_ms"] = round((time.perf_counter() - t0) * 1000)

        rest = b""
        while True:
            chunk = tls_sock.recv(4096)
            if not chunk:
                break
            rest += chunk
            if len(rest) > 16384:
                break
        tls_sock.close()

        status_line = (first_byte + rest).split(b"\r\n", 1)[0]
        result["http_status"] = int(status_line.split()[1])
        result["is_up"] = 200 <= result["http_status"] < 400

    except Exception as exc:
        result["error"] = str(exc)[:512]
        result["is_up"] = False
        if sock:
            try:
                sock.close()
            except OSError:
                pass

    result["total_ms"] = round((time.perf_counter() - start) * 1000)
    return result
