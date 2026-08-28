import { useEffect, useState } from "react";

import { TechBadgeBar } from "../components/TechBadgeBar";

import { WorkGuide } from "../components/WorkGuide";

import { TechEventLog } from "../components/tech/TechEventLog";

import { mkTech, type TechEvent } from "../lib/techLog";



type Phase = "idle" | "offer" | "connected" | "recording";



const PHASES: { id: Phase; label: string; api: string }[] = [

  { id: "offer", label: "① createOffer", api: "RTCPeerConnection.createOffer()" },

  { id: "connected", label: "② ICE Connected", api: "setRemoteDescription + ontrack" },

  { id: "recording", label: "③ MediaRecorder", api: "addTrack → REC 双录" },

];



/** 远程银行：WebRTC 状态机 + 技术事件流 */

export function WorkCmb() {

  const [phase, setPhase] = useState<Phase>("idle");

  const [latency, setLatency] = useState(0);

  const [running, setRunning] = useState(false);

  const [logs, setLogs] = useState<TechEvent[]>([]);



  const push = (api: string, detail: string, kind: TechEvent["kind"] = "io") => {

    setLogs((prev) => [...prev, mkTech(api, detail, kind)]);

  };



  useEffect(() => {

    if (phase !== "connected" && phase !== "recording") return;

    const t = window.setInterval(() => setLatency(28 + Math.floor(Math.random() * 25)), 700);

    return () => clearInterval(t);

  }, [phase]);



  function connect() {

    setRunning(true);

    setLogs([]);

    push("RTCPeerConnection", "new RTCPeerConnection({ iceServers })", "stage");

    setPhase("offer");

    push("createOffer", "生成 SDP Offer · 开始 ICE gathering", "stage");

    window.setTimeout(() => {

      setPhase("connected");

      push("setRemoteDescription", "ICE Connected · ontrack 收到远端媒体流", "ok");

    }, 1200);

    window.setTimeout(() => {

      setPhase("recording");

      push("MediaRecorder.start", "双录开始 · 视频 + 操作留痕存证", "ok");

      push("getStats", "RTT 监控 · 弱网触发 restartIce()", "io");

    }, 2400);

  }



  function reset() {

    push("restartIce", "oniceconnectionstatechange → failed → 重连", "abort");

    setPhase("idle");

    setRunning(false);

    setLatency(0);

  }



  const stepIdx = PHASES.findIndex((p) => p.id === phase);



  return (

    <div className="work-cmb work-tech-lab">

      <WorkGuide slug="cmb" />

      <TechBadgeBar items={["RTCPeerConnection", "ICE", "MediaRecorder", "getStats"]} />



      <div className="work-demo-bar">

        <button type="button" className="cta" onClick={connect} disabled={running && phase !== "recording"}>

          {phase === "idle" ? "▶ createOffer()" : "连接中…"}

        </button>

        {phase !== "idle" && (

          <button type="button" className="ghost-btn sm" onClick={reset}>restartIce()</button>

        )}

      </div>



      <div className="tech-lab-with-log">

        <div className="tech-lab">

          <div className="webrtc-flow">

            {PHASES.map((p, i) => (

              <div key={p.id} className={`webrtc-step ${i <= stepIdx ? "on" : ""} ${p.id === phase ? "active" : ""}`}>

                <span>{p.label}</span>

                {i <= stepIdx && <em>{p.api}</em>}

              </div>

            ))}

          </div>



          <div className="video-box cmb-video">

            {phase === "idle" && <p>点 createOffer() 看 WebRTC 状态机</p>}

            {phase === "offer" && <p>ICE gathering…</p>}

            {phase === "connected" && <p>ontrack · 媒体流已连通</p>}

            {phase === "recording" && (

              <>

                <span className="rec">● REC</span>

                <p>MediaRecorder 双录进行中</p>

              </>

            )}

            {(phase === "connected" || phase === "recording") && (

              <div className="rtc-stats">

                <div><strong>{latency}</strong>ms RTT</div>

                <div className="rtc-dot live">ICE connected</div>

              </div>

            )}

          </div>

        </div>

        <TechEventLog events={logs} empty="点 createOffer()，看 WebRTC API 逐步打出…" />

      </div>

    </div>

  );

}


