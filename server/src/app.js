import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import env, { isProd, isTest } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import { errorHandler, notFound } from "./middleware/error.js";

const app = express();

app.disable("x-powered-by");

// Trust the first proxy hop (matches Render/Fly/Vercel/Railway deploys).
// Without this, `req.ip` is the proxy's IP, which would make Phase 2's
// per-client rate limiting collapse to app-wide limiting. For multi-hop
// setups, override this in a deploy-specific wrapper.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN === "*" ? true : env.CLIENT_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

if (!isTest) {
  app.use(morgan(isProd ? "combined" : "dev"));
}

app.get("/", (req, res) => {
  res.json({ name: "ShareBase API", status: "ok" });
});

app.use("/api/health", healthRoutes);

// Domain routes get mounted under /api/ in later phases:
//   app.use("/api/auth", authRoutes);    // Phase 2
//   app.use("/api/users", userRoutes);   // Phase 4
//   app.use("/api/posts", postRoutes);   // Phase 3

app.use(notFound);
app.use(errorHandler);

export default app;
