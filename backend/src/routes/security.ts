import { Router } from "express";
import { RowDataPacket } from "mysql2";

import { pool } from "../db/pool";
import { asyncHandler } from "../middleware/asyncHandler";

export const securityRouter = Router();

securityRouter.get(
  "/security",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         t.name AS target,
         sh.hsts, sh.hsts_max_age, sh.csp, sh.x_frame_options,
         sh.x_content_type_options, sh.referrer_policy, sh.permissions_policy,
         sh.score, sh.grade, sh.checked_at
       FROM targets t
       JOIN security_headers sh ON sh.id = (
         SELECT id FROM security_headers WHERE target_id = t.id ORDER BY checked_at DESC LIMIT 1
       )
       ORDER BY t.name`,
    );
    res.json(rows);
  }),
);
