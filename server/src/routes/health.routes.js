import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

const DB_STATES = ["disconnected", "connected", "connecting", "disconnecting"];

// Liveness: is the process up?
// Always 200 as long as the event loop is responsive. Use this for k8s
// liveness probes / "is the container alive" checks — restarting the
// container because Mongo went away briefly would just cause a cascade.
router.get("/live", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Readiness: can we serve traffic right now?
// 503 if the DB is anything other than "connected". Use this for k8s
// readiness probes / load balancer health checks so an instance that
// lost its DB stops receiving traffic until it reconnects.
router.get("/ready", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = DB_STATES[dbState] ?? "unknown";
  const ready = dbState === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "degraded",
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// Backwards-compatible combined check. Returns 200/503 like /ready so a
// single endpoint still works for simple uptime monitors.
router.get("/", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = DB_STATES[dbState] ?? "unknown";
  const ready = dbState === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "degraded",
    uptime: process.uptime(),
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

export default router;
