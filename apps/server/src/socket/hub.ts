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

export function roomForHunt(huntId: string): string {
  return `hunt:${huntId}`;
}
