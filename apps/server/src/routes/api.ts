import type { Challenge } from "@scavenger/types";
import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { authTeam, requireAdmin, signTeamJwt } from "../auth/jwt.js";
import { db } from "../db/index.js";
import {
  challenges,
  completions,
  hunts,
  pushTokens,
  teams,
} from "../db/schema.js";
import { getIo } from "../io.js";
import { toChallenge, toHuntPublic } from "../mappers.js";
import { notifyTeam, notifyTeamsInHunt } from "../push/notify.js";
import {
  buildObjectKey,
  completeMultipart,
  getSession,
  initMultipart,
  presignGetObject,
  presignPutObject,
  presignUploadPart,
} from "../s3.js";
import {
  emitChallengeRemove,
  emitChallengeUpsert,
  emitCompletionStatus,
  emitHuntMeta,
  emitTeamKicked,
  roomForTeam,
} from "../socket/hub.js";

const api = new Hono();

async function teamChallengeCompletion(teamId: string, challengeId: string) {
  return db.query.completions.findFirst({
    where: and(
      eq(completions.teamId, teamId),
      eq(completions.challengeId, challengeId)
    ),
  });
}

function pushNotifyActiveChallenge(huntId: string, dto: Challenge): void {
  if (!dto.active) return;
  notifyTeamsInHunt(huntId, {
    title: "New task",
    body: dto.title,
    // `challenge` + challengeId: mobile refetches hunt state (same pattern as completion pushes).
    data: { type: "challenge", challengeId: dto.id },
  });
}

function pushNotifyChallengesUpdated(
  huntId: string,
  title: string,
  body: string
): void {
  notifyTeamsInHunt(huntId, {
    title,
    body,
    data: { type: "challenges_updated" },
  });
}

