import { useEffect, useRef, useState } from "react";
import { secretRomance } from "../../data/secretRomance";
import type { InterludeStep } from "../../data/secretRomance";
import { ChatBubble } from "./ChatStreamScene";
import { RomanticNarration } from "./RomanticNarration";

const PAUSE_AFTER = 2000;

function stepLabel(step: InterludeStep) {
  if (step.kind === "divider") return step.sub ? `${step.label} · ${step.sub}` : step.label;
  if (step.kind === "dialogue") return step.from === "her" ? `林婷：${step.text}` : step.text;
  return step.text;
}

function visualForIndex(index: number) {
  let noonTea = false;
  let lightLevel = 0;
  let scentPower = 0;
  for (let i = 0; i <= index; i++) {
    const s = secretRomance.interludeSteps[i];
    if (!s || s.kind !== "divider") continue;
    if (s.fx === "noon") noonTea = true;
    if (s.fx === "dark") lightLevel = 3;
    if (s.fx === "scent") scentPower = 1;
  }
  return { noonTea, lightLevel, scentPower };
}

function InterludeVisual({
  fx,
  lightLevel,
  scentPower,
  teaSteep,
}: {
  fx: "noon" | "fade" | "dark" | "scent" | "tea";
  lightLevel: number;
  scentPower: number;
  teaSteep: boolean;
}) {
  if (fx === "noon")
    return (
      <div className={`secret-interlude-visual noon${teaSteep ? " steeped" : ""}`}>
        <div className={`secret-cup-wrap${teaSteep ? " brewing pouring" : ""}`}>
          <div className="secret-cup">
            <div className="secret-cup-leaves" />
            <div className="secret-cup-liquid" />
          </div>
          {teaSteep && (
            <div className="secret-steam">
              <span /><span /><span />
            </div>
          )}
        </div>
        {teaSteep && <p className="secret-story-moment">独自喝下了那一口茶</p>}
      </div>
    );

  if (fx === "dark")
    return (
      <div className={`secret-interlude-visual dark lit-${lightLevel}`}>
        <div className="secret-dark-room">
          <span className="secret-door-glow" />
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`secret-light-bulb${lightLevel >= n ? " on" : ""}`}
              style={{ left: `${18 + n * 22}%` }}
            />
          ))}
          <span className="secret-silhouette" />
          <span className="secret-silhouette delay" />
          <span className="secret-silhouette delay2" />
        </div>
        {lightLevel >= 3 && <p className="secret-story-moment">义工们陆续走进来</p>}
      </div>
    );

  if (fx === "scent")
    return (
      <div className="secret-interlude-visual scent" style={{ "--scent": scentPower } as React.CSSProperties}>
        <div className="secret-scent-orb cyan" />
        <div className="secret-scent-orb silver" />
        <div className="secret-scent-wave" />
        <p className={`secret-scent-name${scentPower > 0.85 ? " found" : ""}`}>
          {scentPower > 0.85 ? secretRomance.herName : "…"}
        </p>
        {scentPower > 0.85 && <p className="secret-story-moment">先感觉她，再看见她</p>}
      </div>
    );

  if (fx === "tea")
    return (
      <div className="secret-interlude-visual tea">
        <div className="secret-two-cups">
          <div className="secret-cup-wrap brewing"><div className="secret-cup"><div className="secret-cup-liquid" /></div></div>
          <div className="secret-cairdeas">与 {secretRomance.herName} 对坐</div>
          <div className="secret-cup-wrap brewing"><div className="secret-cup"><div className="secret-cup-liquid" /></div></div>
        </div>
        <p className="secret-story-moment">把白天没说完的话，都在夜里补上</p>
      </div>
    );

  return (
    <div className="secret-interlude-visual fade">
      <div className="secret-fade-heart">♡</div>
      <p className="secret-story-moment">我以为，见不到了</p>
    </div>
  );
}

