import socket
import time


def resolve(host: str) -> dict:
    result = {"a_records": [], "resolution_ms": None, "error": None}
    try:
        t0 = time.perf_counter()
        addr_info = socket.getaddrinfo(host, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        result["resolution_ms"] = round((time.perf_counter() - t0) * 1000)
        result["a_records"] = sorted({info[4][0] for info in addr_info})
    except Exception as exc:
        result["error"] = str(exc)[:512]
    return result
