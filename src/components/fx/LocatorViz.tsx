import { useEffect, useState } from "react";

const STRATEGIES = [
  { name: "CSS Selector", before: 45, after: 92 },
  { name: "XPath", before: 38, after: 78 },
  { name: "表格坐标", before: 52, after: 88 },
  { name: "文本模糊", before: 30, after: 75 },
  { name: "IndexedDB 缓存", before: 60, after: 96 },
];

/** 元素定位策略成功率可视化 70%→90% */
export function LocatorViz() {
  const [phase, setPhase] = useState<"before" | "after">("before");
  const [anim, setAnim] = useState(0);

  useEffect(() => {
    setAnim(0);
    const t = window.setTimeout(() => setAnim(1), 100);
    return () => clearTimeout(t);
  }, [phase]);

  const total = Math.round(
    STRATEGIES.reduce((s, x) => s + (phase === "before" ? x.before : x.after), 0) / STRATEGIES.length,
  );

  return (
    <div className="fx-locator">
      <div className="fx-locator-head">
        <button type="button" className={phase === "before" ? "on" : ""} onClick={() => setPhase("before")}>
          优化前 ~70%
        </button>
        <button type="button" className={phase === "after" ? "on" : ""} onClick={() => setPhase("after")}>
          优化后 ~90%
        </button>
        <strong className="fx-locator-total">{total}%</strong>
      </div>
      <div className="fx-locator-bars">
        {STRATEGIES.map((s, i) => {
          const v = phase === "before" ? s.before : s.after;
          return (
            <div key={s.name} className="fx-bar-row">
              <span>{s.name}</span>
              <div className="fx-bar-track">
                <i style={{ width: anim ? `${v}%` : "0%", transitionDelay: `${i * 80}ms` }} />
              </div>
              <em>{v}%</em>
            </div>
          );
        })}
      </div>
    </div>
  );
}
