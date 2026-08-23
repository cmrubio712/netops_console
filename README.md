# NetOps Console

A public observability dashboard for personal infrastructure: uptime and latency monitoring,
SSL certificate and domain expiry tracking, and a live feed of GitHub Actions deployment runs.

Live at [status.cmrubio.com](https://status.cmrubio.com).

## Stack

- **Frontend**: Angular (standalone components), polling a read-only JSON API
- **Backend**: FastAPI (Python), deployed under Passenger via an ASGI-to-WSGI shim
- **Database**: MySQL
- **Collection**: a cron job on the hosting box runs uptime/SSL/DNS/WHOIS checks and pulls
  recent GitHub Actions runs every 5-15 minutes
- **CI/CD**: GitHub Actions builds and deploys both apps over SFTP on every push to `main`

See [docs/architecture.md](docs/architecture.md) for the full design writeup, including why
collection runs on the host itself rather than from GitHub Actions.

## Repo layout

```
backend/    FastAPI app, collectors, Passenger entrypoint
frontend/   Angular app
docs/       architecture notes
```

## Local development

Backend:
```
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
DATABASE_URL="sqlite:////tmp/netops_dev.db" .venv/bin/uvicorn app.main:app --reload
```

Frontend:
```
cd frontend
npm install
npx ng serve
```
