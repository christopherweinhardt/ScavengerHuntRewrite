import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authTeam, requireAdmin, signTeamJwt } from "../auth/jwt.js";
import { db } from "../db/index.js";
import { challenges, completions, hunts, teams } from "../db/schema.js";
import { getIo } from "../io.js";
import { toChallenge, toHuntPublic } from "../mappers.js";
import {
  buildObjectKey,
  completeMultipart,
  getSession,
  initMultipart,
  presignPutObject,
  presignUploadPart,
} from "../s3.js";
import {
  emitChallengeRemove,
  emitChallengeUpsert,
  emitHuntMeta,
} from "../socket/hub.js";

const api = new Hono();

api.get("/public/hunts/:slug", async (c) => {
  const slug = c.req.param("slug");
  const hunt = await db.query.hunts.findFirst({ where: eq(hunts.slug, slug) });
  if (!hunt) return c.json({ error: "Not found" }, 404);
  const list = await db.query.challenges.findMany({
    where: eq(challenges.huntId, hunt.id),
    orderBy: (ch, { asc }) => [asc(ch.sortOrder), asc(ch.createdAt)],
  });
  return c.json({
    hunt: toHuntPublic(hunt),
    challenges: list.filter((x) => x.active).map(toChallenge),
  });
});

api.post("/auth/join", async (c) => {
  const body = await c.req.json();
  const parsed = z
    .object({
      slug: z.string().min(1),
      joinCode: z.string().min(1),
    })
    .safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body" }, 400);
  }
  const { slug, joinCode } = parsed.data;
  const hunt = await db.query.hunts.findFirst({ where: eq(hunts.slug, slug) });
  if (!hunt) return c.json({ error: "Hunt not found" }, 404);

  const team = await db.query.teams.findFirst({
    where: and(eq(teams.huntId, hunt.id), eq(teams.joinCode, joinCode)),
  });
  if (!team) return c.json({ error: "Invalid join code" }, 401);

  const token = await signTeamJwt({
    sub: team.id,
    huntId: hunt.id,
    teamId: team.id,
    typ: "team",
  });

  return c.json({
    token,
    hunt: toHuntPublic(hunt),
    team: { id: team.id, name: team.name },
  });
});

const authed = new Hono<{ Variables: { team: import("@scavenger/types").TeamJwtPayload } }>();
authed.use("*", authTeam());

authed.get("/me/state", async (c) => {
  const team = c.get("team");
  const hunt = await db.query.hunts.findFirst({
    where: eq(hunts.id, team.huntId),
  });
  if (!hunt) return c.json({ error: "Hunt missing" }, 404);

  const list = await db.query.challenges.findMany({
    where: eq(challenges.huntId, hunt.id),
    orderBy: (ch, { asc }) => [asc(ch.sortOrder), asc(ch.createdAt)],
  });

  const done = await db.query.completions.findMany({
    where: eq(completions.teamId, team.teamId),
  });

  return c.json({
    hunt: toHuntPublic(hunt),
    challenges: list.filter((x) => x.active).map(toChallenge),
    completedChallengeIds: done.map((d) => d.challengeId),
  });
});

authed.get("/hunts/:slug/time", async (c) => {
  const slug = c.req.param("slug");
  const hunt = await db.query.hunts.findFirst({ where: eq(hunts.slug, slug) });
  if (!hunt) return c.json({ error: "Not found" }, 404);
  return c.json({
    serverTime: new Date().toISOString(),
    hunt: toHuntPublic(hunt),
  });
});

const presignBody = z.object({
  challengeId: z.string().uuid(),
  contentType: z.string().min(1),
  ext: z.string().min(1).max(10),
});

