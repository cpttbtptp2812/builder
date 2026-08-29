import { useRef, useState } from "react";
import { secretRomance } from "../../data/secretRomance";

/** 青 / 银 — 长按融合爆发 */
export function SoulColorsPanel({ onBurst }: { onBurst?: (x: number, y: number) => void }) {
  const { cyan, silver } = secretRomance.colors;
  const [active, setActive] = useState<"cyan" | "silver" | "blend" | null>(null);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number; kind: "cyan" | "silver" }[]>([]);
  const [mergeCharge, setMergeCharge] = useState(0);
  const mergeTimer = useRef<number | null>(null);

  function burst(e: React.MouseEvent<HTMLButtonElement>, kind: "cyan" | "silver") {
    setActive(kind);
    onBurst?.(e.clientX, e.clientY);
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const batch = Array.from({ length: 14 }, (_, i) => ({
      id: Date.now() + i,
      x: cx + (Math.random() - 0.5) * 50,
      y: cy + (Math.random() - 0.5) * 50,
      kind,
    }));
    setSparkles((s) => [...s, ...batch]);
    window.setTimeout(() => {
      setSparkles((s) => s.filter((p) => !batch.some((b) => b.id === p.id)));
    }, 900);
  }

  function startMerge(e: React.PointerEvent) {
    let t = 0;
    mergeTimer.current = window.setInterval(() => {
      t += 1;
      setMergeCharge(t);
      if (t >= 8) {
        setActive("blend");
        onBurst?.(e.clientX, e.clientY);
        if (mergeTimer.current) clearInterval(mergeTimer.current);
      }
    }, 80);
  }

  function endMerge() {
    if (mergeTimer.current) clearInterval(mergeTimer.current);
    setMergeCharge(0);
  }

  return (
    <section className="secret-colors">
      <div className="secret-colors-aurora" aria-hidden="true" />
      <h2>林婷在我眼里的两种颜色</h2>
      <p className="secret-colors-lead">点击绽放 — 或<strong>长按中间</strong>让青与银融合</p>

      <div className="secret-colors-stage">
        <button
          type="button"
          className={`secret-color-orb cyan${active === "cyan" ? " on" : ""}`}
          onClick={(e) => burst(e, "cyan")}
        >
          <span className="secret-color-dot" style={{ background: cyan.hex }} />
          <strong>{cyan.name}</strong>
          <p>{cyan.desc}</p>
        </button>

        <button
          type="button"
          className={`secret-color-merge${active === "blend" ? " on" : ""}${mergeCharge > 0 ? " charging" : ""}`}
          onPointerDown={startMerge}
          onPointerUp={endMerge}
          onPointerLeave={endMerge}
          aria-label="长按融合"
        >
          <span className="secret-merge-ring" style={{ opacity: mergeCharge / 8 }} />
          <span className="secret-merge-icon">✦</span>
          <span>融</span>
        </button>

        <button
          type="button"
          className={`secret-color-orb silver${active === "silver" ? " on" : ""}`}
          onClick={(e) => burst(e, "silver")}
        >
          <span className="secret-color-dot" style={{ background: silver.hex }} />
          <strong>{silver.name}</strong>
          <p>{silver.desc}</p>
        </button>
      </div>

      <div className="secret-spark-layer" aria-hidden="true">
        {sparkles.map((s) => (
          <i key={s.id} className={`secret-spark ${s.kind}`} style={{ left: s.x, top: s.y }} />
        ))}
      </div>

      {active === "blend" && (
        <p className="secret-blend-msg">
          青是林婷的水面，银是林婷的月光。合在一起，就是你那晚在我心里的样子。
        </p>
      )}
    </section>
  );
}
