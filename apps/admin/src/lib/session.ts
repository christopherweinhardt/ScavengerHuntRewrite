const KEY_ADMIN = "scavenger_admin_key";
const KEY_BASE = "scavenger_admin_api_base";

const defaultBase =
  (typeof import.meta.env.VITE_API_BASE_URL === "string" &&
    import.meta.env.VITE_API_BASE_URL) ||
  "http://localhost:3000";

export function getApiBaseUrl(): string {
  if (typeof sessionStorage === "undefined") return defaultBase;
  return sessionStorage.getItem(KEY_BASE) || defaultBase;
}

export function setApiBaseUrl(url: string): void {
  sessionStorage.setItem(KEY_BASE, url.replace(/\/$/, ""));
}

export function getAdminKey(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(KEY_ADMIN);
}

export function setAdminKey(key: string): void {
  sessionStorage.setItem(KEY_ADMIN, key);
}

export function clearAdminSession(): void {
  sessionStorage.removeItem(KEY_ADMIN);
  sessionStorage.removeItem(KEY_BASE);
}

export function isConfigured(): boolean {
  return Boolean(getAdminKey()?.trim());
}
