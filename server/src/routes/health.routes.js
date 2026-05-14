import { Router } from "express";

import { getDbReadiness } from "../config/db.js";

const router = Router();

// Prevent proxies / browsers from caching health responses — a stale
// "degraded" verdict served to an orchestrator could keep an instance out
// of rotation after it recovered, and the inverse is even worse.
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Build a readiness response body. Returned alongside `ready` so the
// caller can pick the HTTP status (200 vs 503) without re-computing it.
function readinessResponse({ withUptime = false } = {}) {
  const { ready, label } = getDbReadiness();
  const body = {
    status: ready ? "ok" : "degraded",
    db: label,
    timestamp: new Date().toISOString(),
  };
  if (withUptime) body.uptime = process.uptime();
  return { ready, body };
}

// Liveness: is the process up?
// Always 200 as long as the event loop is responsive. Use this for k8s
// liveness probes / "is the container alive" checks — restarting the
// container because Mongo went away briefly would just cause a cascade.
router.get("/live", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Readiness: can we serve traffic right now?
// 503 if the DB is anything other than "connected". Use this for k8s
// readiness probes / load balancer health checks so an instance that
// lost its DB stops receiving traffic until it reconnects.
router.get("/ready", (req, res) => {
  const { ready, body } = readinessResponse();
  res.status(ready ? 200 : 503).json(body);
});

// Backwards-compatible combined check. Returns 200/503 like /ready so a
// single endpoint still works for simple uptime monitors, with `uptime`
// included for convenience.
router.get("/", (req, res) => {
  const { ready, body } = readinessResponse({ withUptime: true });
  res.status(ready ? 200 : 503).json(body);
});

export default router;
