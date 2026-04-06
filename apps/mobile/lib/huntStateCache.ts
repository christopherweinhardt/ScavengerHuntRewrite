import type { QueryClient } from "@tanstack/react-query";
import type { HuntStateResponse } from "./api";

export type CompletionSocketStatus = "approved" | "pending" | "none";

/** Match socket/API ids to the same casing as `challenges[].id` for Set lookups in the UI. */
function canonicalChallengeId(
  old: HuntStateResponse,
  raw: string
): string {
  const t = String(raw).trim().toLowerCase();
  const fromCh = old.challenges.find((c) => c.id.toLowerCase() === t);
  if (fromCh) return fromCh.id;
  const fromDone = old.completedChallengeIds.find(
    (id) => id.toLowerCase() === t
  );
  if (fromDone) return fromDone;
  const fromPen = (old.pendingChallengeIds ?? []).find(
    (id) => id.toLowerCase() === t
  );
  if (fromPen) return fromPen;
  return String(raw).trim();
}

/** Merge a completion status into cached `/me/state` (matches server rules). */
export function applyCompletionToHuntState(
  old: HuntStateResponse | undefined,
  challengeId: string,
  status: CompletionSocketStatus
): HuntStateResponse | undefined {
  if (!old) return old;
  const cid = canonicalChallengeId(old, challengeId);
  const completed = new Set(old.completedChallengeIds);
  const pending = new Set(old.pendingChallengeIds ?? []);
  for (const id of [...completed]) {
    if (id.toLowerCase() === cid.toLowerCase()) completed.delete(id);
  }
  for (const id of [...pending]) {
    if (id.toLowerCase() === cid.toLowerCase()) pending.delete(id);
  }
  if (status === "approved") completed.add(cid);
  if (status === "pending") pending.add(cid);
  return {
    ...old,
    completedChallengeIds: [...completed],
    pendingChallengeIds: [...pending],
  };
}

/**
 * Cancel in-flight `/me/state` fetches, then patch cache. Avoids a stale refetch
 * completing after this update and wiping the new completion state (e.g. after reject).
 */
export async function syncCompletionIntoHuntState(
  qc: QueryClient,
  challengeId: string,
  status: CompletionSocketStatus
): Promise<void> {
  await qc.cancelQueries({ queryKey: ["huntState"] });
  qc.setQueryData<HuntStateResponse>(["huntState"], (old) =>
    applyCompletionToHuntState(old, challengeId, status)
  );
}
