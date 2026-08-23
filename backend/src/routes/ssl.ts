import { Router } from "express";
import { RowDataPacket } from "mysql2";

import { pool } from "../db/pool";
import { asyncHandler } from "../middleware/asyncHandler";

export const sslRouter = Router();

sslRouter.get(
  "/ssl",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         t.name AS target,
         sc.issuer, sc.not_after, sc.days_remaining AS cert_days_remaining,
         sc.protocol, sc.cipher,
         dw.registrar AS domain_registrar, dw.days_remaining AS domain_days_remaining
       FROM targets t
       JOIN ssl_certs sc ON sc.id = (
         SELECT id FROM ssl_certs WHERE target_id = t.id ORDER BY checked_at DESC LIMIT 1
       )
       LEFT JOIN domain_whois dw ON dw.id = (
         SELECT id FROM domain_whois WHERE target_id = t.id ORDER BY checked_at DESC LIMIT 1
       )
       ORDER BY t.name`,
    );
    res.json(rows);
  }),
);
