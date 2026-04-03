import { z } from "zod";

export const challengeTypeSchema = z.enum(["photo", "video"]);
export type ChallengeType = z.infer<typeof challengeTypeSchema>;

export const huntStatusSchema = z.enum([
  "scheduled",
  "active",
  "paused",
  "finished",
]);
export type HuntStatus = z.infer<typeof huntStatusSchema>;

export const challengeSchema = z.object({
  id: z.string().uuid(),
  huntId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  type: challengeTypeSchema,
  isBonus: z.boolean(),
  sortOrder: z.number().int(),
  active: z.boolean(),
  points: z.number().int().optional(),
});
export type Challenge = z.infer<typeof challengeSchema>;

export const huntPublicSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  startsAt: z.string(), // ISO
  durationSeconds: z.number().int(),
  status: huntStatusSchema,
});
export type HuntPublic = z.infer<typeof huntPublicSchema>;

export const teamJwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  huntId: z.string().uuid(),
  teamId: z.string().uuid(),
  typ: z.literal("team"),
});
export type TeamJwtPayload = z.infer<typeof teamJwtPayloadSchema>;

/** Socket.IO event payloads */
export const socketChallengeUpsertSchema = challengeSchema;
export const socketChallengeRemoveSchema = z.object({
  id: z.string().uuid(),
  huntId: z.string().uuid(),
});

export const socketHuntMetaSchema = huntPublicSchema;