authed.post("/uploads/presign-put", async (c) => {
  const team = c.get("team");
  const body = presignBody.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  const ch = await db.query.challenges.findFirst({
    where: and(
      eq(challenges.id, body.data.challengeId),
      eq(challenges.huntId, team.huntId)
    ),
  });
  if (!ch) return c.json({ error: "Challenge not found" }, 404);
  const key = buildObjectKey({
    huntId: team.huntId,
    teamId: team.teamId,
    challengeId: ch.id,
    ext: body.data.ext,
  });
  const { url } = await presignPutObject({
    key,
    contentType: body.data.contentType,
  });
  return c.json({ url, key, method: "PUT" as const });
});

const multipartInitBody = presignBody.extend({
  partSize: z.number().int().positive().optional(),
});

authed.post("/uploads/multipart/init", async (c) => {
  const team = c.get("team");
  const body = multipartInitBody.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  const ch = await db.query.challenges.findFirst({
    where: and(
      eq(challenges.id, body.data.challengeId),
      eq(challenges.huntId, team.huntId)
    ),
  });
  if (!ch) return c.json({ error: "Challenge not found" }, 404);
  const key = buildObjectKey({
    huntId: team.huntId,
    teamId: team.teamId,
    challengeId: ch.id,
    ext: body.data.ext,
  });
  const out = await initMultipart({
    key,
    contentType: body.data.contentType,
    huntId: team.huntId,
    teamId: team.teamId,
    partSize: body.data.partSize,
  });
  return c.json(out);
});

authed.get("/uploads/multipart/:uploadId/part/:partNumber/url", async (c) => {
  const uploadId = c.req.param("uploadId");
  const partNumber = Number(c.req.param("partNumber"));
  const team = c.get("team");
  if (!Number.isInteger(partNumber) || partNumber < 1) {
    return c.json({ error: "Bad part" }, 400);
  }
  const session = getSession(uploadId);
  if (!session || session.teamId !== team.teamId || session.huntId !== team.huntId) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const url = await presignUploadPart({ uploadId, partNumber });
  return c.json({ url, partNumber });
});

