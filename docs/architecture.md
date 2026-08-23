# NetOps Console — Architecture

Public observability dashboard for personal infrastructure + GitHub Actions pipelines.
Portfolio goal: demonstrate real full-stack + DevOps + networking chops, not a status-page clone.

## Constraints

- $0 infra cost — runs entirely on an existing Hostinger shared/business hosting plan + GitHub (free tier).
- Angular frontend, Python backend, GitHub Actions CI/CD.

## Key decisions

### Backend: Python (FastAPI)

Hostinger shared hosting does not run a persistent JVM process — Java/Spring Boot would require a VPS plan.
Python has first-class support via hPanel's "Setup Python App" (runs under Phusion Passenger). FastAPI gives
a typed JSON API with minimal boilerplate.

### Database: MySQL

Included free with the Hostinger plan. Dataset stays tiny (handful of targets, checks every 5–15 min,
history pruned after ~90 days).

### Collection: cron on Hostinger, not GitHub Actions

The collector script runs via hPanel Cron Jobs directly on the hosting box, on the same host as MySQL.

Rejected alternative: polling from a GitHub Actions scheduled workflow that writes to MySQL. Rejected because:
- MySQL would need to be reachable from GitHub's dynamic runner IPs — meaning opening it to the public
  internet, which is a bad look on a public infra project.
- Scheduled GitHub Actions workflows on free/public repos are throttled/delayed and auto-disabled after
  60 days of repo inactivity — not reliable as the primary monitoring loop.

GitHub Actions is used only for CI/CD (build + deploy), which is the actual DevOps skill being demonstrated.

### Why this stays $0

Everything runs on infrastructure already owned (Hostinger plan, GitHub). The only external dependency is
the GitHub REST API (free, 5000 req/hr authenticated — trivial at this polling cadence).

## Networking angle (differentiator from generic status pages)

- **SSL cert expiry** — issuer, negotiated protocol/cipher, days remaining. Uses Python `ssl`/`socket`
  directly rather than a library that hides the handshake.
- **DNS resolution** — record type, resolved IP, resolution latency per target.
- **Latency waterfall** — DNS lookup / TCP connect / TLS handshake / TTFB tracked separately, not blended
  into one number.
- **HTTP security posture** — presence of HSTS, CSP, X-Frame-Options, graded.
- **Domain expiry (WHOIS)** — same shape as cert expiry; cheap to add, real operational value.
- **Traceroute/ICMP** — likely blocked on shared hosting (no raw socket access). Skipped for v1 rather than
  promising something the host won't allow. Revisit only if a VPS enters the picture.

## Data model (MySQL)

```
targets            (id, name, url, created_at)
uptime_checks       (id, target_id, checked_at, http_status, is_up,
                     dns_ms, connect_ms, tls_ms, ttfb_ms, total_ms)
ssl_certs           (id, target_id, checked_at, issuer, not_after,
                     days_remaining, protocol, cipher)
domain_whois        (id, target_id, checked_at, registrar, expires_at, days_remaining)
github_repos        (id, full_name)
deployment_runs     (id, repo_id, run_id, workflow_name, status,
                     conclusion, started_at, duration_s, html_url)
```

Cron job prunes rows older than ~90 days to keep the DB small.

## API (read-only, public)

```
GET /api/summary        -> overall uptime %, next cert/domain expiring, open incidents
GET /api/targets
GET /api/uptime?target=&range=24h
GET /api/ssl
GET /api/deployments?limit=20
```

## Repo layout

```
netops-console/
├── .github/workflows/
│   ├── frontend-deploy.yml   # build Angular, ship dist/ to Hostinger
│   ├── backend-deploy.yml    # sync backend/, touch restart.txt for Passenger
│   └── ci.yml                 # lint + tests on PRs
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app + CORS
│   │   ├── api/routes_*.py
│   │   ├── collectors/
│   │   │   ├── uptime_collector.py
│   │   │   ├── ssl_collector.py
│   │   │   ├── dns_collector.py
│   │   │   ├── whois_collector.py
│   │   │   └── github_collector.py
│   │   ├── db/{models.py,session.py}
│   │   └── config.py                # targets + repos list, env-driven
│   ├── run_collector.py             # entrypoint the Hostinger cron calls
│   ├── passenger_wsgi.py            # Passenger entrypoint for the API
│   └── requirements.txt
├── frontend/
│   └── src/app/
│       ├── core/services/api.service.ts
│       ├── features/dashboard/
│       ├── features/uptime-panel/
│       ├── features/ssl-panel/
│       ├── features/deployments-feed/
│       └── shared/models/
├── docs/architecture.md
└── README.md
```

## Deploy flow

- **Frontend**: Angular builds to `dist/`; GitHub Actions deploys via FTP/SFTP to a subdomain doc root
  (e.g. `status.yourdomain.com`).
- **Backend**: GitHub Actions syncs `backend/` to the Python App directory, then touches Passenger's
  `restart.txt` to trigger a reload.
- **Secrets**: GitHub PAT (Actions read scope) and DB credentials live as env vars in Hostinger's app
  config, never committed. Deploy credentials (FTP/SSH) live as GitHub Actions repo secrets.

## Frontend structure

Standalone Angular components (no NgModules). `DashboardComponent` composes `UptimePanel`, `SslPanel`,
`DeploymentsFeed`, each backed by a shared `ApiService` (`HttpClient` + RxJS, polling every 60s). Dark,
minimal "network operations center" styling rather than a generic dashboard template.

## Confirmed hosting details

- Plan is Hostinger **Business Web Hosting** (shared hosting tier, managed via hPanel) — confirmed. The
  architecture above (Python via Passenger, MySQL, hPanel Cron Jobs) applies as designed; no VPS/root
  access, so Java/Spring Boot is not an option here.
- Business tier includes **SSH access**, so deploy can use SFTP/rsync from GitHub Actions rather than
  plain FTP.
