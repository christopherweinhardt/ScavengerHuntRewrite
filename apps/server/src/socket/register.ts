import type { Server as IOServer } from "socket.io";
import { verifyTeamJwt } from "../auth/jwt.js";
import { db } from "../db/index.js";
import { teams } from "../db/schema.js";
import { and, eq } from "drizzle-orm";
import { roomForHunt, roomForTeam } from "./hub.js";

export function registerSocket(io: IOServer): void {
  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.headers["x-team-token"] as string | undefined);
      if (!token) return next(new Error("auth required"));
      const team = await verifyTeamJwt(token);
      const exists = await db.query.teams.findFirst({
        where: and(eq(teams.id, team.teamId), eq(teams.huntId, team.huntId)),
      });
      if (!exists) return next(new Error("auth failed"));
      socket.data.team = team;
      next();
    } catch {
      next(new Error("auth failed"));
    }
  });

  io.on("connection", (socket) => {
    const huntId = socket.data.team?.huntId as string | undefined;
    const teamId = socket.data.team?.teamId as string | undefined;
    if (huntId) {
      void socket.join(roomForHunt(huntId));
    }
    if (teamId) {
      void socket.join(roomForTeam(teamId));
    }
  });
}
