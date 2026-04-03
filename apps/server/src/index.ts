import http from "node:http";
import { getRequestListener } from "@hono/node-server";
import { Server } from "socket.io";
import app from "./app.js";
import { config } from "./config.js";
import { setIo } from "./io.js";
import { registerSocket } from "./socket/register.js";

const server = http.createServer(getRequestListener(app.fetch));

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

setIo(io);
registerSocket(io);

server.listen(config.port, () => {
  console.log(`API + WebSocket listening on http://localhost:${config.port}`);
});
