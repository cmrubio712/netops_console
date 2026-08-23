import { Router } from "express";
import { RowDataPacket } from "mysql2";

import { pool } from "../db/pool";
import { asyncHandler } from "../middleware/asyncHandler";

export const deploymentsRouter = Router();

deploymentsRouter.get(
  "/deployments",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 20), 100);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         gr.full_name AS repo,
         dr.workflow_name, dr.status, dr.conclusion, dr.started_at,
         dr.duration_s, dr.html_url
       FROM deployment_runs dr
       JOIN github_repos gr ON gr.id = dr.repo_id
       ORDER BY dr.started_at DESC
       LIMIT ?`,
      [limit],
    );
    res.json(rows);
  }),
);
