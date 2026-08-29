import { useEffect, useState } from "react";
import type { TeaStage } from "../../data/secretRomance";
import { secretRomance } from "../../data/secretRomance";

const { herName } = secretRomance;

const STAGE_TEXT: Record<TeaStage, { label: string; bubble?: string; hint: string }> = {
  idle: { label: "发呆中…", hint: "点击——林婷看见了你在发呆" },
  offer: {
    label: `${herName}走过来了`,
    bubble: `「${herName}：我给你沏壶茶吧？」`,
    hint: "再点一下——上课铃响了",
  },
  bell: {
    label: "上课铃",
    bubble: "来不及接那壶茶，人流把我和林婷推进了教室…",
    hint: "点击——跳到中午，去茶桌看看",
  },
  noon: {
    label: "茶桌",
    bubble: "杯子里留着茶叶。像是林婷备好的。",
    hint: "点击茶杯——自己斟上，喝下那一口",
  },
  drink: {
    label: "午茶",
    bubble: "我把茶喝掉了。像把上午错过的温柔，在中午悄悄补上。",
    hint: "点击——晚上，再见到林婷",
  },
  night: {
    label: "晚上 · 林婷",
    bubble: `${herName}又出现在我眼里：天真善良的青，坚韧的银。`,
    hint: "继续向下 ↓ 和林婷聊天",
  },
};

type Burst = { id: number; x: number; y: number };

export function TeaMomentScene({
  onNight,
  onBurst,
}: {
  onNight: () => void;
  onBurst?: (x: number, y: number) => void;
}) {
  const [stage, setStage] = useState<TeaStage>("idle");
  const [steam, setSteam] = useState(false);
  const [ripples, setRipples] = useState(0);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [shake, setShake] = useState(false);

  const info = STAGE_TEXT[stage];

  useEffect(() => {
    if (stage === "bell") {
      setShake(true);
      const t = window.setTimeout(() => setShake(false), 600);
      return () => clearTimeout(t);
    }
  }, [stage]);

  function spark(x: number, y: number) {
    onBurst?.(x, y);
    const b: Burst = { id: Date.now(), x, y };
    setBursts((s) => [...s, b]);
    window.setTimeout(() => setBursts((s) => s.filter((p) => p.id !== b.id)), 700);
  }

  function advance(e: React.MouseEvent) {
    const x = e.clientX;
    const y = e.clientY;
    spark(x, y);

    if (stage === "idle") setStage("offer");
    else if (stage === "offer") setStage("bell");
    else if (stage === "bell") setStage("noon");
    else if (stage === "noon") {
      setSteam(true);
      setRipples((r) => r + 1);
      setStage("drink");
    } else if (stage === "drink") {
      setStage("night");
      onBurst?.(window.innerWidth / 2, window.innerHeight / 2);
      onNight();
    }
  }

  return (
    <section
      className={`secret-tea-scene${shake ? " shake" : ""}`}
      onClick={advance}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          advance({ clientX: window.innerWidth / 2, clientY: 300 } as React.MouseEvent);
        }
      }}
    >
      <div className="secret-tea-sparks" aria-hidden="true">
        {bursts.map((b) => (
          <span key={b.id} className="secret-tea-spark" style={{ left: b.x, top: b.y }} />
        ))}
      </div>

      <div className="secret-tea-scene-inner">
        <p className="secret-tea-time">{info.label}</p>

        <div className={`secret-tea-stage stage-${stage}`}>
          {stage === "idle" && (
            <div className="secret-daze">
              <span className="secret-daze-face">⋯</span>
              <span className="secret-daze-ring" />
              <span className="secret-daze-ring r2" />
            </div>
          )}

          {(stage === "offer" || stage === "bell") && (
            <div className="secret-her-figure">
              <div className="secret-her-glow cyan" />
              <div className="secret-her-glow silver" />
              <span className="secret-her-name">{herName}</span>
              <span className="secret-her-icon">🍵</span>
            </div>
          )}

          {stage === "bell" && <div className="secret-bell-ring">🔔</div>}

          {(stage === "noon" || stage === "drink") && (
            <div className={`secret-cup-wrap${steam ? " brewing" : ""}`}>
              <div className="secret-cup">
                <div className="secret-cup-leaves" />
                <div className="secret-cup-liquid" />
              </div>
              {steam && (
                <div className="secret-steam">
                  <span /><span /><span />
                </div>
              )}
              {ripples > 0 && <div key={ripples} className="secret-ripple" />}
            </div>
          )}

          {stage === "night" && (
            <div className="secret-night-orbs">
              <p className="secret-night-name">{herName}</p>
              <div className="secret-night-row">
                <div className="secret-orb cyan big pulse">
                  <span>青</span>
                  <small>天真善良</small>
                </div>
                <div className="secret-orb silver big pulse">
                  <span>银</span>
                  <small>坚韧</small>
                </div>
              </div>
            </div>
          )}
        </div>

        {info.bubble && <p className="secret-tea-bubble">{info.bubble}</p>}
        <p className="secret-tea-hint">{info.hint}</p>
      </div>
    </section>
  );
}