authed.post("/uploads/multipart/complete", async (c) => {
  const team = c.get("team");
  const body = z
    .object({
      uploadId: z.string().min(1),
      parts: z.array(
        z.object({
          PartNumber: z.number().int().positive(),
          ETag: z.string().min(1),
        })
      ),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  const session = getSession(body.data.uploadId);
  if (!session || session.teamId !== team.teamId || session.huntId !== team.huntId) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const { key } = await completeMultipart({
    uploadId: body.data.uploadId,
    parts: body.data.parts,
  });
  return c.json({ key });
});

authed.post("/completions", async (c) => {
  const team = c.get("team");
  const body = z
    .object({
      challengeId: z.string().uuid(),
      s3Key: z.string().min(1),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid body" }, 400);

  const ch = await db.query.challenges.findFirst({
    where: and(
      eq(challenges.id, body.data.challengeId),
      eq(challenges.huntId, team.huntId),
      eq(challenges.active, true)
    ),
  });
  if (!ch) return c.json({ error: "Challenge not found" }, 404);

  const expectedPrefix = `hunts/${team.huntId}/teams/${team.teamId}/challenges/${ch.id}/`;
  if (!body.data.s3Key.startsWith(expectedPrefix)) {
    return c.json({ error: "Invalid key" }, 400);
  }

  await db
    .insert(completions)
    .values({
      teamId: team.teamId,
      challengeId: ch.id,
      s3Key: body.data.s3Key,
    })
    .onConflictDoNothing({
      target: [completions.teamId, completions.challengeId],
    });

  return c.json({ ok: true });
});

api.route("/", authed);

const admin = new Hono();
admin.use("*", requireAdmin());

admin.post("/hunts", async (c) => {
  const body = z
    .object({
      name: z.string().min(1),
      slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
      startsAt: z.string().datetime(),
      durationSeconds: z.number().int().positive().default(10800),
      status: z.enum(["scheduled", "active", "paused", "finished"]).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  const [row] = await db
    .insert(hunts)
    .values({
      name: body.data.name,
      slug: body.data.slug,
      startsAt: new Date(body.data.startsAt),
      durationSeconds: body.data.durationSeconds,
      status: (body.data.status ?? "scheduled") as (typeof hunts.$inferInsert)["status"],
    })
    .returning();
  return c.json({ hunt: toHuntPublic(row) });
});

admin.post("/hunts/:huntId/teams", async (c) => {
  const huntId = c.req.param("huntId");
  const body = z
    .object({
      name: z.string().min(1),
      joinCode: z.string().min(4).max(32),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  const hunt = await db.query.hunts.findFirst({ where: eq(hunts.id, huntId) });
  if (!hunt) return c.json({ error: "Hunt not found" }, 404);
  const [team] = await db
    .insert(teams)
    .values({
      huntId: hunt.id,
      name: body.data.name,
      joinCode: body.data.joinCode,
    })
    .returning();
  return c.json({ team: { id: team.id, name: team.name, joinCode: team.joinCode } });
});

admin.post("/hunts/:huntId/challenges", async (c) => {
  const huntId = c.req.param("huntId");
  const body = z
    .object({
      title: z.string().min(1),
      description: z.string().default(""),
      type: z.enum(["photo", "video"]).default("photo"),
      isBonus: z.boolean().default(false),
      sortOrder: z.number().int().default(0),
      active: z.boolean().default(true),
      points: z.number().int().default(1),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  const hunt = await db.query.hunts.findFirst({ where: eq(hunts.id, huntId) });
  if (!hunt) return c.json({ error: "Hunt not found" }, 404);
  const [row] = await db
    .insert(challenges)
    .values({
      huntId: hunt.id,
      title: body.data.title,
      description: body.data.description,
      type: body.data.type,
      isBonus: body.data.isBonus,
      sortOrder: body.data.sortOrder,
      active: body.data.active,
      points: body.data.points,
    })
    .returning();
  const dto = toChallenge(row);
  emitChallengeUpsert(getIo(), hunt.id, dto);
  return c.json({ challenge: dto });
});

admin.patch("/challenges/:id", async (c) => {
  const id = c.req.param("id");
  const body = z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      type: z.enum(["photo", "video"]).optional(),
      isBonus: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
      active: z.boolean().optional(),
      points: z.number().int().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  const existing = await db.query.challenges.findFirst({
    where: eq(challenges.id, id),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);
  const patch = Object.fromEntries(
    Object.entries(body.data).filter(([, v]) => v !== undefined)
  ) as Partial<typeof challenges.$inferInsert>;
  const [row] = await db
    .update(challenges)
    .set(patch)
    .where(eq(challenges.id, id))
    .returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  const dto = toChallenge(row);
  emitChallengeUpsert(getIo(), row.huntId, dto);
  return c.json({ challenge: dto });
});

admin.delete("/challenges/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await db.query.challenges.findFirst({
    where: eq(challenges.id, id),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);
  await db.delete(challenges).where(eq(challenges.id, id));
  emitChallengeRemove(getIo(), existing.huntId, {
    id: existing.id,
    huntId: existing.huntId,
  });
  return c.json({ ok: true });
});

admin.patch("/hunts/:huntId", async (c) => {
  const huntId = c.req.param("huntId");
  const body = z
    .object({
      status: z.enum(["scheduled", "active", "paused", "finished"]).optional(),
      startsAt: z.string().datetime().optional(),
      durationSeconds: z.number().int().positive().optional(),
      name: z.string().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  const patch: Record<string, unknown> = {};
  if (body.data.status !== undefined) patch.status = body.data.status;
  if (body.data.startsAt !== undefined) patch.startsAt = new Date(body.data.startsAt);
  if (body.data.durationSeconds !== undefined)
    patch.durationSeconds = body.data.durationSeconds;
  if (body.data.name !== undefined) patch.name = body.data.name;
  const [row] = await db.update(hunts).set(patch).where(eq(hunts.id, huntId)).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  const dto = toHuntPublic(row);
  emitHuntMeta(getIo(), row.id, dto);
  return c.json({ hunt: dto });
});

export const adminRoutes = admin;
export const apiRoutes = api;
