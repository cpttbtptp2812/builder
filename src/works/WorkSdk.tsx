import { useRef, useState } from "react";

import { TechBadgeBar } from "../components/TechBadgeBar";

import { WorkGuide } from "../components/WorkGuide";

import { CompressionLab } from "../components/tech/CompressionLab";

import { TechEventLog } from "../components/tech/TechEventLog";

import { REPLAY_STEPS } from "../data/scenarios";

import { mkTech, type TechEvent } from "../lib/techLog";



const STEPS = [

  ...REPLAY_STEPS,

  { selector: "wait.network", label: "execHTTPRequest" },

  { selector: "log.finish", label: "finishProcess" },

];



const WINDOWS = [

  { id: "main", label: "主窗口", status: "active" as const },

  { id: "popup", label: "Popup #2", status: "idle" as const },

  { id: "iframe", label: "iframe", status: "idle" as const },

];



/** SDK：TaskQueue + PostMessage + CompressionStream */

export function WorkSdk() {

  const [step, setStep] = useState(0);

  const [running, setRunning] = useState(false);

  const [paused, setPaused] = useState(false);

  const [queueKb, setQueueKb] = useState(18.6);

  const [activeWin, setActiveWin] = useState("main");

  const [logs, setLogs] = useState<TechEvent[]>([]);

  const timerRef = useRef<number | null>(null);



  const push = (api: string, detail: string, kind: TechEvent["kind"] = "io") => {

    setLogs((prev) => [...prev, mkTech(api, detail, kind)]);

  };



  function clearTimer() {

    if (timerRef.current) window.clearInterval(timerRef.current);

    timerRef.current = null;

  }



  function tick(from: number) {

    clearTimer();

    let i = from;

    timerRef.current = window.setInterval(() => {

      if (paused) return;

      i += 1;

      const s = STEPS[i];

      if (s) push("TaskQueue.execute", `${s.label} · find("${s.selector}")`, "stage");

      setStep(i);

      setQueueKb(18.6 - i * 1.8);

      if (i === 2) {

        setActiveWin("popup");

        push("postMessage", "{ type: 'queue:lock', winId: 'popup' }", "io");

      }

      if (i === 4) {

        setActiveWin("main");

        push("postMessage", "{ type: 'queue:unlock', winId: 'main' }", "io");

      }

      if (i >= STEPS.length - 1) {

        clearTimer();

        setRunning(false);

        setQueueKb(4.2);

        push("TaskQueue.done", "状态 idle · queue 清空", "ok");

      }

    }, 900);

  }



  function run() {

    setLogs([]);

    setRunning(true);

    setPaused(false);

    setStep(0);

    setQueueKb(18.6);

    setActiveWin("main");

    push("TaskQueue.run", `steps.length=${STEPS.length} · 状态 running`, "stage");

    tick(0);

  }



  function togglePause() {

    if (!running) return;

    if (paused) {

      setPaused(false);

      push("TaskQueue.resume", `从 step #${step} 继续`, "resume");

      tick(step);

    } else {

      setPaused(true);

      clearTimer();

      push("TaskQueue.pause", `冻结 step #${step} · ${STEPS[step]?.label}`, "abort");

    }

  }



  function skip() {

    if (!running) return;

    push("TaskQueue.skip", `跳过 step #${step}`, "io");

    setStep((s) => Math.min(s + 1, STEPS.length - 1));

  }



  const cur = STEPS[step]!;



  return (

    <div className="work-sdk work-tech-lab">

      <WorkGuide slug="sdk" />

      <TechBadgeBar items={["TaskQueue", "PostMessage", "CompressionStream", "Operation"]} />



      <div className="work-demo-bar">

        <button type="button" className="cta" onClick={run} disabled={running && !paused}>

          {running && !paused ? "运行中…" : "▶ TaskQueue.run()"}

        </button>

        <span className="work-demo-bar-hint">pause/skip · 窗口 postMessage 互斥</span>

      </div>



      <div className="tech-lab-grid">

        <CompressionLab />

        <div className="tech-lab">

          <header className="tech-lab-head">

            <div>

              <h3>多窗口 mutex</h3>

              <p>PostMessage 广播 lock/unlock · 同一时刻单窗口 executing</p>

            </div>

          </header>

          <div className="sdk-window-bar">

            {WINDOWS.map((w) => (

              <div key={w.id} className={`sdk-win ${activeWin === w.id ? "on" : ""}`}>

                <strong>{w.label}</strong>

                <span>{activeWin === w.id ? "executing" : "idle"}</span>

              </div>

            ))}

          </div>

          <div className="sdk-queue-bar">

            <div><span>队列体积</span><strong>{queueKb.toFixed(1)} KB</strong></div>

            <div><span>当前步骤</span><strong>{cur.label}</strong></div>

            <div className="sdk-controls">

              <button type="button" onClick={togglePause} disabled={!running}>{paused ? "resume()" : "pause()"}</button>

              <button type="button" onClick={skip} disabled={!running}>skip()</button>

            </div>

          </div>

        </div>

      </div>



      <div className="tech-lab-with-log">

        <pre className="sdk-console-pre">{`[ReplaySDK] window=${activeWin}

step: ${cur.label}

find("${cur.selector}")

queue → ${queueKb.toFixed(1)}KB

state: ${paused ? "PAUSED" : running ? "RUNNING" : "IDLE"}`}</pre>

        <TechEventLog events={logs} empty="点 TaskQueue.run()，看 execute / postMessage 调用链…" />

      </div>

    </div>

  );

}


