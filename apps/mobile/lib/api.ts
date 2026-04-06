import type { Challenge, HuntPublic } from "@scavenger/types";
import { getApiBaseUrl } from "./config";
import {
  clearStoredExpoPushToken,
  getStoredExpoPushToken,
} from "./pushTokenStorage";
import { getToken } from "./session";

const BASE = () => getApiBaseUrl();

async function authHeaders(): Promise<HeadersInit> {
  const token = await getToken();
  if (!token) throw new Error("Not signed in");
  return { Authorization: `Bearer ${token}` };
}

export type JoinResponse = {
  token: string;
  hunt: HuntPublic;
  team: { id: string; name: string };
};

export async function apiJoin(slug: string, joinCode: string): Promise<JoinResponse> {
  const r = await fetch(`${BASE()}/api/auth/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, joinCode }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? `Join failed (${r.status})`);
  }
  return r.json();
}

export type HuntStateResponse = {
  hunt: HuntPublic;
  challenges: Challenge[];
  /** Approved by admin — counts toward progress and points. */
  completedChallengeIds: string[];
  /** Awaiting admin approval (can re-upload). */
  pendingChallengeIds: string[];
};

export async function apiMeState(signal?: AbortSignal): Promise<HuntStateResponse> {
  const r = await fetch(`${BASE()}/api/me/state`, {
    headers: { ...(await authHeaders()) },
    signal,
  });
  if (!r.ok) throw new Error(`State ${r.status}`);
  return r.json();
}

export async function apiPresignPut(body: {
  challengeId: string;
  contentType: string;
  ext: string;
}): Promise<{ url: string; key: string; method: "PUT" }> {
  const r = await fetch(`${BASE()}/api/uploads/presign-put`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `Presign ${r.status}`);
  }
  return r.json();
}

export async function apiCompleteChallenge(
  challengeId: string,
  s3Key: string
): Promise<void> {
  const r = await fetch(`${BASE()}/api/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({ challengeId, s3Key }),
  });
  if (!r.ok) throw new Error(`Complete ${r.status}`);
}

export async function apiRegisterPushToken(
  expoPushToken: string,
  platform: "ios" | "android"
): Promise<void> {
  const r = await fetch(`${BASE()}/api/push/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({ expoPushToken, platform }),
  });
  if (!r.ok) throw new Error(`Push register ${r.status}`);
}

/** Best-effort server unregister; always clears local stored Expo token after. */
export async function unregisterDevicePushToken(): Promise<void> {
  const expoTok = await getStoredExpoPushToken();
  if (!expoTok) return;
  try {
    const jwt = await getToken();
    if (jwt) {
      await fetch(`${BASE()}/api/push/token`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ expoPushToken: expoTok }),
      });
    }
  } catch {
    /* ignore */
  }
  await clearStoredExpoPushToken();
  void import("./pushSync").then((m) => m.resetPushRegistrationState());
}
