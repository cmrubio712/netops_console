import "dotenv/config";

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

app.listen(port, () => {
  console.log(`NetOps Console API listening on port ${port}`);
});
