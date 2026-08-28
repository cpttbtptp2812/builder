import { useEffect, useRef, useState } from "react";
import { burstConfetti } from "../../engine";
import { REPLAY_STEPS } from "../../data/scenarios";
import { useStore } from "../../store";
import { ExecModeBar, ProcessStrip, type ExecMode } from "./ExecModeBar";
import { RealDomReplay } from "./RealDomReplay";
import { VncFloat } from "./VncFloat";
import { WorkflowFlowPreview } from "./WorkflowFlowPreview";
import { WorkflowMatcher } from "./WorkflowMatcher";

const FEATURES = ["对话匹配工作流", "ReplaySDK DOM 回放", "本地 / 云端 / 远程", "React Flow 可视化"];

/** iMean AI 成品展示 — 匹配 → 选流程 → 浏览器回放 */
export function ImeanProductDemo({ autoStart = false }: { autoStart?: boolean }) {
  const [mode, setMode] = useState<ExecMode>("local");
  const [picked, setPicked] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [showVnc, setShowVnc] = useState(false);
  const [userLine, setUserLine] = useState<string | null>(null);
  const [pulseRun, setPulseRun] = useState(false);
  const started = useRef(false);
  const timerRef = useRef<number | null>(null);

  const replayActive = useStore((s) => s.replayActive);

  function clearTimer() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function startReplay(title: string) {
    if (running) return;
    setPicked(title);
    setRunning(true);
    setPulseRun(false);
    setShowVnc(mode === "remote");
    useStore.getState().setReplayActive(true);

    let step = 0;
    timerRef.current = window.setInterval(() => {
      useStore.getState().setReplayStep(Math.min(step, REPLAY_STEPS.length - 1));
      step += 1;
      if (step >= REPLAY_STEPS.length) {
        clearTimer();
        window.setTimeout(() => {
          useStore.getState().setReplayActive(false);
          setRunning(false);
          burstConfetti();
        }, 600);
      }
    }, 1400);
  }

  function onPick(title: string) {
    setUserLine(`帮我执行：${title}`);
    setPicked(title);
    setPulseRun(true);
    window.setTimeout(() => startReplay(title), 500);
  }

  useEffect(() => {
    return () => {
      clearTimer();
      useStore.getState().setReplayActive(false);
    };
  }, []);

  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    const t = window.setTimeout(() => {
      setUserLine("帮我把电商 SKU 批量改价上架");
      setPicked("批量改价上架");
      window.setTimeout(() => startReplay("批量改价上架"), 1200);
    }, 600);
    return () => clearTimeout(t);
  }, [autoStart]);

  return (
    <div className="imean-product-demo work-agent-rich">
      <div className="agent-feature-pills">
        {FEATURES.map((f) => (
          <span key={f} className="agent-feature-pill teal">{f}</span>
        ))}
      </div>

      <ExecModeBar mode={mode} onChange={setMode} />

      <div className="work-demo-bar">
        <button
          type="button"
          className={`cta ${pulseRun && !running ? "pulse-cta" : ""}`}
          disabled={!picked || running}
          onClick={() => picked && startReplay(picked)}
        >
          {running ? "ReplaySDK 逐步执行中…" : picked ? `▶ 再跑一遍「${picked}」` : "请先点下方工作流"}
        </button>
        {running && <span className="sse-live-chip teal">ReplaySDK · {mode === "remote" ? "远程 VNC" : mode === "cloud" ? "云端队列" : "本地 Tab"}</span>}
      </div>

      <div className="imean-product-grid">
        <div className="imean-chat-panel">
          <header className="agent-chat-head">
            <strong>iMean 助手</strong>
            <span>自然语言 → 匹配工作流</span>
          </header>
          <div className="agent-chat-thread imean-thread">
            {userLine && (
              <div className="chat-msg user">
                <small>你</small>
                <p>{userLine}</p>
              </div>
            )}
            {picked && !running && (
              <div className="chat-msg assistant">
                <small>助手</small>
                <p>已匹配「{picked}」。选择执行模式后点「运行」，右侧将开始 DOM 回放并逐步高亮流程图节点。</p>
              </div>
            )}
            {running && (
              <div className="chat-msg assistant">
                <small>助手</small>
                <p>正在执行自动化步骤… 请看右侧浏览器窗口与流程图同步高亮。</p>
              </div>
            )}
          </div>
          <WorkflowMatcher productMode onPick={onPick} />
        </div>

        <div className="imean-runtime-panel">
          <ProcessStrip />
          <WorkflowFlowPreview />
          <RealDomReplay productMode />
        </div>
      </div>

      {showVnc && replayActive && <VncFloat />}
    </div>
  );
}
