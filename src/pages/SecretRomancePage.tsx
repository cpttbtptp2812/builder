import { useCallback, useEffect, useRef, useState } from "react";

import { Link, Navigate } from "react-router-dom";

import { ChatStreamScene } from "../components/secret/ChatStreamScene";

import { GiftExchangeScene } from "../components/secret/GiftExchangeScene";

import { LinTingConstellation } from "../components/secret/LinTingConstellation";

import { RisingSunFinale } from "../components/secret/RisingSunFinale";

import { SecretFloatingLayer } from "../components/secret/SecretFloatingLayer";

import { SecretFxCanvas, type SecretFxHandle } from "../components/secret/SecretFxCanvas";

import { SecretHeroParallax, SecretNameHold } from "../components/secret/SecretHeroParallax";

import { SecretStarsBackground } from "../components/secret/SecretStarsBackground";

import { SecretStoryDeck } from "../components/secret/SecretStoryDeck";

import { SecretTimeMachine } from "../components/secret/SecretTimeMachine";

import { SoulColorsPanel } from "../components/secret/SoulColorsPanel";

import { StoryInterludeScene } from "../components/secret/StoryInterludeScene";

import { StickyNotesScene } from "../components/secret/StickyNotesScene";

import { TeaMomentScene } from "../components/secret/TeaMomentScene";

import { isSecretUnlocked } from "../data/secretGate";

import type { TimeMachineStep, UnlockStage } from "../data/secretRomance";

import { secretRomance, stageTimeLabels } from "../data/secretRomance";

import "../styles/secretRomance.css";



type PopStar = { id: number; x: number; y: number; kind: string };



const STAGE_ORDER: UnlockStage[] = [

  "tea",

  "chat",

  "interlude",

  "chatNight",

  "gift",

  "notes",

  "colors",

  "story",

  "sun",

];



function stageIndex(s: UnlockStage) {

  return STAGE_ORDER.indexOf(s);

}



/** 独立全屏浪漫页 — 林婷 · 特效加强版 */

