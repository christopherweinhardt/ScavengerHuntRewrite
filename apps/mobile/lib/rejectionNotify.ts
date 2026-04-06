import { Alert } from "react-native";

const DEDUP_MS = 3000;
const recentByChallenge = new Map<string, number>();

/**
 * One visible rejection alert per challenge within a short window, whether the
 * event came from the hunt socket and/or a push notification.
 */
export function showSubmissionRejectedAlert(
  challengeId: string,
  body: string
): void {
  const now = Date.now();
  const prev = recentByChallenge.get(challengeId);
  if (prev !== undefined && now - prev < DEDUP_MS) return;
  recentByChallenge.set(challengeId, now);
  Alert.alert("Submission rejected", body);
}
