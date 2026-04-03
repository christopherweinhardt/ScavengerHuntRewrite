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

app.route("/api", apiRoutes);
app.route("/api/admin", adminRoutes);

export default app;