/** 去上课之后 · 讲述式自动过渡 */
export function StoryInterludeScene({
  onComplete,
  onBurst,
  onHearts,
  initialIndex = 0,
  paused = false,
  onStepReached,
  onResume,
}: {
  onComplete: () => void;
  onBurst?: (x: number, y: number) => void;
  onHearts?: (x: number, y: number) => void;
  initialIndex?: number;
  paused?: boolean;
  onStepReached?: (index: number, id: string, label: string) => void;
  onResume?: () => void;
}) {
  const steps = secretRomance.interludeSteps;
  const initVis = visualForIndex(initialIndex);
  const [index, setIndex] = useState(initialIndex);
  const [fade, setFade] = useState(false);
  const [noonTea, setNoonTea] = useState(initVis.noonTea);
  const [lightLevel, setLightLevel] = useState(initVis.lightLevel);
  const [scentPower, setScentPower] = useState(initVis.scentPower);
  const [reviewMode, setReviewMode] = useState(paused);
  const advanceTimer = useRef<number | null>(null);
  const done = index >= steps.length;
  const step = steps[index];
  const progress = done ? 100 : Math.round((index / steps.length) * 100);

  useEffect(() => {
    const vis = visualForIndex(initialIndex);
    setIndex(initialIndex);
    setNoonTea(vis.noonTea);
    setLightLevel(vis.lightLevel);
    setScentPower(vis.scentPower);
    setReviewMode(paused);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, [initialIndex, paused]);

  useEffect(() => {
    if (done || !step) return;
    onStepReached?.(index, `interlude-${index}`, stepLabel(step));
  }, [index, done, step, onStepReached]);

  function scheduleAdvance(ms: number) {
    if (reviewMode) return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => goNext(), ms);
  }

  function goNext() {
    setFade(true);
    window.setTimeout(() => {
      setIndex((i) => {
        const next = i + 1;
        if (next >= steps.length) window.setTimeout(onComplete, 900);
        return next;
      });
      setFade(false);
    }, 480);
  }

  useEffect(() => {
    if (reviewMode || done || !step) return;

    const vis = visualForIndex(index);
    setNoonTea(vis.noonTea);
    setLightLevel(vis.lightLevel);
    setScentPower(vis.scentPower);

    if (step.kind !== "divider") return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.42;

    if (step.fx === "noon") {
      const tPour = window.setTimeout(() => {
        setNoonTea(true);
        onBurst?.(cx, cy);
      }, 500);
      scheduleAdvance(3600);
      return () => {
        clearTimeout(tPour);
        if (advanceTimer.current) clearTimeout(advanceTimer.current);
      };
    }

    if (step.fx === "dark") {
      const t1 = window.setTimeout(() => setLightLevel(1), 700);
      const t2 = window.setTimeout(() => setLightLevel(2), 1400);
      const t3 = window.setTimeout(() => {
        setLightLevel(3);
        onBurst?.(cx, cy);
      }, 2100);
      scheduleAdvance(4200);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        if (advanceTimer.current) clearTimeout(advanceTimer.current);
      };
    }

    if (step.fx === "scent") {
      let p = scentPower;
      const tick = window.setInterval(() => {
        p = Math.min(1, p + 0.04);
        setScentPower(p);
        if (p >= 1) {
          clearInterval(tick);
          onHearts?.(cx, cy);
        }
      }, 70);
      scheduleAdvance(4500);
      return () => {
        clearInterval(tick);
        if (advanceTimer.current) clearTimeout(advanceTimer.current);
      };
    }

    if (step.fx === "tea") {
      onHearts?.(cx, cy);
      scheduleAdvance(3600);
      return () => {
        if (advanceTimer.current) clearTimeout(advanceTimer.current);
      };
    }

    scheduleAdvance(2800);
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [index, done, step, reviewMode]);

  useEffect(() => {
    if (reviewMode || done || !step || step.kind !== "dialogue") return;
    onHearts?.(window.innerWidth / 2, window.innerHeight * 0.45);
    scheduleAdvance(2800);
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [index, done, step, reviewMode]);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  return (
    <section
      className={`secret-interlude cinematic${fade ? " fading" : ""}${reviewMode ? " review" : ""}`}
      data-time-step={`interlude-${Math.min(index, steps.length - 1)}`}
    >
      <div className="secret-cinematic-bar" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <h2>我以为，见不到了</h2>
      <p className="secret-interlude-lead">
        {reviewMode ? "时光机 · 回看这一刻" : done ? "但她来了。" : "故事，正在讲述——"}
      </p>

      {reviewMode && (
        <button
          type="button"
          className="secret-time-resume"
          onClick={() => {
            setReviewMode(false);
            onResume?.();
          }}
        >
          从这里继续播放 ▶
        </button>
      )}

      <div className={`secret-interlude-body${step ? ` fx-${step.kind === "divider" ? step.fx : step.kind}` : ""}`}>
        <div key={index} className="secret-interlude-step">
          {!done && step?.kind === "divider" && (
            <>
              <InterludeVisual fx={step.fx} lightLevel={lightLevel} scentPower={scentPower} teaSteep={noonTea} />
              <div className="secret-interlude-divider">
                <span className="secret-interlude-line grow" />
                <div className="secret-interlude-label pop-in">
                  <strong>{step.label}</strong>
                  {step.sub && <small>{step.sub}</small>}
                </div>
                <span className="secret-interlude-line grow delay" />
              </div>
            </>
          )}

          {!done && step?.kind === "narration" && (
            reviewMode ? (
              <p className="secret-interlude-narration review">{step.text}</p>
            ) : (
              <RomanticNarration
                text={step.text}
                mood={step.mood}
                fragments={step.fragments}
                onDone={() => scheduleAdvance(PAUSE_AFTER)}
              />
            )
          )}

          {!done && step?.kind === "dialogue" && (
            <div className="secret-interlude-dialogue">
              <ChatBubble line={step} pop={!reviewMode} />
            </div>
          )}

          {done && <p className="secret-interlude-done">晚上，茶还在。林婷也在。♥</p>}
        </div>
      </div>
    </section>
  );
}
