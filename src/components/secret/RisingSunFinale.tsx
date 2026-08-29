import { useState } from "react";
import { secretRomance } from "../../data/secretRomance";

/** 旭日东升 — 点击升起 + 天空变色 */
export function RisingSunFinale({ onBurst }: { onBurst?: (x: number, y: number) => void }) {
  const [risen, setRisen] = useState(false);
  const [held, setHeld] = useState(false);
  const [clicks, setClicks] = useState(0);

  function rise(e: React.MouseEvent) {
    if (!risen) {
      setRisen(true);
      onBurst?.(e.clientX, e.clientY);
      document.querySelector(".secret-world")?.classList.add("sun-risen");
    } else {
      setClicks((c) => c + 1);
      onBurst?.(e.clientX, e.clientY);
    }
  }

  return (
    <section className={`secret-sun-finale${risen ? " active" : ""}`}>
      <h2>旭 · 东升</h2>
      <p className="secret-sun-lead">
        {secretRomance.herName}在纸条里写：像你名字一样，旭日东升。
      </p>

      <div
        className={`secret-sun-scene${risen ? " risen" : ""}${held ? " hold" : ""}`}
        onMouseDown={() => setHeld(true)}
        onMouseUp={() => setHeld(false)}
        onMouseLeave={() => setHeld(false)}
        onTouchStart={() => setHeld(true)}
        onTouchEnd={() => setHeld(false)}
      >
        <div className="secret-sun-sky" aria-hidden="true" />
        <div className="secret-sun-horizon" />
        <button type="button" className="secret-sun-body" onClick={rise} aria-label="升起太阳">
          <span className="secret-sun-core">旭</span>
          <span className="secret-sun-corona" aria-hidden="true" />
        </button>
        <div className="secret-sun-rays" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, i) => (
            <i key={i} style={{ transform: `rotate(${i * 22.5}deg)` }} />
          ))}
        </div>
      </div>

      {risen && (
        <div className="secret-sun-quote">
          <p>{secretRomance.sunQuote}</p>
          <p className="secret-sun-to">—— 致 {secretRomance.herName}</p>
          {clicks > 0 && (
            <p className="secret-sun-extra">
              又点了 {clicks} 次 —— 光再亮一点，给林婷。
            </p>
          )}
        </div>
      )}

      {!risen && <p className="secret-sun-hint">点击太阳，让它升起来</p>}
      {risen && held && <p className="secret-sun-hint glow">按住 — 光会变得更暖</p>}
      {risen && !held && <p className="secret-sun-hint">继续点太阳 — 光会更亮</p>}
    </section>
  );
}
