export interface SecurityHeadersResult {
  hsts: boolean;
  hsts_max_age: number | null;
  csp: boolean;
  x_frame_options: string | null;
  x_content_type_options: string | null;
  referrer_policy: string | null;
  permissions_policy: boolean;
  score: number | null;
  grade: string | null;
  error: string | null;
}

const TIMEOUT_MS = 10_000;
const CORE_HEADERS = 5;

/** Grades the presence of the core response headers that guard against
 * clickjacking, MIME-sniffing, protocol downgrade, and referrer leakage —
 * the same signals sites like securityheaders.com check for.
 */
function gradeFor(present: number): string {
  if (present >= 5) return "A";
  if (present === 4) return "B";
  if (present === 3) return "C";
  if (present === 2) return "D";
  return "F";
}

export async function checkSecurityHeaders(url: string): Promise<SecurityHeadersResult> {
  const result: SecurityHeadersResult = {
    hsts: false,
    hsts_max_age: null,
    csp: false,
    x_frame_options: null,
    x_content_type_options: null,
    referrer_policy: null,
    permissions_policy: false,
    score: null,
    grade: null,
    error: null,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "netops-console-collector" },
    });

    const hsts = response.headers.get("strict-transport-security");
    if (hsts) {
      result.hsts = true;
      const maxAgeMatch = hsts.match(/max-age=(\d+)/i);
      if (maxAgeMatch) result.hsts_max_age = Number(maxAgeMatch[1]);
    }

    result.csp = response.headers.has("content-security-policy");
    result.x_frame_options = response.headers.get("x-frame-options");
    result.x_content_type_options = response.headers.get("x-content-type-options");
    result.referrer_policy = response.headers.get("referrer-policy");
    result.permissions_policy = response.headers.has("permissions-policy");

    const present = [
      result.hsts,
      result.csp,
      Boolean(result.x_frame_options),
      Boolean(result.x_content_type_options),
      Boolean(result.referrer_policy),
    ].filter(Boolean).length;

    result.score = Math.round((present / CORE_HEADERS) * 100);
    result.grade = gradeFor(present);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timeout);
  }

  return result;
}
