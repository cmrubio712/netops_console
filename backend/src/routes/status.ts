import { Router } from "express";
import { RowDataPacket } from "mysql2";

import { pool } from "../db/pool";
import { asyncHandler } from "../middleware/asyncHandler";

export const statusRouter = Router();

statusRouter.get(
  "/targets",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, url FROM targets ORDER BY name",
    );
    res.json(rows);
  }),
);

statusRouter.get(
  "/uptime",
  asyncHandler(async (req, res) => {
    const target = String(req.query.target ?? "");
    const range = String(req.query.range ?? "24h");
    const hours = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 }[range] ?? 24;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT uc.checked_at, uc.http_status, uc.is_up, uc.dns_ms, uc.connect_ms,
              uc.tls_ms, uc.ttfb_ms, uc.total_ms
       FROM uptime_checks uc
       JOIN targets t ON t.id = uc.target_id
       WHERE t.name = ? AND uc.checked_at >= NOW() - INTERVAL ? HOUR
       ORDER BY uc.checked_at ASC`,
      [target, hours],
    );
    res.json(rows);
  }),
);

statusRouter.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const [[targetCountRow]] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM targets",
    );
    const [[uptimeRow]] = await pool.query<RowDataPacket[]>(
      `SELECT
         SUM(is_up) AS up_count,
         COUNT(*) AS total_count
       FROM uptime_checks
       WHERE checked_at >= NOW() - INTERVAL 24 HOUR`,
    );
    const [[nextCert]] = await pool.query<RowDataPacket[]>(
      `SELECT target_id, days_remaining FROM ssl_certs
       ORDER BY days_remaining ASC LIMIT 1`,
    );
    const [[nextDomain]] = await pool.query<RowDataPacket[]>(
      `SELECT target_id, days_remaining FROM domain_whois
       ORDER BY days_remaining ASC LIMIT 1`,
    );

    const totalCount = Number(uptimeRow?.total_count ?? 0);
    const upCount = Number(uptimeRow?.up_count ?? 0);

    res.json({
      uptime_pct_24h: totalCount > 0 ? Math.round((upCount / totalCount) * 10000) / 100 : null,
      targets_monitored: Number(targetCountRow?.count ?? 0),
      next_cert_expiring: nextCert
        ? { target_id: nextCert.target_id, days_remaining: nextCert.days_remaining }
        : null,
      next_domain_expiring: nextDomain
        ? { target_id: nextDomain.target_id, days_remaining: nextDomain.days_remaining }
        : null,
    });
  }),
);
