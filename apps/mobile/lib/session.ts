import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "scavenger_team_token";
const SLUG_KEY = "scavenger_hunt_slug";
const TEAM_ID_KEY = "scavenger_team_id";

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setSlug(slug: string): Promise<void> {
  await AsyncStorage.setItem(SLUG_KEY, slug);
}

export async function getSlug(): Promise<string | null> {
  return AsyncStorage.getItem(SLUG_KEY);
}

export async function setTeamId(teamId: string): Promise<void> {
  await AsyncStorage.setItem(TEAM_ID_KEY, teamId);
}

function decodeTeamIdFromToken(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const pad = part.length % 4 === 0 ? "" : "=".repeat(4 - (part.length % 4));
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const json = atob(b64);
    const p = JSON.parse(json) as { teamId?: string };
    return typeof p.teamId === "string" ? p.teamId : null;
  } catch {
    return null;
  }
}

export async function getTeamId(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(TEAM_ID_KEY);
  if (stored) return stored;
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  return decodeTeamIdFromToken(token);
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, SLUG_KEY, TEAM_ID_KEY]);
}
