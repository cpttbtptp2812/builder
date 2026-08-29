import { useRef, useState } from "react";
import { secretRomance } from "../../data/secretRomance";

type Step = "idle" | "bracelet" | "flying" | "received" | "done";

/** 绿檀手链 ↔ 金刚经与纸条 */
export function GiftExchangeScene({
  onComplete,
  onBurst,
}: {
  onComplete: () => void;
  onBurst?: (x: number, y: number) => void;
}) {
  const [step, setStep] = useState<Step>("idle");
  const flyingLock = useRef(false);
  const { bracelet, sutra, herName } = secretRomance;

  function advance(e: React.MouseEvent) {
    if (step === "idle") setStep("bracelet");
    else if (step === "bracelet") {
      setStep("flying");
      onBurst?.(e.clientX, e.clientY);
      if (!flyingLock.current) {
        flyingLock.current = true;
        window.setTimeout(() => {
          setStep("received");
          onBurst?.(window.innerWidth * 0.65, 400);
          flyingLock.current = false;
        }, 1000);
      }
    } else if (step === "flying") {
      /* wait auto */
    } else if (step === "received") {
      setStep("done");
      onBurst?.(e.clientX, e.clientY);
      onComplete();
    }
  }

  return (
    <section
      className={`secret-gift${step === "flying" ? " flying" : ""}`}
      onClick={advance}
      role="button"
      tabIndex={0}
    >
      <h2>交换礼物</h2>
      <p className="secret-gift-lead">
        {step === "idle" && "点击——把跟了很久的绿檀手链，递给林婷"}
        {step === "bracelet" && "点击——送出去"}
        {step === "flying" && "手链飞向她…"}
        {step === "received" && "点击——打开林婷的回礼"}
        {step === "done" && "两份心意，交换完成。"}
      </p>

      {step === "flying" && (
        <div className="secret-gift-trail" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
      )}

      <div className="secret-gift-stage">
        <div className={`secret-gift-side me${step !== "idle" ? " active" : ""}`}>
          <div
            className={`secret-bracelet${step === "flying" || step === "received" || step === "done" ? " sent" : ""}${step === "bracelet" ? " lift" : ""}${step === "flying" ? " fly" : ""}`}
          >
            <span className="secret-bracelet-beads" aria-hidden="true" />
            <span className="secret-bracelet-shine" aria-hidden="true" />
            <span className="secret-bracelet-label">{bracelet.title}</span>
          </div>
          {step !== "idle" && step !== "bracelet" && (
            <p className="secret-gift-caption">{bracelet.desc}</p>
          )}
        </div>

        <div className="secret-gift-arrow">⇄</div>

        <div className={`secret-gift-side her${step === "received" || step === "done" ? " active" : ""}`}>
          <div className={`secret-sutra${step === "received" || step === "done" ? " reveal" : ""}`}>
            <div className="secret-sutra-cover">
              <span className="secret-sutra-title">{sutra.title}</span>
              <small>{sutra.publisher}</small>
              <span className="secret-sutra-shine" />
            </div>
            <div className="secret-sutra-notes">
              <i className="note yellow bounce" />
              <i className="note pink bounce" />
            </div>
          </div>
          {(step === "received" || step === "done") && (
            <p className="secret-gift-caption">{herName}回赠：{sutra.desc}</p>
          )}
        </div>
      </div>
    </section>
  );
}
