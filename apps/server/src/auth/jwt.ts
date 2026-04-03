import type { MiddlewareHandler } from "hono";
import { verify } from "hono/jwt";
import type { TeamJwtPayload } from "@scavenger/types";
import { teamJwtPayloadSchema } from "@scavenger/types";
import { config } from "../config.js";

type TeamVars = { team: TeamJwtPayload };

export async function signTeamJwt(payload: TeamJwtPayload): Promise<string> {
  const { sign } = await import("hono/jwt");
  return sign(
    {
      sub: payload.sub,
      huntId: payload.huntId,
      teamId: payload.teamId,
      typ: payload.typ,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    },
    config.teamJwtSecret,
    "HS256"
  );
}

export async function verifyTeamJwt(token: string): Promise<TeamJwtPayload> {
  const raw = await verify(token, config.teamJwtSecret, "HS256");
  const parsed = teamJwtPayloadSchema.parse({
    sub: raw.sub,
    huntId: raw.huntId,
    teamId: raw.teamId,
    typ: raw.typ,
  });
  return parsed;
}

export function authTeam(): MiddlewareHandler<{ Variables: TeamVars }> {
  return async (c, next) => {
    const auth = c.req.header("Authorization");
    const token =
      auth?.startsWith("Bearer ") ? auth.slice(7) : c.req.header("X-Team-Token");
    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    try {
      const team = await verifyTeamJwt(token);
      c.set("team", team);
    } catch {
      return c.json({ error: "Invalid token" }, 401);
    }
    await next();
  };
}

export function requireAdmin(): MiddlewareHandler {
  return async (c, next) => {
    const key = c.req.header("X-Admin-Key");
    if (!key || key !== config.adminApiKey) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  };
}

