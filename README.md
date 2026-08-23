# NetOps Console

A public observability dashboard for personal infrastructure: uptime and latency monitoring,
SSL certificate and domain expiry tracking, and a live feed of GitHub Actions deployment runs.

Live at [status.cmrubio.com](https://status.cmrubio.com).

## Stack

- **Frontend**: Angular (standalone components), polling a read-only JSON API
- **Backend**: Node.js (Express) + TypeScript, deployed as a Hostinger Node.js Web App
- **Database**: MySQL
- **Collection**: a cron job on the hosting box runs uptime/SSL/DNS/WHOIS checks and pulls
  recent GitHub Actions runs every 5-15 minutes
- **CI/CD**: GitHub Actions builds and deploys the frontend over SFTP on every push to `main`.
  Backend deploy is attempted via Hostinger's REST API but isn't reliable (see architecture doc) —
  the dependable path is a manual archive upload through hPanel

See [docs/architecture.md](docs/architecture.md) for the full design writeup, including why the
backend is Node.js rather than the originally-planned Python (Hostinger's shared hosting doesn't
grant the root access Python needs), and why collection runs on the host itself rather than from
GitHub Actions.

## Repo layout

```
backend/    Express app, collectors, MySQL schema
frontend/   Angular app
docs/       architecture notes
```

## Local development

Backend:
```
cd backend
npm install
cp .env.example .env   # fill in DB credentials
npm run build && npm start
```

Frontend:
```
cd frontend
npm install
npx ng serve
```
