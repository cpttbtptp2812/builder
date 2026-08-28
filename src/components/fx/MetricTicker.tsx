import { useEffect, useState } from "react";

/** 数字滚动计数器 */
export function MetricTicker({
  target,
  suffix = "",
  decimals = 1,
}: {
  target: number;
  suffix?: string;
  decimals?: number;
}) {
  const [v, setV] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      const p = Math.min(1, (now - start) / 1200);
      setV(target * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return (
    <span className="fx-ticker">
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
}