api.get("/public/hunts/:slug", async (c) => {
  const slug = c.req.param("slug");
  const hunt = await db.query.hunts.findFirst({ where: eq(hunts.slug, slug) });
  if (!hunt) return c.json({ error: "Not found" }, 404);
  const list = await db.query.challenges.findMany({
    where: eq(challenges.huntId, hunt.id),
    orderBy: (ch, { asc, desc }) => [
      desc(ch.isBonus),
      asc(ch.sortOrder),
      asc(ch.createdAt),
    ],
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
    orderBy: (ch, { asc, desc }) => [
      desc(ch.isBonus),
      asc(ch.sortOrder),
      asc(ch.createdAt),
    ],
  });

  const done = await db.query.completions.findMany({
    where: eq(completions.teamId, team.teamId),
  });
  const completedChallengeIds = done
    .filter((d) => d.status === "approved")
    .map((d) => d.challengeId);
  const pendingChallengeIds = done
    .filter((d) => d.status === "pending")
    .map((d) => d.challengeId);

  return c.json({
    hunt: toHuntPublic(hunt),
    challenges: list.filter((x) => x.active).map(toChallenge),
    completedChallengeIds,
    pendingChallengeIds,
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
  const existing = await teamChallengeCompletion(team.teamId, ch.id);
  if (existing?.status === "approved") {
    return c.json({ error: "Challenge already approved" }, 400);
  }
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
  const existingMp = await teamChallengeCompletion(team.teamId, ch.id);
  if (existingMp?.status === "approved") {
    return c.json({ error: "Challenge already approved" }, 400);
  }
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

  const existing = await teamChallengeCompletion(team.teamId, ch.id);
  if (existing?.status === "approved") {
    return c.json({ ok: true });
  }
  if (existing?.status === "pending") {
    await db
      .update(completions)
      .set({
        s3Key: body.data.s3Key,
        createdAt: new Date(),
      })
      .where(eq(completions.id, existing.id));
    emitCompletionStatus(getIo(), team.huntId, {
      teamId: team.teamId,
      challengeId: ch.id,
      status: "pending",
    });
    return c.json({ ok: true });
  }

  await db.insert(completions).values({
    teamId: team.teamId,
    challengeId: ch.id,
    s3Key: body.data.s3Key,
    status: "pending",
  });
  emitCompletionStatus(getIo(), team.huntId, {
    teamId: team.teamId,
    challengeId: ch.id,
    status: "pending",
  });
  return c.json({ ok: true });
});

const pushTokenBody = z.object({
  expoPushToken: z.string().min(1),
  platform: z.enum(["ios", "android"]),
});

authed.post("/push/token", async (c) => {
  const team = c.get("team");
  const body = pushTokenBody.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  const now = new Date();
  await db
    .insert(pushTokens)
    .values({
      teamId: team.teamId,
      expoPushToken: body.data.expoPushToken,
      platform: body.data.platform,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: pushTokens.expoPushToken,
      set: {
        teamId: team.teamId,
        platform: body.data.platform,
        updatedAt: now,
      },
    });
  return c.json({ ok: true });
});

authed.delete("/push/token", async (c) => {
  const team = c.get("team");
  const q = c.req.query("expoPushToken");
  const raw: unknown = q
    ? { expoPushToken: q }
    : await c.req.json().catch(() => ({}));
  const body = z
    .object({ expoPushToken: z.string().min(1) })
    .safeParse(raw);
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  await db
    .delete(pushTokens)
    .where(
      and(
        eq(pushTokens.expoPushToken, body.data.expoPushToken),
        eq(pushTokens.teamId, team.teamId)
      )
    );
  return c.json({ ok: true });
});

api.route("/", authed);

const admin = new Hono();
admin.use("*", requireAdmin());

admin.get("/hunts", async (c) => {
  const rows = await db.query.hunts.findMany({
    orderBy: (h, { desc: d }) => [d(h.createdAt)],
  });
  return c.json({ hunts: rows.map(toHuntPublic) });
});

admin.get("/hunts/:huntId", async (c) => {
  const huntId = c.req.param("huntId");
  const hunt = await db.query.hunts.findFirst({ where: eq(hunts.id, huntId) });
  if (!hunt) return c.json({ error: "Not found" }, 404);
  const teamList = await db.query.teams.findMany({
    where: eq(teams.huntId, huntId),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });
  const chList = await db.query.challenges.findMany({
    where: eq(challenges.huntId, huntId),
    orderBy: (ch, { asc, desc }) => [
      desc(ch.isBonus),
      asc(ch.sortOrder),
      asc(ch.createdAt),
    ],
  });
  const challengeTypeById = new Map(
    chList.map((row) => [row.id, row.type as "photo" | "video"])
  );
  const challengePointsById = new Map(chList.map((row) => [row.id, row.points ?? 0]));
  let submissions: Array<{
    id: string;
    challengeId: string;
    teamId: string;
    teamName: string;
    submittedAt: string;
    mediaType: "photo" | "video";
    status: "pending" | "approved";
    viewUrl: string | null;
  }> = [];
  const baseScoreByTeamId = new Map<string, number>();
  if (chList.length > 0) {
    const challengeIds = chList.map((x) => x.id);
    const compRows = await db.query.completions.findMany({
      where: inArray(completions.challengeId, challengeIds),
      with: { team: true },
      orderBy: (comp, { desc: d }) => [d(comp.createdAt)],
    });
    const built = await Promise.all(
      compRows.map(async (row) => {
        const team = row.team;
        if (!team || team.huntId !== huntId) return null;
        let viewUrl: string | null = null;
        try {
          viewUrl = await presignGetObject(row.s3Key);
        } catch {
          viewUrl = null;
        }
        return {
          id: row.id,
          challengeId: row.challengeId,
          teamId: row.teamId,
          teamName: team.name,
          submittedAt: (row.createdAt ?? new Date()).toISOString(),
          mediaType: challengeTypeById.get(row.challengeId) ?? "photo",
          status: row.status,
          viewUrl,
        };
      })
    );
    submissions = built.filter(
      (x): x is NonNullable<(typeof built)[number]> => x !== null
    );
    for (const row of compRows) {
      if (row.status !== "approved") continue;
      const points = challengePointsById.get(row.challengeId) ?? 0;
      baseScoreByTeamId.set(row.teamId, (baseScoreByTeamId.get(row.teamId) ?? 0) + points);
    }
  }
  return c.json({
    hunt: toHuntPublic(hunt),
    teams: teamList.map((t) => ({
      id: t.id,
      name: t.name,
      joinCode: t.joinCode,
      baseScore: baseScoreByTeamId.get(t.id) ?? 0,
      scoreAdjustment: t.scoreAdjustment ?? 0,
      totalScore: (baseScoreByTeamId.get(t.id) ?? 0) + (t.scoreAdjustment ?? 0),
    })),
    challenges: chList.map(toChallenge),
    submissions,
  });
});

admin.post("/completions/:id/approve", async (c) => {
  const id = c.req.param("id");
  const row = await db.query.completions.findFirst({
    where: and(eq(completions.id, id), eq(completions.status, "pending")),
    with: { team: true, challenge: true },
  });
  if (!row?.team || !row.challenge) return c.json({ error: "Not found" }, 404);
  if (row.team.huntId !== row.challenge.huntId) {
    return c.json({ error: "Not found" }, 404);
  }
  await db
    .update(completions)
    .set({ status: "approved" })
    .where(eq(completions.id, id));
  const challengeTitle = row.challenge.title ?? "A task";
  emitCompletionStatus(getIo(), row.team.huntId, {
    teamId: row.teamId,
    challengeId: row.challengeId,
    status: "approved",
  });
  notifyTeam(row.teamId, {
    title: "Submission approved",
    body: `Your submission for "${challengeTitle}" was approved.`,
    data: { type: "completion_approved", challengeId: row.challengeId },
  });
  return c.json({ ok: true });
});

admin.delete("/completions/:id", async (c) => {
  const id = c.req.param("id");
  const row = await db.query.completions.findFirst({
    where: eq(completions.id, id),
    with: { team: true, challenge: true },
  });
  if (!row?.team) return c.json({ error: "Not found" }, 404);
  const huntId = row.team.huntId;
  const { teamId, challengeId } = row;
  const challengeTitle = row.challenge?.title ?? "A task";
  await db.delete(completions).where(eq(completions.id, id));
  emitCompletionStatus(getIo(), huntId, {
    teamId,
    challengeId,
    status: "none",
    challengeTitle,
  });
  notifyTeam(teamId, {
    title: "Submission Rejected",
    body: `Your submission for "${challengeTitle}" has been rejected. Please submit a new one.`,
    data: { type: "completion_rejected", challengeId },
  });
  return c.json({ ok: true });
});

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
      scoreAdjustment: 0,
    })
    .returning();
  return c.json({
    team: {
      id: team.id,
      name: team.name,
      joinCode: team.joinCode,
      baseScore: 0,
      scoreAdjustment: team.scoreAdjustment ?? 0,
      totalScore: team.scoreAdjustment ?? 0,
    },
  });
});

