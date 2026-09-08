import { useEffect, useRef, useState, type PointerEvent } from "react";
import { AgentProductDemo } from "../fx/AgentProductDemo";

const POS_KEY = "ua-hub-dock-pos";
const FAB = 52;

type Pos = { left: number; top: number };

function clamp(left: number, top: number): Pos {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    left: Math.min(Math.max(12, left), Math.max(12, w - FAB - 12)),
    top: Math.min(Math.max(12, top), Math.max(12, h - FAB - 12)),
  };
}

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pos;
    if (typeof p.left !== "number" || typeof p.top !== "number") return null;
    return clamp(p.left, p.top);
  } catch {
    return null;
  }
}

function defaultPos(): Pos {
  return clamp(window.innerWidth - FAB - 18, window.innerHeight - FAB - 18);
}

export function HubChatDock() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>(() => loadPos() ?? defaultPos());
  const drag = useRef<{ ox: number; oy: number; sl: number; st: number; moved: boolean; t: number } | null>(null);
  const skipClick = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p.left, p.top));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { ox: e.clientX, oy: e.clientY, sl: pos.left, st: pos.top, moved: false, t: Date.now() };
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.ox;
    const dy = e.clientY - d.oy;
    if (!d.moved && dx * dx + dy * dy < 256) return;
    d.moved = true;
    setPos(clamp(d.sl + dx, d.st + dy));
  }

  function onPointerUp(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (d?.moved && Date.now() - d.t > 160) {
      skipClick.current = true;
      setPos((p) => {
        localStorage.setItem(POS_KEY, JSON.stringify(p));
        return p;
      });
    }
  }

  const openUp = pos.top > window.innerHeight * 0.45;
  const openLeft = pos.left > window.innerWidth * 0.45;

  return (
    <div className="hub-dock" style={{ left: pos.left, top: pos.top, right: "auto", bottom: "auto" }}>
      {open && (
        <div
          className={`hub-dock-panel${openUp ? " open-up" : " open-down"}${openLeft ? " open-left" : " open-right"}`}
          role="dialog"
          aria-label="UniAgent 对话"
        >
          <header className="hub-dock-head">
            <strong className="hub-dock-title">UniAgent 对话</strong>
            <button type="button" className="hub-dock-close" onClick={() => setOpen(false)} aria-label="关闭">
              ×
            </button>
          </header>
          <div className="hub-dock-body is-run">
            <AgentProductDemo hubMode />
          </div>
        </div>
      )}
      <button
        type="button"
        className={`hub-dock-fab${open ? " on" : ""}`}
        aria-expanded={open}
        aria-label={open ? "收起对话" : "打开 UniAgent 对话，可拖到别处"}
        title="拖动换位置 · 单击打开"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onClick={() => {
          if (skipClick.current) {
            skipClick.current = false;
            return;
          }
          setOpen((v) => !v);
        }}
      >
        <span className="hub-dock-fab-mark">UA</span>
      </button>
    </div>
  );
}
