import { useEffect, useRef, useState } from "react";
import { RomanceCodeStory } from "./RomanceCodeStory";
import { TimelineMemoryCard } from "./TimelineMemoryCard";
import { secretRomance } from "../../data/secretRomance";

/** 故事讲述 — romance.ts 逐行执行 + 时间线 */
export function SecretStoryDeck({
  onBurst,
  onHearts,
  codeJumpIndex,
  codeJumpToken,
  onCodeStepSelect,
}: {
  onBurst?: (x: number, y: number) => void;
  onHearts?: (x: number, y: number) => void;
  codeJumpIndex?: number;
  codeJumpToken?: number;
  onCodeStepSelect?: (index: number, id: string, label: string) => void;
}) {
  const [codeDone, setCodeDone] = useState(false);
  const [visibleCards, setVisibleCards] = useState<Set<string>>(new Set());
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const id = e.target.getAttribute("data-id");
            if (id) setVisibleCards((prev) => new Set(prev).add(id));
          }
        }
      },
      { threshold: 0.2 },
    );
    for (const el of cardRefs.current.values()) obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <RomanceCodeStory
        onBurst={onBurst}
        onHearts={onHearts}
        onComplete={() => setCodeDone(true)}
        selectedStepIndex={codeJumpIndex}
        jumpToken={codeJumpToken}
        onStepSelect={onCodeStepSelect}
      />

      <section className={`secret-timeline secret-timeline-after-code${codeDone ? " ready" : ""}`}>
        <h2>故事时间线</h2>
        <p className="secret-timeline-lead">
          {codeDone ? "每一幕的心里话" : "动画播放中也可以先往下看——"}
        </p>
        <div className="secret-timeline-track">
          {secretRomance.timeline.map((item, i) => (
            <div
              key={item.id}
              data-id={item.id}
              data-time-step={`timeline-${item.id}`}
              ref={(el) => {
                if (el) cardRefs.current.set(item.id, el);
              }}
            >
              <TimelineMemoryCard
                item={item}
                index={i}
                visible={visibleCards.has(item.id)}
                onBurst={onHearts}
              />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
