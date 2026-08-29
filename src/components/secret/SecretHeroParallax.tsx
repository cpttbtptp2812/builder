import { useRef, useState } from "react";

/** 英雄区 — 鼠标视差 */
export function SecretHeroParallax({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--px", String(x * 18));
    el.style.setProperty("--py", String(y * 14));
  }

  return (
    <header
      ref={ref}
      className={`secret-hero secret-hero-parallax ${className}`.trim()}
      onMouseMove={onMove}
    >
      <div className="secret-hero-shimmer" aria-hidden="true" />
      {children}
    </header>
  );
}

/** 长按名字 — 心雨 */
export function SecretNameHold({
  name,
  revealed,
  onHeartBurst,
}: {
  name: string;
  revealed: boolean;
  onHeartBurst: (x: number, y: number) => void;
}) {
  const timer = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);
  const [charged, setCharged] = useState(false);

  function start(e: React.PointerEvent) {
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setCharged(true);
      onHeartBurst(e.clientX, e.clientY);
    }, 1200);
  }

  function end() {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
  }

  return (
    <p
      className={`secret-hero-name${revealed ? " show" : ""}${holding ? " hold" : ""}${charged ? " charged" : ""}`}
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={end}
      title="长按试试"
    >
      {name}
      {holding && !charged && <span className="secret-name-ring" />}
    </p>
  );
}
