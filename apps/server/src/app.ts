import { Hono } from "hono";
import { cors } from "hono/cors";
import { adminRoutes, apiRoutes } from "./routes/api.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Team-Token", "X-Admin-Key"],
  })
);

app.get("/health", (c) => c.json({ ok: true }));

// Admin must NOT live under `/api/*`: `authed.use("*", authTeam())` in apiRoutes
// attaches team JWT middleware to every `/api/...` route, including `/api/admin/...`.
app.route("/admin", adminRoutes);
app.route("/api", apiRoutes);

export default app;
