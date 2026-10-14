/** 两个人同时改同一份技能草稿。断线再连会把已保存的更新补上。 */

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { apiUrl, getTeamToken } from "../../lib/apiClient";
import { applyTextEdit } from "../../lib/collabEdit";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function collabUrl(skillId: string): string {
  const http = apiUrl(`/collab`);
  const token = getTeamToken() ?? "";
  const abs = http.startsWith("http") ? http : `${location.protocol}//${location.host}${http}`;
  const ws = abs.replace(/^http/, "ws");
  return `${ws}?room=${encodeURIComponent(skillId)}&token=${encodeURIComponent(token)}`;
}

export function SkillCollab({ skillId, raw, onChange }: { skillId: string; raw: string; onChange: (raw: string) => void }) {
  const [on, setOn] = useState(false);
  const [peers, setPeers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const rawRef = useRef(raw);
  const lastRef = useRef(raw);
  const applying = useRef(false);
  const textRef = useRef<Y.Text | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  rawRef.current = raw;

  useEffect(() => {
    if (!on) return;
    const doc = new Y.Doc();
    const text = doc.getText("draft");
    docRef.current = doc;
    textRef.current = text;
    const ws = new WebSocket(collabUrl(skillId));
    let seeded = false;
    ws.onopen = () => setError(null);
    ws.onerror = () => setError(getTeamToken() ? "协同连接没有建立" : "要先在「规则」里填团队口令，两个人才能改同一份草稿。");
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as { type?: string; update?: string; name?: string; peers?: number };
      if ((msg.type === "sync" || msg.type === "update") && msg.update) {
        Y.applyUpdate(doc, base64ToBytes(msg.update), "remote");
        if (msg.type === "sync") {
          const current = text.toString();
          if (!current && rawRef.current) doc.transact(() => applyTextEdit(text, "", rawRef.current), "local");
          else if (current !== rawRef.current) {
            applying.current = true;
            lastRef.current = current;
            onChange(current);
            applying.current = false;
          }
          seeded = true;
          setPeers(msg.peers && msg.peers > 1 ? [`还有 ${msg.peers - 1} 人`] : []);
        }
      } else if (msg.type === "cursor" && msg.name) {
        setPeers((list) => (list.includes(msg.name!) ? list : [...list, msg.name!]));
      }
    };
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === "remote" || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "update", update: bytesToBase64(update) }));
    };
    doc.on("update", onUpdate);
    const onText = () => {
      if (!seeded) return;
      const next = text.toString();
      if (next === rawRef.current) return;
      applying.current = true;
      lastRef.current = next;
      onChange(next);
      applying.current = false;
    };
    text.observe(onText);
    const name = "同事";
    const hello = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "cursor", name }));
    }, 4000);
    return () => {
      window.clearInterval(hello);
      text.unobserve(onText);
      doc.off("update", onUpdate);
      ws.close();
      doc.destroy();
      textRef.current = null;
      docRef.current = null;
    };
  }, [on, skillId, onChange]);

  useEffect(() => {
    const text = textRef.current;
    const doc = docRef.current;
    if (!on || !text || !doc || applying.current) return;
    const prev = lastRef.current;
    if (prev === raw) return;
    doc.transact(() => applyTextEdit(text, prev, raw), "local");
    lastRef.current = raw;
  }, [raw, on]);

  return (
    <p className="oa-toolbar-lead">
      <button type="button" className="oa-bar-btn" onClick={() => setOn((v) => !v)}>
        {on ? "结束协同" : "和同事一起改"}
      </button>
      {on ? <span> 协同已开{peers.length ? ` · ${peers.join("、")}` : ""}。两边改的字会合并到同一份草稿。</span> : null}
      {error ? <span> {error}</span> : null}
    </p>
  );
}