export function SecretRomancePage() {

  const fxRef = useRef<SecretFxHandle>(null);

  const [ready, setReady] = useState(false);

  const [unlocked, setUnlocked] = useState(false);

  const [stage, setStage] = useState<UnlockStage>("tea");

  const [maxIdx, setMaxIdx] = useState(0);

  const [titleGlow, setTitleGlow] = useState(false);

  const [popStars, setPopStars] = useState<PopStar[]>([]);

  const [nameReveal, setNameReveal] = useState(false);



  const [timeLog, setTimeLog] = useState<TimeMachineStep[]>([]);

  const [activeTimeId, setActiveTimeId] = useState<string | null>(null);

  const [timeCollapsed, setTimeCollapsed] = useState(false);

  const [interludeJump, setInterludeJump] = useState<number | null>(null);

  const [interludePaused, setInterludePaused] = useState(false);

  const [interludeToken, setInterludeToken] = useState(0);

  const [codeJumpIndex, setCodeJumpIndex] = useState<number | undefined>(undefined);

  const [codeJumpToken, setCodeJumpToken] = useState(0);



  const recordStep = useCallback((entry: Omit<TimeMachineStep, "at">) => {

    setTimeLog((prev) => {

      if (prev.some((s) => s.id === entry.id)) return prev;

      return [...prev, { ...entry, at: Date.now() }];

    });

    setActiveTimeId(entry.id);

  }, []);



  useEffect(() => {

    setUnlocked(isSecretUnlocked());

    setReady(true);

    const t = window.setTimeout(() => setNameReveal(true), 800);

    return () => clearTimeout(t);

  }, []);



  useEffect(() => {

    if (!ready) return;

    recordStep({

      id: "stage-hero",

      stage: "tea",

      label: secretRomance.title,

      detail: `给 ${secretRomance.herName}`,

      icon: "✦",

    });

  }, [ready, recordStep]);



  useEffect(() => {

    if (stage !== "tea") {

      const t = window.setTimeout(() => setTitleGlow(true), 300);

      return () => clearTimeout(t);

    }

  }, [stage]);



  if (!ready) return null;

  if (!unlocked) return <Navigate to="/" replace />;



  function burst(x: number, y: number, big = false) {

    fxRef.current?.ripple(x, y);

    fxRef.current?.confetti(x, y, big ? 64 : 28);

  }



  function hearts(x: number, y: number) {

    fxRef.current?.hearts(x, y);

    fxRef.current?.confetti(x, y, 20);

  }



  function scrollToStep(id: string, fallbackStage: UnlockStage) {

    window.setTimeout(() => {

      const el =

        document.querySelector(`[data-time-step="${id}"]`) ??

        document.querySelector(`[data-stage="${fallbackStage}"]`);

      el?.scrollIntoView({ behavior: "smooth", block: "start" });

    }, 100);

  }



  function jumpToTimeStep(step: TimeMachineStep) {

    setActiveTimeId(step.id);

    setStage(step.stage);

    setMaxIdx((m) => Math.max(m, stageIndex(step.stage)));



    if (step.id.startsWith("interlude-")) {

      const idx = Number.parseInt(step.id.replace("interlude-", ""), 10);

      setInterludeJump(idx);

      setInterludePaused(true);

      setInterludeToken((t) => t + 1);

      setCodeJumpIndex(undefined);

      setCodeJumpToken((t) => t + 1);

    } else if (step.id.startsWith("code-")) {

      const codeId = step.id.replace("code-", "");

      const idx = secretRomance.codeStorySteps.findIndex((s) => s.id === codeId);

      if (idx >= 0) {
        setCodeJumpIndex(idx);
        setCodeJumpToken((t) => t + 1);
      }

      setInterludeJump(null);

      setInterludePaused(false);

    } else {

      setInterludeJump(null);

      setInterludePaused(false);

      setCodeJumpIndex(undefined);

      setCodeJumpToken((t) => t + 1);

    }



    scrollToStep(step.id, step.stage);

  }



  function advance(to: UnlockStage) {

    const meta = stageTimeLabels[to];

    recordStep({

      id: `stage-${to}`,

      stage: to,

      label: meta.label,

      detail: meta.detail,

      icon: meta.icon,

    });

    const idx = stageIndex(to);

    setStage(to);

    setMaxIdx((m) => Math.max(m, idx));

    setInterludeJump(null);

    setInterludePaused(false);

    setCodeJumpIndex(undefined);

    setCodeJumpToken((t) => t + 1);

    burst(window.innerWidth / 2, window.innerHeight * 0.4, true);

    scrollToStep(`stage-${to}`, to);

  }



  function onCanvasClick(e: React.MouseEvent) {

    if (

      (e.target as HTMLElement).closest(

        ".secret-tea-scene, .secret-chat, .secret-interlude, .secret-gift, .secret-notes, .secret-color-orb, .secret-color-merge, .secret-sun-body, .secret-constellation-stars button, .secret-time-machine, a, button",

      )

    ) {

      return;

    }

    fxRef.current?.ripple(e.clientX, e.clientY);

    const kinds = ["✦", "♥", "✧", "☘"];

    const star: PopStar = {

      id: Date.now(),

      x: e.clientX,

      y: e.clientY,

      kind: kinds[Math.floor(Math.random() * kinds.length)],

    };

    setPopStars((s) => [...s.slice(-20), star]);

    window.setTimeout(() => {

      setPopStars((s) => s.filter((p) => p.id !== star.id));

    }, 900);

  }



  return (

    <div className={`secret-world has-time-machine${timeCollapsed ? " tm-collapsed" : ""}`} onClick={onCanvasClick}>

      <SecretStarsBackground />

      <SecretFloatingLayer />

      <SecretFxCanvas ref={fxRef} />



      <SecretTimeMachine

        steps={timeLog}

        activeId={activeTimeId}

        onJump={jumpToTimeStep}

        collapsed={timeCollapsed}

        onToggle={() => setTimeCollapsed((c) => !c)}

      />



      <div className="secret-pop-stars" aria-hidden="true">

        {popStars.map((s) => (

          <span key={s.id} className="secret-pop-star" style={{ left: s.x, top: s.y }}>

            {s.kind}

          </span>

        ))}

      </div>



      <Link to="/" className="secret-exit" title="返回">

        ←

      </Link>



      <div className="secret-progress" aria-hidden="true">

        {STAGE_ORDER.map((s, i) => (

          <span key={s} className={i <= maxIdx ? "on" : ""} />

        ))}

      </div>



      <main className="secret-main">

        <div data-time-step="stage-hero">
        <SecretHeroParallax className={titleGlow ? "glow" : ""}>

          <p className="secret-hero-eyebrow">✦ for {secretRomance.herName} ✦</p>

          <h1>{secretRomance.title}</h1>

          <SecretNameHold

            name={secretRomance.herName}

            revealed={nameReveal}

            onHeartBurst={hearts}

          />

          <p className="secret-hero-sub">{secretRomance.subtitle}</p>

          <p className="secret-hero-dedication">{secretRomance.dedication}</p>

          <LinTingConstellation onHeartBurst={hearts} />

          <div className="secret-hero-aurora" aria-hidden="true" />

        </SecretHeroParallax>
        </div>


        <div data-stage="tea" data-time-step="stage-tea" className={maxIdx > 0 ? "secret-block done" : "secret-block"}>

          {stage === "tea" ? (

            <TeaMomentScene

              onNight={() => {

                const m = stageTimeLabels.tea;

                recordStep({

                  id: "stage-tea",

                  stage: "tea",

                  label: m.label,

                  detail: m.detail,

                  icon: m.icon,

                });

                advance("chat");

              }}

              onBurst={(x, y) => burst(x, y)}

            />

          ) : (

            <div className="secret-block-summary">

              <span>🍵</span>

              <p>林婷看见我发呆，说要沏茶——那天的开始。</p>

            </div>

          )}

        </div>



        {maxIdx >= stageIndex("chat") && (

          <div data-stage="chat" data-time-step="stage-chat" className={maxIdx > stageIndex("chat") ? "secret-block done" : "secret-block"}>

            {stage === "chat" ? (

              <ChatStreamScene

                title="课前 · 和林婷"

                lead="点击，让对话继续——"

                lines={secretRomance.chatMorning}

                onComplete={() => advance("interlude")}

                onBurst={(x, y) => burst(x, y)}

              />

            ) : (

              <div className="secret-block-summary">

                <span>💬</span>

                <p>林婷说「没事，先去上课吧」——对话停在了这里。</p>

              </div>

            )}

          </div>

        )}



        {maxIdx >= stageIndex("interlude") && (

          <div data-stage="interlude" data-time-step="stage-interlude" className={maxIdx > stageIndex("interlude") ? "secret-block done" : "secret-block"}>

            {stage === "interlude" ? (

              <StoryInterludeScene

                key={`interlude-${interludeToken}`}

                initialIndex={interludeJump ?? 0}

                paused={interludePaused && interludeJump !== null}

                onStepReached={(_idx, id, label) =>

                  recordStep({ id, stage: "interlude", label, detail: label, icon: "🌙" })

                }

                onResume={() => {

                  setInterludePaused(false);

                  setInterludeJump(null);

                }}

                onComplete={() => advance("chatNight")}

                onBurst={(x, y) => burst(x, y)}

                onHearts={hearts}

              />

            ) : (

              <div className="secret-block-summary">

                <span>🌙</span>

                <p>中午独自喝茶，以为见不到了——晚上在暗处，先感觉林婷的气息。</p>

              </div>

            )}

          </div>

        )}



        {maxIdx >= stageIndex("chatNight") && (

          <div data-stage="chatNight" data-time-step="stage-chatNight" className={maxIdx > stageIndex("chatNight") ? "secret-block done" : "secret-block"}>

            {stage === "chatNight" ? (

              <ChatStreamScene

                title="晚上 · 一边喝茶"

                lead="茶还在，林婷也在。点击继续——"

                lines={secretRomance.chatEvening}

                onComplete={() => advance("gift")}

                onBurst={(x, y) => burst(x, y)}

              />

            ) : (

              <div className="secret-block-summary">

                <span>🍵</span>

                <p>晚上和林婷聊了很多，然后交换了礼物。</p>

              </div>

            )}

          </div>

        )}



        {maxIdx >= stageIndex("gift") && (

          <div data-stage="gift" data-time-step="stage-gift" className={maxIdx > stageIndex("gift") ? "secret-block done" : "secret-block"}>

            {stage === "gift" ? (

              <GiftExchangeScene

                onComplete={() => advance("notes")}

                onBurst={(x, y) => burst(x, y, true)}

              />

            ) : (

              <div className="secret-block-summary">

                <span>📿</span>

                <p>绿檀手链换回了金刚经，和林婷的两张纸条。</p>

              </div>

            )}

          </div>

        )}



        {maxIdx >= stageIndex("notes") && (

          <div data-stage="notes" data-time-step="stage-notes" className={maxIdx > stageIndex("notes") ? "secret-block done" : "secret-block"}>

            {stage === "notes" ? (

              <StickyNotesScene

                onComplete={() => advance("colors")}

                onBurst={(x, y) => burst(x, y)}

              />

            ) : (

              <div className="secret-block-summary">

                <span>📝</span>

                <p>黄纸 2-1，粉纸 2-2 —— 关于旭，关于太阳。</p>

              </div>

            )}

          </div>

        )}



        {maxIdx >= stageIndex("colors") && (

          <div data-stage="colors" data-time-step="stage-colors" className="secret-block">

            <SoulColorsPanel onBurst={(x, y) => burst(x, y, true)} />

            {stage === "colors" && (

              <button type="button" className="secret-section-next" onClick={() => advance("story")}>

                继续读故事 ✦

              </button>

            )}

          </div>

        )}



        {maxIdx >= stageIndex("story") && (

          <div data-stage="story" data-time-step="stage-story" className="secret-block">

            <SecretStoryDeck
              onBurst={burst}
              onHearts={hearts}
              codeJumpIndex={codeJumpIndex}
              codeJumpToken={codeJumpToken}
              onCodeStepSelect={(_idx, id, label) =>
                recordStep({ id, stage: "story", label, detail: "romance.ts", icon: "⌨" })
              }
            />

            {stage === "story" && (

              <button type="button" className="secret-section-next" onClick={() => advance("sun")}>

                最后 — 升起旭阳 ✦

              </button>

            )}

          </div>

        )}



        {maxIdx >= stageIndex("sun") && (

          <div data-stage="sun" data-time-step="stage-sun" className="secret-block">

            <RisingSunFinale onBurst={(x, y) => burst(x, y, true)} />

            <footer className="secret-foot">

              <p>{secretRomance.footnote}</p>

            </footer>

          </div>

        )}

      </main>

    </div>

  );

}


