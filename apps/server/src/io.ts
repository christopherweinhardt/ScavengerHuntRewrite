import type { Server as IOServer } from "socket.io";

let io: IOServer | null = null;

export function setIo(server: IOServer): void {
  io = server;
}

export function getIo(): IOServer {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}