admin.delete("/hunts/:huntId/teams/:teamId", async (c) => {
  const huntId = c.req.param("huntId");
  const teamId = c.req.param("teamId");
  const team = await db.query.teams.findFirst({
    where: and(eq(teams.id, teamId), eq(teams.huntId, huntId)),
  });
  if (!team) return c.json({ error: "Team not found" }, 404);

  emitTeamKicked(getIo(), teamId);
  getIo().in(roomForTeam(teamId)).disconnectSockets(true);
  await db.delete(teams).where(eq(teams.id, teamId));
  return c.json({ ok: true });
});

admin.patch("/teams/:teamId/score", async (c) => {
  const teamId = c.req.param("teamId");
  const body = z
    .object({
      scoreAdjustment: z.number().int().optional(),
      totalScore: z.number().int().optional(),
    })
    .refine((v) => v.scoreAdjustment !== undefined || v.totalScore !== undefined, {
      message: "scoreAdjustment or totalScore is required",
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid body" }, 400);

  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) return c.json({ error: "Team not found" }, 404);

  const approved = await db.query.completions.findMany({
    where: and(eq(completions.teamId, teamId), eq(completions.status, "approved")),
    with: { challenge: true },
  });
  const baseScore = approved.reduce((sum, row) => sum + (row.challenge?.points ?? 0), 0);
  const scoreAdjustment =
    body.data.scoreAdjustment ??
    ((body.data.totalScore as number) - baseScore);

  const [updated] = await db
    .update(teams)
    .set({ scoreAdjustment })
    .where(eq(teams.id, teamId))
    .returning();
  if (!updated) return c.json({ error: "Team not found" }, 404);

  return c.json({
    team: {
      id: updated.id,
      name: updated.name,
      joinCode: updated.joinCode,
      baseScore,
      scoreAdjustment: updated.scoreAdjustment,
      totalScore: baseScore + updated.scoreAdjustment,
    },
  });
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
  pushNotifyActiveChallenge(hunt.id, dto);
  return c.json({ challenge: dto });
});

const challengeImportItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  type: z.enum(["photo", "video"]).default("photo"),
  isBonus: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
  points: z.number().int().min(0).default(1),
});

admin.post("/hunts/:huntId/challenges/import", async (c) => {
  const huntId = c.req.param("huntId");
  const body = z
    .object({
      challenges: z.array(challengeImportItemSchema).min(1).max(500),
    })
    .safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid body", details: body.error.flatten() }, 400);
  }
  const hunt = await db.query.hunts.findFirst({ where: eq(hunts.id, huntId) });
  if (!hunt) return c.json({ error: "Hunt not found" }, 404);

  const rows = body.data.challenges.map((ch) => ({
    huntId: hunt.id,
    title: ch.title.trim(),
    description: ch.description,
    type: ch.type as (typeof challenges.$inferInsert)["type"],
    isBonus: ch.isBonus,
    sortOrder: ch.sortOrder,
    active: ch.active,
    points: ch.points,
  }));

  const inserted = await db.insert(challenges).values(rows).returning();
  const io = getIo();
  for (const row of inserted) {
    const dto = toChallenge(row);
    emitChallengeUpsert(io, hunt.id, dto);
    pushNotifyActiveChallenge(hunt.id, dto);
  }

  return c.json({
    imported: inserted.length,
    challenges: inserted.map(toChallenge),
  });
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
  pushNotifyActiveChallenge(row.huntId, dto);
  if (!dto.active) {
    pushNotifyChallengesUpdated(
      row.huntId,
      "Task list updated",
      "The hunt tasks were updated."
    );
  }
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
  pushNotifyChallengesUpdated(
    existing.huntId,
    "Task list updated",
    "A task was removed from your hunt."
  );
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

admin.delete("/hunts/:huntId", async (c) => {
  const huntId = c.req.param("huntId");
  const [row] = await db.delete(hunts).where(eq(hunts.id, huntId)).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

export const adminRoutes = admin;
export const apiRoutes = api;
