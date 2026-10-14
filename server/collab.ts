/** 技能草稿协同：Yjs 更新追加进 SQLite，并转给同一技能房间里的其他人。 */

import * as Y from "yjs";
import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { dbAll, dbGet, dbRun, nowIso } from "./db.ts";
import { teamAccess } from "./skillGate.ts";

type Room = { doc: Y.Doc; sockets: Set<WebSocket> };

const rooms = new Map<string, Room>();

export function attachCollab(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/api/collab") return;
    const access = teamAccess(url.searchParams.get("token") ? `Bearer ${url.searchParams.get("token")}` : undefined, "prod", "publish");
    const roomId = url.searchParams.get("room")?.trim() ?? "";
    if (!access.ok || !roomId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => join(roomId, ws));
  });
}

function join(roomId: string, ws: WebSocket) {
  const room = roomFor(roomId);
  room.sockets.add(ws);
  const state = Y.encodeStateAsUpdate(room.doc);
  ws.send(JSON.stringify({ type: "sync", update: Buffer.from(state).toString("base64"), peers: room.sockets.size }));
  ws.on("message", (raw) => {
    let msg: { type?: string; update?: string; name?: string };
    try {
      msg = JSON.parse(String(raw)) as { type?: string; update?: string; name?: string };
    } catch {
      return;
    }
    if (msg.type === "update" && msg.update) {
      const update = Buffer.from(msg.update, "base64");
      Y.applyUpdate(room.doc, update);
      const seq = nextSeq(roomId);
      dbRun(`INSERT INTO y_updates (room, seq, update_b64, created_at) VALUES (?, ?, ?, ?)`, [roomId, seq, msg.update, nowIso()]);
      const payload = JSON.stringify({ type: "update", update: msg.update });
      for (const other of room.sockets) if (other !== ws && other.readyState === other.OPEN) other.send(payload);
    } else if (msg.type === "cursor" && msg.name) {
      const payload = JSON.stringify({ type: "cursor", name: msg.name });
      for (const other of room.sockets) if (other !== ws && other.readyState === other.OPEN) other.send(payload);
    }
  });
  ws.on("close", () => {
    room.sockets.delete(ws);
    if (!room.sockets.size) rooms.delete(roomId);
  });
}

function roomFor(roomId: string): Room {
  const existing = rooms.get(roomId);
  if (existing) return existing;
  const doc = new Y.Doc();
  const rows = dbAll<{ update_b64: string }>(`SELECT update_b64 FROM y_updates WHERE room = ? ORDER BY seq`, [roomId]);
  for (const row of rows) Y.applyUpdate(doc, Buffer.from(row.update_b64, "base64"));
  const room = { doc, sockets: new Set<WebSocket>() };
  rooms.set(roomId, room);
  return room;
}

function nextSeq(roomId: string): number {
  const row = dbGet<{ seq: number }>(`SELECT COALESCE(MAX(seq), 0) AS seq FROM y_updates WHERE room = ?`, [roomId]);
  return (row?.seq ?? 0) + 1;
}
