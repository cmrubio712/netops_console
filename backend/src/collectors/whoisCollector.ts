import * as net from "net";

export interface WhoisResult {
  registrar: string | null;
  expires_at: Date | null;
  days_remaining: number | null;
  error: string | null;
}

const IANA_WHOIS = "whois.iana.org";
const TIMEOUT_MS = 10_000;

const EXPIRY_PATTERNS = [
  /Registry Expiry Date:\s*(.+)/i,
  /Expiry Date:\s*(.+)/i,
  /Expiration Date:\s*(.+)/i,
  /paid-till:\s*(.+)/i,
];

function query(server: string, text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: server, port: 43, timeout: TIMEOUT_MS });
    let data = "";

    socket.on("connect", () => socket.write(text + "\r\n"));
    socket.on("data", (chunk) => (data += chunk.toString("utf-8")));
    socket.once("end", () => resolve(data));
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("WHOIS query timed out"));
    });
    socket.once("error", reject);
  });
}

function parseExpiry(text: string): Date | null {
  for (const pattern of EXPIRY_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    const raw = match[1].trim();
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function rootDomain(host: string): string {
  const parts = host.split(".");
  return parts.length >= 2 ? parts.slice(-2).join(".") : host;
}

export async function checkDomainExpiry(host: string): Promise<WhoisResult> {
  const domain = rootDomain(host);
  const result: WhoisResult = {
    registrar: null,
    expires_at: null,
    days_remaining: null,
    error: null,
  };

  try {
    const referral = await query(IANA_WHOIS, domain);
    const serverMatch = referral.match(/whois:\s*(\S+)/i);
    if (!serverMatch) {
      result.error = "no authoritative whois server found";
      return result;
    }

    const record = await query(serverMatch[1], domain);

    const registrarMatch = record.match(/Registrar:\s*(.+)/i);
    if (registrarMatch) result.registrar = registrarMatch[1].trim();

    const expiresAt = parseExpiry(record);
    if (expiresAt) {
      result.expires_at = expiresAt;
      result.days_remaining = Math.floor((expiresAt.getTime() - Date.now()) / 86_400_000);
    } else {
      result.error = "could not parse expiry date from whois response";
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}
