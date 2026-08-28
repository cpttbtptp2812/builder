import { useEffect, useState } from "react";

const CHUNKS = [
  { name: "main.js", size: 42, color: "#818cf8", app: "主应用 shell" },
  { name: "replay.js", size: 28, color: "#5eead4", app: "ReplaySDK 懒加载" },
  { name: "vendor-react", size: 35, color: "#f0b429", app: "共享 vendor" },
  { name: "lazy-flow", size: 18, color: "#fb923c", app: "费控子应用" },
  { name: "gzip-cache", size: -22, color: "#22c55e", app: "构建优化" },
];

/** Bundle 体积 waterfall — 点击色块查看 chunk */
export function BundleWaterfall({ onSelect }: { onSelect?: (name: string) => void }) {
  const [w, setW] = useState(0);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    setW(0);
    const t = window.setTimeout(() => setW(1), 80);
    return () => clearTimeout(t);
  }, []);

  let acc = 0;
  const total = CHUNKS.reduce((s, c) => s + Math.abs(c.size), 0);

  return (
    <div className="fx-waterfall">
      <div className="fx-wf-track">
        {CHUNKS.map((c, i) => {
          const pct = (Math.abs(c.size) / total) * 100 * w;
          const left = (acc / total) * 100;
          acc += Math.abs(c.size);
          return (
            <button
              key={c.name}
              type="button"
              className={`fx-wf-seg ${active === c.name ? "on" : ""}`}
              title={`${c.name} ${c.size > 0 ? "+" : ""}${c.size}KB · ${c.app}`}
              onClick={() => {
                setActive(c.name);
                onSelect?.(c.name);
              }}
              style={{
                width: `${pct}%`,
                left: `${left * w}%`,
                background: c.color,
                transitionDelay: `${i * 100}ms`,
              }}
            />
          );
        })}
      </div>
      <ul className="fx-wf-legend">
        {CHUNKS.map((c) => (
          <li key={c.name}>
            <i style={{ background: c.color }} />
            {c.name} {c.size > 0 ? "+" : ""}
            {c.size}KB
          </li>
        ))}
      </ul>
    </div>
  );
}
