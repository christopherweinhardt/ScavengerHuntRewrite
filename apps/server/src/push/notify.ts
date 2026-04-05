import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { pushTokens, teams } from "../db/schema.js";
import { sendExpoPush } from "./expo.js";

async function tokensForHunt(huntId: string): Promise<string[]> {
  const rows = await db
    .select({ token: pushTokens.expoPushToken })
    .from(pushTokens)
    .innerJoin(teams, eq(pushTokens.teamId, teams.id))
    .where(eq(teams.huntId, huntId));
  return [...new Set(rows.map((r) => r.token))];
}

async function tokensForTeam(teamId: string): Promise<string[]> {
  const rows = await db
    .select({ token: pushTokens.expoPushToken })
    .from(pushTokens)
    .where(eq(pushTokens.teamId, teamId));
  return rows.map((r) => r.token);
}

export function notifyTeamsInHunt(
  huntId: string,
  notification: { title: string; body: string; data?: Record<string, unknown> }
): void {
  void (async () => {
    const tokens = await tokensForHunt(huntId);
    await sendExpoPush(tokens, notification);
  })().catch((e) => console.error("[push] notifyTeamsInHunt", e));
}

export function notifyTeam(
  teamId: string,
  notification: { title: string; body: string; data?: Record<string, unknown> }
): void {
  void (async () => {
    const tokens = await tokensForTeam(teamId);
    await sendExpoPush(tokens, notification);
  })().catch((e) => console.error("[push] notifyTeam", e));
}
