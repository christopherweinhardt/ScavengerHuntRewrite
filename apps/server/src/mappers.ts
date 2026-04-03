import type { Challenge, HuntPublic } from "@scavenger/types";
import type { challenges, hunts } from "./db/schema.js";

type HuntRow = typeof hunts.$inferSelect;
type ChallengeRow = typeof challenges.$inferSelect;

export function toHuntPublic(row: HuntRow): HuntPublic {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    startsAt: row.startsAt.toISOString(),
    durationSeconds: row.durationSeconds,
    status: row.status as HuntPublic["status"],
  };
}

export function toChallenge(row: ChallengeRow): Challenge {
  return {
    id: row.id,
    huntId: row.huntId,
    title: row.title,
    description: row.description,
    type: row.type as Challenge["type"],
    isBonus: row.isBonus,
    sortOrder: row.sortOrder,
    active: row.active,
    points: row.points,
  };
}
