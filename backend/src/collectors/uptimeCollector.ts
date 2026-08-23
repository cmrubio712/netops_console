import * as dns from "dns";
import * as net from "net";
import * as tls from "tls";

export interface UptimeResult {
  http_status: number | null;
  is_up: boolean;
  dns_ms: number | null;
  connect_ms: number | null;
  tls_ms: number | null;
  ttfb_ms: number | null;
  total_ms: number | null;
  error: string | null;
}

const TIMEOUT_MS = 10_000;

/** Manually times each phase of an HTTPS request: DNS, TCP connect, TLS
 * handshake, and time-to-first-byte, rather than blending them behind a
 * single library call.
 */
export function measureHttpsRequest(url: string): Promise<UptimeResult> {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const port = parsed.port ? Number(parsed.port) : 443;
    const path = parsed.pathname + parsed.search || "/";

    const result: UptimeResult = {
      http_status: null,
      is_up: false,
      dns_ms: null,
      connect_ms: null,
      tls_ms: null,
      ttfb_ms: null,
      total_ms: null,
      error: null,
    };

    const start = Date.now();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      result.total_ms = Date.now() - start;
      resolve(result);
    };

    const dnsStart = Date.now();
    dns.lookup(host, (dnsErr, address) => {
      if (dnsErr) {
        result.error = dnsErr.message;
        return finish();
      }
      result.dns_ms = Date.now() - dnsStart;

      const connectStart = Date.now();
      const socket = net.createConnection({ host: address, port, timeout: TIMEOUT_MS });

      socket.once("timeout", () => {
        result.error = "connection timed out";
        socket.destroy();
        finish();
      });
      socket.once("error", (err) => {
        result.error = err.message;
        finish();
      });

      socket.once("connect", () => {
        result.connect_ms = Date.now() - connectStart;

        const tlsStart = Date.now();
        const tlsSocket = tls.connect({ socket, servername: host, timeout: TIMEOUT_MS }, () => {
          result.tls_ms = Date.now() - tlsStart;

          const request =
            `GET ${path} HTTP/1.1\r\n` +
            `Host: ${host}\r\n` +
            `User-Agent: netops-console-collector\r\n` +
            `Connection: close\r\n\r\n`;

          const ttfbStart = Date.now();
          let firstByte = true;
          let buffer = "";

          tlsSocket.on("data", (chunk) => {
            if (firstByte) {
              result.ttfb_ms = Date.now() - ttfbStart;
              firstByte = false;
            }
            if (buffer.length < 16384) buffer += chunk.toString("latin1");
          });

          tlsSocket.once("end", () => {
            const statusLine = buffer.split("\r\n", 1)[0];
            const match = statusLine.match(/HTTP\/\d\.\d\s+(\d+)/);
            if (match) {
              result.http_status = Number(match[1]);
              result.is_up = result.http_status >= 200 && result.http_status < 400;
            }
            finish();
          });

          tlsSocket.write(request);
        });

        tlsSocket.once("timeout", () => {
          result.error = "TLS handshake timed out";
          tlsSocket.destroy();
          finish();
        });
        tlsSocket.once("error", (err) => {
          result.error = err.message;
          finish();
        });
      });
    });
  });
}
