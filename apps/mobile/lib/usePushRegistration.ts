import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import {
  onNativePushTokenPossiblyChanged,
  resetPushRegistrationState,
  requestPushRegistrationSync,
  schedulePushRegistrationSync,
} from "./pushSync";

export { requestPushRegistrationSync, resetPushRegistrationState };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registers this device for hunt push when signed in. Throttled and cached so Expo’s
 * getExpoPushToken / updateDeviceToken are not called on every navigation.
 */
export function usePushRegistration(): void {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (Platform.OS === "web") return;

    schedulePushRegistrationSync();

    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        schedulePushRegistrationSync();
      }
      appState.current = next;
    });

    const tokenSub = Notifications.addPushTokenListener(() => {
      onNativePushTokenPossiblyChanged();
    });

    return () => {
      sub.remove();
      tokenSub.remove();
    };
  }, []);
}
