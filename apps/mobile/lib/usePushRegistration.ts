import * as Notifications from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { syncCompletionIntoHuntState } from "./huntStateCache";
import {
  onNativePushTokenPossiblyChanged,
  resetPushRegistrationState,
  requestPushRegistrationSync,
  schedulePushRegistrationSync,
} from "./pushSync";
import { showSubmissionRejectedAlert } from "./rejectionNotify";

export { requestPushRegistrationSync, resetPushRegistrationState };

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { type?: string } | undefined;
    // Foreground: cache sync runs in listener (same as socket); avoid duplicate system UI.
    if (
      data?.type === "completion_rejected" ||
      data?.type === "completion_approved" ||
      data?.type === "challenge" ||
      data?.type === "challenges_updated"
    ) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: false,
        shouldShowList: true,
      };
    }
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

/**
 * Registers this device for hunt push when signed in. Throttled and cached so Expo’s
 * getExpoPushToken / updateDeviceToken are not called on every navigation.
 */
export function usePushRegistration(): void {
  const qc = useQueryClient();
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

    const receivedSub = Notifications.addNotificationReceivedListener((n) => {
      const data = n.request.content.data as {
        type?: string;
        challengeId?: string;
      };
      const kind = data?.type;

      // Same idea as completion pushes: refetch /me/state when the hunt task list changes.
      if (kind === "challenge" || kind === "challenges_updated") {
        void qc.refetchQueries({ queryKey: ["huntState"], type: "active" });
        return;
      }

      const challengeId = data?.challengeId;
      if (!challengeId) return;

      if (kind === "completion_approved") {
        void syncCompletionIntoHuntState(qc, challengeId, "approved");
        return;
      }
      if (kind === "completion_rejected") {
        const body =
          n.request.content.body ??
          "Your submission was rejected. Please submit a new one.";
        void (async () => {
          await syncCompletionIntoHuntState(qc, challengeId, "none");
          showSubmissionRejectedAlert(challengeId, body);
        })();
      }
    });

    return () => {
      sub.remove();
      tokenSub.remove();
      receivedSub.remove();
    };
  }, [qc]);
}
