import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiRegisterPushToken } from "./api";
import { getToken } from "./session";
import { setStoredExpoPushToken } from "./pushTokenStorage";

const ANDROID_CHANNEL_ID = "default";

let cachedExpoPushToken: string | null = null;
let lastBackendSyncKey: string | null = null;
let androidChannelReady = false;
let syncTail: Promise<void> = Promise.resolve();

const NATIVE_TOKEN_LISTENER_COOLDOWN_MS = 60_000;
let lastNativeTokenRefreshAt = 0;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

function enqueuePushSync(): void {
  syncTail = syncTail
    .then(() => performPushSync())
    .catch(() => {
      /* keep chain alive */
    });
}

async function performPushSync(): Promise<void> {
  if (Platform.OS === "web") return;
  if (!Device.isDevice) return;

  const jwt = await getToken();
  if (!jwt) return;

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
      ?.eas?.projectId;
  if (!projectId) return;

  if (Platform.OS === "android" && !androidChannelReady) {
    await ensureAndroidChannel();
    androidChannelReady = true;
  }

  const perm = await Notifications.getPermissionsAsync();
  const status =
    perm.status === "granted"
      ? perm.status
      : (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return;

  let expoTokenStr = cachedExpoPushToken;
  if (!expoTokenStr) {
    const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
    expoTokenStr = expoToken.data ?? null;
    if (!expoTokenStr) return;
    cachedExpoPushToken = expoTokenStr;
  }

  const syncKey = `${jwt}\n${expoTokenStr}`;
  if (syncKey === lastBackendSyncKey) return;

  const platform = Platform.OS === "ios" ? "ios" : "android";
  await apiRegisterPushToken(expoTokenStr, platform);
  await setStoredExpoPushToken(expoTokenStr);
  lastBackendSyncKey = syncKey;
}

/** After storing a new team JWT (join). */
export function requestPushRegistrationSync(): void {
  enqueuePushSync();
}

/** Mount / foreground / throttled native token rotation. */
export function schedulePushRegistrationSync(): void {
  enqueuePushSync();
}

/** After logout: next session must POST to our API again. */
export function resetPushRegistrationState(): void {
  lastBackendSyncKey = null;
}

export function onNativePushTokenPossiblyChanged(): void {
  const now = Date.now();
  if (now - lastNativeTokenRefreshAt < NATIVE_TOKEN_LISTENER_COOLDOWN_MS) {
    return;
  }
  lastNativeTokenRefreshAt = now;
  cachedExpoPushToken = null;
  lastBackendSyncKey = null;
  enqueuePushSync();
}
