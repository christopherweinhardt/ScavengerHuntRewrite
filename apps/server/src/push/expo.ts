import Expo, { type ExpoPushMessage } from "expo-server-sdk";
import { inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { pushTokens } from "../db/schema.js";

const CHUNK = 100;

function createExpoClient(): Expo {
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  return new Expo(accessToken ? { accessToken } : undefined);
}

function stringifyData(
  data: Record<string, unknown> | undefined
): Record<string, string> | undefined {
  if (!data) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "string" ? v : String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Sends Expo push notifications; removes DeviceNotRegistered tokens from DB.
 */
export async function sendExpoPush(
  tokenList: string[],
  notification: { title: string; body: string; data?: Record<string, unknown> }
): Promise<void> {
  const expo = createExpoClient();

  const tokens = [...new Set(tokenList)].filter((t) => Expo.isExpoPushToken(t));
  if (tokens.length === 0) return;

  const data = stringifyData(notification.data);
  const messages: ExpoPushMessage[] = tokens.map((to) => ({
    to,
    sound: "default",
    title: notification.title,
    body: notification.body,
    data,
    android: { channelId: "default" },
  }));

  const toRemove: string[] = [];

  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    const chunkTokens = tokens.slice(i, i + CHUNK);
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, j) => {
        if (ticket.status === "error") {
          const err = ticket.details?.error;
          if (err === "DeviceNotRegistered") {
            const tok = chunkTokens[j];
            if (tok) toRemove.push(tok);
          } else {
            console.warn("[push] ticket error", err, ticket.message);
          }
        }
      });
    } catch (e) {
      console.error("[push] sendPushNotificationsAsync", e);
    }
  }

  if (toRemove.length === 0) return;
  await db.delete(pushTokens).where(inArray(pushTokens.expoPushToken, toRemove));
}
