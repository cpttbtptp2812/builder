/** 飘落茶叶 · 萤火虫 */
export function SecretFloatingLayer() {
  const leaves = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    left: `${(i * 17 + 5) % 100}%`,
    delay: `${(i * 0.7) % 12}s`,
    dur: `${10 + (i % 6) * 2}s`,
    rot: `${(i * 40) % 360}deg`,
    scale: 0.6 + (i % 4) * 0.15,
  }));

  const flies = Array.from({ length: 14 }, (_, i) => ({
    id: i,
    left: `${(i * 23 + 8) % 95}%`,
    top: `${(i * 19 + 10) % 80}%`,
    delay: `${(i * 1.3) % 8}s`,
    dur: `${6 + (i % 5) * 1.5}s`,
  }));

  return (
    <div className="secret-float-layer" aria-hidden="true">
      {leaves.map((l) => (
        <span
          key={l.id}
          className="secret-leaf"
          style={{
            left: l.left,
            animationDelay: l.delay,
            animationDuration: l.dur,
            transform: `rotate(${l.rot}) scale(${l.scale})`,
          }}
        />
      ))}
      {flies.map((f) => (
        <span
          key={f.id}
          className="secret-firefly"
          style={{
            left: f.left,
            top: f.top,
            animationDelay: f.delay,
            animationDuration: f.dur,
          }}
        />
      ))}
    </div>
  );
}
