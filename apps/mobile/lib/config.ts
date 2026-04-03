import Constants from "expo-constants";

/** API / Socket base URL (no trailing slash). Use LAN IP for real devices. */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host && host !== "localhost") {
    return `http://${host}:3000`;
  }
  return "http://localhost:3000";
}
