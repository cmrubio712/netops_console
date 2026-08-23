import "dotenv/config";

import { ErrorRequestHandler } from "express";
import cors from "cors";
import express from "express";

import { corsOrigins, port } from "./config";
import { deploymentsRouter } from "./routes/deployments";
import { sslRouter } from "./routes/ssl";
import { statusRouter } from "./routes/status";

const app = express();

app.use(cors({ origin: corsOrigins, methods: ["GET"] }));

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", statusRouter);
app.use("/api", sslRouter);
app.use("/api", deploymentsRouter);

// Catches errors forwarded by asyncHandler (e.g. a DB outage) so a single
// failing request returns a 500 instead of crashing the whole process —
// Node terminates on unhandled promise rejections by default.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
};
app.use(errorHandler);

app.listen(port, () => {
  console.log(`NetOps Console API listening on port ${port}`);
});
