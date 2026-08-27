# NetOps Console — Architecture

Public observability dashboard for personal infrastructure + GitHub Actions pipelines.
Portfolio goal: demonstrate real full-stack + DevOps + networking chops, not a status-page clone.

## Constraints

- $0 infra cost — runs entirely on an existing Hostinger Business Web Hosting plan + GitHub (free tier).
- Angular frontend, GitHub Actions CI/CD.

## Key decisions

### Backend: Node.js (Express) + TypeScript — not Python

Original plan was FastAPI under Passenger, matching the stated Python backend background. That plan doesn't
work: Hostinger's own docs (checked directly, not from memory) state that Python, Django, Flask, and Java all
require **root access**, which Business Web Hosting doesn't grant — they're VPS-only. There's no Passenger
Python path on this plan; it was never going to run.

Node.js, by contrast, is natively supported on Business Web Hosting with a real deploy pipeline: a managed
"Web App" slot in hPanel, GitHub-connected auto-builds, and a REST API for programmatic deploys (`Generate
upload URL` → upload archive → `Start Node.js build`). Express is in Hostinger's auto-detected framework
list. This keeps the $0 constraint intact and, as a side benefit, means the whole stack (frontend + backend)
is TypeScript.

Rejected alternatives:
- **Upgrade to a Hostinger VPS** to keep Python/FastAPI as originally built. Keeps the preferred language,
  but VPS plans cost money (breaks the $0 goal) and shift OS patching/security onto the user.
- **Keep Python, host it off-Hostinger** (e.g. a free-tier PaaS like Render) while frontend/MySQL stay on
  Hostinger. Keeps $0 and Python, but adds a third-party dependency, cross-network DB calls, and free-tier
  cold-start delays — and undercuts the "operate infrastructure I own" framing of the project.

Java/Spring Boot is off the table for the same root-access reason as Python; irrelevant now that the decision
is Node.

### Deploy tooling: interactive OAuth setup, REST API for CI

The one-time interactive setup (creating the Node.js Web App, wiring env vars, creating the cron job) went
through Hostinger's own OAuth-authenticated tooling rather than a raw API token typed anywhere.

GitHub Actions itself can't use an interactive OAuth flow (headless runner), so the deploy workflow uses
Hostinger's REST API directly with an API token stored as a `HOSTINGER_API_TOKEN` repo secret — generated in
hPanel and set via `gh secret set`, consistent with how the SSH deploy key was handled.

**Known limitation, confirmed by repeated testing:** the REST API deploy path (`.github/scripts/deploy-backend.sh`)
is not reliable enough to be the primary backend deploy mechanism. Observed failure modes across multiple
test runs, including a clean isolated run with no concurrent deploys:
- The TUS file upload step has timed out 3/3 retry attempts in a row (6+ min) with nothing else going on.
- A build with a completely clean compile log has come back with `state: "failed"` from the builds-list
  endpoint, with no error surfaced anywhere.
- A build that *does* report `state: "completed"` has sat live-but-not-promoted for 5+ minutes before an
  explicit restart call (added after this was diagnosed) actually activated it.

The root cause isn't fixable from the deploy script's side — it looks like genuine instability in
Hostinger's Node.js build/upload infrastructure, since the same archive and settings have succeeded on other
runs with no code change in between. What the script *can* do is retry: `deploy-backend.sh` re-triggers the
build+poll cycle against the already-uploaded archive up to 3 times (with the full build record printed on
each failure, in case Hostinger's API ever surfaces a reason) before giving up, since a fresh attempt has a
real shot at succeeding even when the previous one didn't. That raises the odds of an unattended push
actually going live, but doesn't guarantee it — a worst-case run (3 full attempts, each timing out its
150s poll) takes around 8-9 minutes before failing.

**The reliable fallback remains manual: hPanel → the Node.js app → Upload your files**, using a
freshly-built archive (`zip -r backend.zip . -x "node_modules/*" -x "dist/*" -x ".git/*" -x ".env"` from
inside `backend/`, same settings each time: Express, Node 22.x, root `./`, npm, entry file `dist/server.js`).
Use this if the GitHub Actions run fails after exhausting its retries, or if you don't want to wait out a
worst-case run.

### Cron Jobs gotcha: no shell, 255-char command limit

Hostinger's Cron Job Manager executes the "Command to Run" field directly, not through a shell — so
`VAR=value VAR2=value2 /path/to/node script.js` (which relies on shell parsing to treat the `VAR=value`
prefixes as environment assignments) fails with `No such file or directory`, because it tries to literally
exec a file named `VAR=value`. Fix: wrap in `/bin/sh -c "..."` so an actual shell exists to interpret it.

That wrapped form is usually too long — the command field caps at 255 characters. Resolved by writing the
full env-var-prefixed invocation into a small wrapper script on the server (`/home/<user>/run-collector.sh`,
`chmod 700` since it holds the DB password) and pointing cron at just `/bin/sh /home/<user>/run-collector.sh`.

Also: the "PHP" vs "Custom" radio button at the top of the cron form matters — PHP mode silently prepends a
fixed `/usr/bin/php /home/<user>/` prefix to whatever you type. Must be on "Custom" or the command gets
mangled into nonsense.

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

- **SSL cert expiry** — issuer, negotiated protocol/cipher, days remaining. Uses Node's `tls`/`net` modules
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
│   ├── src/
│   │   ├── server.ts                # Express app + CORS, entry file for Hostinger
│   │   ├── routes/{status,ssl,deployments}.ts
│   │   ├── collectors/
│   │   │   ├── uptimeCollector.ts
│   │   │   ├── sslCollector.ts
│   │   │   ├── dnsCollector.ts
│   │   │   ├── whoisCollector.ts
│   │   │   └── githubCollector.ts
│   │   ├── db/{pool.ts,schema.sql}
│   │   ├── config.ts                 # targets + repos list, env-driven
│   │   └── runCollector.ts           # entrypoint the Hostinger cron calls
│   ├── package.json
│   └── tsconfig.json
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

- **Frontend**: Angular builds to `dist/`; GitHub Actions deploys via SFTP to a subdomain doc root
  (e.g. `status.cmrubio.com`). Unaffected by the backend pivot — always been plain static files.
- **Backend**: GitHub Actions builds the TypeScript app, archives it, and calls Hostinger's REST API
  (upload → start Node.js build) to deploy the Web App slot.
- **Secrets**: GitHub PAT (Actions read scope) and DB credentials live as env vars in Hostinger's app
  config, never committed. Deploy credentials (SSH key, Hostinger API token) live as GitHub Actions repo
  secrets, set by the user directly — not typed into a chat session.

## Frontend structure

Standalone Angular components (no NgModules). `DashboardComponent` composes `UptimePanel`, `SslPanel`,
`DeploymentsFeed`, each backed by a shared `ApiService` (`HttpClient` + RxJS, polling every 60s). Dark,
minimal "network operations center" styling rather than a generic dashboard template.

## Confirmed hosting details

- Plan is Hostinger **Business Web Hosting** (shared hosting tier, managed via hPanel) — confirmed.
- No VPS/root access, which is why Python and Java are both off the table (see Backend decision above);
  Node.js is the supported runtime for custom backend code on this plan.
- Business tier includes **SSH access**, so the frontend's static files can still deploy over SFTP.
- Database: MySQL, provisioned by the user directly in hPanel (`cmrubio_db` / user `cmrubio`).
