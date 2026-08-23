export interface Target {
  id: number;
  name: string;
  url: string;
}

export interface UptimeCheck {
  checked_at: string;
  http_status: number | null;
  is_up: boolean;
  dns_ms: number | null;
  connect_ms: number | null;
  tls_ms: number | null;
  ttfb_ms: number | null;
  total_ms: number | null;
}

export interface SslEntry {
  target: string;
  issuer: string | null;
  not_after: string | null;
  cert_days_remaining: number | null;
  protocol: string | null;
  cipher: string | null;
  domain_registrar: string | null;
  domain_days_remaining: number | null;
}

export interface DeploymentRun {
  repo: string | null;
  workflow_name: string | null;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  duration_s: number | null;
  html_url: string;
}

export interface Summary {
  uptime_pct_24h: number | null;
  targets_monitored: number;
  next_cert_expiring: { target_id: number; days_remaining: number } | null;
  next_domain_expiring: { target_id: number; days_remaining: number } | null;
}
