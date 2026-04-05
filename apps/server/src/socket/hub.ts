import type { Server as IOServer } from "socket.io";
import type { Challenge, HuntPublic } from "@scavenger/types";

export type HuntIo = IOServer;

export function emitChallengeUpsert(io: HuntIo, huntId: string, c: Challenge) {
  io.to(roomForHunt(huntId)).emit("challenge:upsert", c);
}

export function emitChallengeRemove(
  io: HuntIo,
  huntId: string,
  payload: { id: string; huntId: string }
) {
  io.to(roomForHunt(huntId)).emit("challenge:remove", payload);
}

export function emitHuntMeta(io: HuntIo, huntId: string, hunt: HuntPublic) {
  io.to(roomForHunt(huntId)).emit("hunt:meta", hunt);
}

/** Tell clients to refresh completion state (approval, rejection). */
export function emitCompletionStatus(
  io: HuntIo,
  huntId: string,
  payload: {
    teamId: string;
    challengeId: string;
    status: "approved" | "pending" | "none";
  }
) {
  io.to(roomForHunt(huntId)).emit("completion:status", payload);
}

export function roomForHunt(huntId: string): string {
  return `hunt:${huntId}`;
}
