/** Entrypoint invoked by Hostinger's Cron Job Manager every 5-15 min.
 *
 * Runs uptime/SSL/DNS/WHOIS checks against every configured target and pulls
 * recent GitHub Actions runs for every configured repo, writing results to
 * MySQL. Also prunes rows older than RETENTION_DAYS.
 */
import "dotenv/config";

import { ResultSetHeader, RowDataPacket } from "mysql2";

import { fetchRecentRuns } from "./collectors/githubCollector";
import { checkSslCert } from "./collectors/sslCollector";
import { measureHttpsRequest } from "./collectors/uptimeCollector";
import { checkDomainExpiry } from "./collectors/whoisCollector";
import { githubRepos, retentionDays, targets, TargetConfig } from "./config";
import { pool } from "./db/pool";

async function getOrCreateTarget(entry: TargetConfig): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM targets WHERE name = ?",
    [entry.name],
  );
  if (rows.length > 0) return rows[0].id;

  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO targets (name, url) VALUES (?, ?)",
    [entry.name, entry.url],
  );
  return result.insertId;
}

async function getOrCreateRepo(fullName: string): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM github_repos WHERE full_name = ?",
    [fullName],
  );
  if (rows.length > 0) return rows[0].id;

  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO github_repos (full_name) VALUES (?)",
    [fullName],
  );
  return result.insertId;
}

async function run(): Promise<void> {
  for (const entry of targets) {
    const targetId = await getOrCreateTarget(entry);

    const uptime = await measureHttpsRequest(entry.url);
    await pool.query(
      `INSERT INTO uptime_checks
       (target_id, http_status, is_up, dns_ms, connect_ms, tls_ms, ttfb_ms, total_ms, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetId, uptime.http_status, uptime.is_up, uptime.dns_ms,
        uptime.connect_ms, uptime.tls_ms, uptime.ttfb_ms, uptime.total_ms, uptime.error,
      ],
    );

    const ssl = await checkSslCert(entry.url);
    if (!ssl.error) {
      await pool.query(
        `INSERT INTO ssl_certs
         (target_id, issuer, not_before, not_after, days_remaining, protocol, cipher)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [targetId, ssl.issuer, ssl.not_before, ssl.not_after, ssl.days_remaining, ssl.protocol, ssl.cipher],
      );
    }

    const whois = await checkDomainExpiry(new URL(entry.url).hostname);
    if (!whois.error) {
      await pool.query(
        `INSERT INTO domain_whois (target_id, registrar, expires_at, days_remaining)
         VALUES (?, ?, ?, ?)`,
        [targetId, whois.registrar, whois.expires_at, whois.days_remaining],
      );
    }
  }

  for (const fullName of githubRepos) {
    const repoId = await getOrCreateRepo(fullName);
    const runs = await fetchRecentRuns(fullName);

    for (const runData of runs) {
      await pool.query(
        `INSERT INTO deployment_runs
         (repo_id, run_id, workflow_name, status, conclusion, started_at, duration_s, html_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           status = VALUES(status), conclusion = VALUES(conclusion),
           duration_s = VALUES(duration_s)`,
        [
          repoId, runData.run_id, runData.workflow_name, runData.status,
          runData.conclusion, runData.started_at, runData.duration_s, runData.html_url,
        ],
      );
    }
  }

  await pool.query(
    "DELETE FROM uptime_checks WHERE checked_at < NOW() - INTERVAL ? DAY",
    [retentionDays],
  );
  await pool.query(
    "DELETE FROM ssl_certs WHERE checked_at < NOW() - INTERVAL ? DAY",
    [retentionDays],
  );
  await pool.query(
    "DELETE FROM domain_whois WHERE checked_at < NOW() - INTERVAL ? DAY",
    [retentionDays],
  );

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
