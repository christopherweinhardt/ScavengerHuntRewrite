import type { Server as IOServer } from "socket.io";
import { verifyTeamJwt } from "../auth/jwt.js";
import { roomForHunt } from "./hub.js";

export function registerSocket(io: IOServer): void {
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.headers["x-team-token"] as string | undefined);
      if (!token) return next(new Error("auth required"));
      const team = await verifyTeamJwt(token);
      socket.data.team = team;
      next();
    } catch {
      next(new Error("auth failed"));
    }
  });

  io.on("connection", (socket) => {
    const huntId = socket.data.team?.huntId as string | undefined;
    if (huntId) {
      void socket.join(roomForHunt(huntId));
    }
  });
}
