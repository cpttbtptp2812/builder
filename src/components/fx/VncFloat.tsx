import { useRef, useState } from "react";

/** 可拖拽 VNC 浮窗 — Agent 工作流 */
export function VncFloat() {
  const [pos, setPos] = useState({ x: 24, y: 80 });
  const [drag, setDrag] = useState(false);
  const origin = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const [running, setRunning] = useState(true);

  return (
    <div
      className="fx-vnc"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest(".fx-vnc-bar")) {
          setDrag(true);
          origin.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
        }
      }}
      onMouseMove={(e) => {
        if (!drag) return;
        setPos({
          x: origin.current.px + e.clientX - origin.current.x,
          y: origin.current.py + e.clientY - origin.current.y,
        });
      }}
      onMouseUp={() => setDrag(false)}
    >
      <div className="fx-vnc-bar">
        <span>Cloud VNC · 远程浏览器</span>
        <div>
          <button type="button" onClick={() => setRunning((r) => !r)}>
            {running ? "⏸" : "▶"}
          </button>
        </div>
      </div>
      <div className={`fx-vnc-screen ${running ? "run" : ""}`}>
        <div className="fx-vnc-cursor" />
        <p>automating… click #submit</p>
      </div>
    </div>
  );
}
