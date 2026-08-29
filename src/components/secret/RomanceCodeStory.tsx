import { useEffect, useRef, useState } from "react";
import { secretRomance } from "../../data/secretRomance";

type Scene = (typeof secretRomance.codeStorySteps)[number]["scene"];

function StoryScenePanel({ scene, title }: { scene: Scene; title: string }) {
  return (
    <div className={`secret-story-panel scene-${scene}`}>
      {scene === "intro" && (
        <div className="secret-story-intro">
          <span className="secret-story-name">{secretRomance.herName}</span>
          <div className="secret-story-colors">
            <span className="cyan">青</span>
            <span className="silver">银</span>
          </div>
        </div>
      )}

      {scene === "chat-am" && (
        <div className="secret-story-chat-am">
          <div className="secret-story-bubble her pop">要不要给你沏壶茶？</div>
          <div className="secret-story-bubble me pop delay">要上课了……</div>
          <div className="secret-story-bubble her pop delay2">没事，先去上课吧。</div>
          <div className="secret-story-tea-icon">🍵</div>
        </div>
      )}

      {scene === "noon" && (
        <div className="secret-story-noon">
          <div className="secret-story-cup alone">
            <div className="secret-cup"><div className="secret-cup-liquid" /></div>
            <div className="secret-steam"><span /><span /><span /></div>
          </div>
          <p className="secret-story-alone">独自</p>
        </div>
      )}

      {scene === "scent" && (
        <div className="secret-story-scent">
          <div className="secret-story-dark-room">
            <span className="secret-scent-orb cyan" />
            <span className="secret-scent-orb silver" />
            <span className="secret-story-name faint">{secretRomance.herName}</span>
          </div>
        </div>
      )}

      {scene === "chat-pm" && (
        <div className="secret-story-chat-pm">
          <div className="secret-story-two-cups">
            <div className="secret-cup-wrap brewing"><div className="secret-cup"><div className="secret-cup-liquid" /></div></div>
            <span className="secret-story-dots">···</span>
            <div className="secret-cup-wrap brewing"><div className="secret-cup"><div className="secret-cup-liquid" /></div></div>
          </div>
        </div>
      )}

      {scene === "bracelet" && (
        <div className="secret-story-bracelet">
          <div className="secret-story-hand from">📿</div>
          <div className="secret-story-arrow">→</div>
          <div className="secret-story-hand to">🤲</div>
        </div>
      )}

      {scene === "gift" && (
        <div className="secret-story-gift">
          <div className="secret-story-book">金刚经</div>
          <div className="secret-story-notes">
            <span className="yellow">2-1</span>
            <span className="pink">2-2</span>
          </div>
        </div>
      )}

      {scene === "return" && (
        <div className="secret-story-return">
          <span className="secret-story-return-kw">return</span>
          <span className="secret-story-return-name">{secretRomance.herName}</span>
          <span className="secret-story-return-sun">旭</span>
        </div>
      )}

      {(scene === "header" || scene === "fn" || scene === "close") && (
        <div className="secret-story-symbol">
          <span>{scene === "close" ? "♥" : "✦"}</span>
        </div>
      )}

      <h3 className="secret-story-panel-title">{title}</h3>
    </div>
  );
}

/** romance.ts — 点每一行，左侧展开对应故事 */
export function RomanceCodeStory({
  onComplete,
  onBurst,
  onHearts,
  selectedStepIndex,
  jumpToken = 0,
  onStepSelect,
}: {
  onComplete?: () => void;
  onBurst?: (x: number, y: number) => void;
  onHearts?: (x: number, y: number) => void;
  selectedStepIndex?: number;
  jumpToken?: number;
  onStepSelect?: (index: number, id: string, label: string) => void;
}) {
  const steps = secretRomance.codeStorySteps;
  const [started, setStarted] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [hasClicked, setHasClicked] = useState(false);
  const wrapRef = useRef<HTMLElement>(null);
  const onCompleteRef = useRef(onComplete);
  const completeCalled = useRef(false);
  onCompleteRef.current = onComplete;

  const current = steps[selectedIdx];

  function playFx(scene: Scene) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.45;
    if (scene === "return" || scene === "gift") onHearts?.(cx, cy);
    else onBurst?.(cx, cy);
  }

  function selectStep(index: number, withFx = true) {
    const clamped = Math.max(0, Math.min(index, steps.length - 1));
    setSelectedIdx(clamped);
    setHasClicked(true);
    const step = steps[clamped];
    if (withFx) playFx(step.scene);
    onStepSelect?.(clamped, `code-${step.id}`, step.title);
  }

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        setStarted(true);
        if (completeCalled.current) return;
        completeCalled.current = true;
        onCompleteRef.current?.();
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (selectedStepIndex === undefined) return;
    const clamped = Math.max(0, Math.min(selectedStepIndex, steps.length - 1));
    setSelectedIdx(clamped);
    setHasClicked(true);
  }, [selectedStepIndex, jumpToken, steps.length]);

  return (
    <section
      ref={wrapRef}
      className={`secret-code-story${started ? " ready" : ""}`}
      data-time-step={current ? `code-${current.id}` : "code-story"}
    >
      <header className="secret-code-story-head">
        <h2>romance.ts</h2>
        <p>{started ? "点每一行代码，看对应的故事" : "滚到这里，故事在等你——"}</p>
      </header>

      <div className="secret-code-story-stage">
        <div className="secret-code-story-visual">
          {started && current && (
            <div key={current.id} className="secret-story-panel-wrap">
              <StoryScenePanel scene={current.scene} title={current.title} />
              <p className="secret-story-caption">{current.caption}</p>
            </div>
          )}
          {!started && (
            <div className="secret-story-executing">
              <span className="secret-story-exec-dot" />
              等待你滚到这里…
            </div>
          )}
        </div>

        <div className="secret-code-story-editor">
          <div className="secret-code-head">
            <span className="secret-code-dot red" />
            <span className="secret-code-dot yellow" />
            <span className="secret-code-dot green" />
            <span>romance.ts</span>
          </div>
          {!hasClicked && (
            <p className="secret-code-click-hint" role="note">
              <span className="secret-code-click-hint-icon" aria-hidden>👆</span>
              点击任意一行代码，左侧展开对应故事
            </p>
          )}
          <pre className="secret-code-story-pre">
            {steps.map((step, i) => (
              <code
                key={step.id}
                role="button"
                tabIndex={0}
                title="点击查看故事"
                className={`secret-code-line clickable${selectedIdx === i ? " active" : ""}${!hasClicked && i === 0 ? " hint-first" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!started) {
                    setStarted(true);
                    if (!completeCalled.current) {
                      completeCalled.current = true;
                      onCompleteRef.current?.();
                    }
                  }
                  selectStep(i);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  if (!started) {
                    setStarted(true);
                    if (!completeCalled.current) {
                      completeCalled.current = true;
                      onCompleteRef.current?.();
                    }
                  }
                  selectStep(i);
                }}
              >
                {step.codeLine}
                {step.comment && (
                  <span className="secret-code-comment"> {"// "}{step.comment}</span>
                )}
              </code>
            ))}
          </pre>
        </div>
      </div>
    </section>
  );
}
