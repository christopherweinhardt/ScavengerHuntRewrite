import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "scavenger_team_token";
const SLUG_KEY = "scavenger_hunt_slug";

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

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, SLUG_KEY]);
}
