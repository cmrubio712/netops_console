import * as tls from "tls";

export interface SslResult {
  issuer: string | null;
  not_before: Date | null;
  not_after: Date | null;
  days_remaining: number | null;
  protocol: string | null;
  cipher: string | null;
  error: string | null;
}

const TIMEOUT_MS = 10_000;

export function checkSslCert(url: string): Promise<SslResult> {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const port = parsed.port ? Number(parsed.port) : 443;

    const result: SslResult = {
      issuer: null,
      not_before: null,
      not_after: null,
      days_remaining: null,
      protocol: null,
      cipher: null,
      error: null,
    };

    const socket = tls.connect({ host, port, servername: host, timeout: TIMEOUT_MS }, () => {
      const cert = socket.getPeerCertificate();
      result.protocol = socket.getProtocol();
      result.cipher = socket.getCipher()?.name ?? null;
      const org = cert.issuer?.O ?? cert.issuer?.CN ?? null;
      result.issuer = Array.isArray(org) ? org[0] ?? null : org;

      if (cert.valid_from) result.not_before = new Date(cert.valid_from);
      if (cert.valid_to) {
        const notAfter = new Date(cert.valid_to);
        result.not_after = notAfter;
        result.days_remaining = Math.floor((notAfter.getTime() - Date.now()) / 86_400_000);
      }

      socket.end();
      resolve(result);
    });

    socket.once("timeout", () => {
      result.error = "connection timed out";
      socket.destroy();
      resolve(result);
    });
    socket.once("error", (err) => {
      result.error = err.message;
      resolve(result);
    });
  });
}
