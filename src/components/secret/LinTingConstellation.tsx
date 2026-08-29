import { useState } from "react";
import { secretRomance } from "../../data/secretRomance";

/** 林婷 — 悬停连线星座 */
export function LinTingConstellation({ onHeartBurst }: { onHeartBurst?: (x: number, y: number) => void }) {
  const [lit, setLit] = useState<Set<number>>(new Set());
  const chars = secretRomance.herName.split("");
  const allLit = lit.size >= chars.length;

  function toggle(i: number, e: React.MouseEvent) {
    setLit((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      if (next.size >= chars.length) {
        onHeartBurst?.(e.clientX, e.clientY);
      }
      return next;
    });
  }

  return (
    <div className={`secret-constellation${allLit ? " complete" : ""}`}>
      <p className="secret-constellation-hint">
        {allLit ? "✦ 三个字，都亮了 ✦" : "点亮她的名字"}
      </p>
      <div className="secret-constellation-stars">
        {chars.map((ch, i) => (
          <button
            key={i}
            type="button"
            className={lit.has(i) ? "on" : ""}
            onClick={(e) => toggle(i, e)}
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            <span className="secret-star-glow" />
            {ch}
          </button>
        ))}
        <svg className="secret-constellation-lines" viewBox="0 0 200 40" aria-hidden="true">
          <line x1="40" y1="20" x2="100" y2="20" className={lit.has(0) && lit.has(1) ? "on" : ""} />
          <line x1="100" y1="20" x2="160" y2="20" className={lit.has(1) && lit.has(2) ? "on" : ""} />
        </svg>
      </div>
    </div>
  );
}
