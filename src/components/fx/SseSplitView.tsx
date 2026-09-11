import { useEffect, useRef, useState } from "react";

import { mkTech, type TechEvent } from "../../lib/techLog";

import { TechEventLog } from "../tech/TechEventLog";



const RAW = [

  'event: message\ndata: {"type":"start","turnId":"t-8f2a"}',

  'data: {"type":"reasoning-delta","text":"解析 send() 参数…"}',

  'data: {"type":"text-delta","text":"正在"}',

  'data: {"type":"text-delta","text":"检索工作流"}',

  'data: {"type":"tool-call","name":"Knowledge","id":"tc-1"}',

  'data: {"type":"tool-result","toolCallId":"tc-1","hits":3}',

  'data: {"type":"workflow-match","score":0.94,"id":"w1"}',

  'event: done\ndata: [DONE]',

];



type Parsed =

  | { kind: "start"; turnId: string }

  | { kind: "reasoning"; text: string }

  | { kind: "text"; text: string }

  | { kind: "tool-call"; name: string }

  | { kind: "tool-result"; hits: number }

  | { kind: "workflow"; score: number }

  | { kind: "done" };



function parseLine(line: string): Parsed | null {

  if (line.startsWith("event:")) return null;

  if (line.includes("[DONE]")) return { kind: "done" };

  try {

    const json = line.replace(/^data:\s*/, "");

    const o = JSON.parse(json) as Record<string, unknown>;

    if (o.type === "start") return { kind: "start", turnId: String(o.turnId) };

    if (o.type === "reasoning-delta") return { kind: "reasoning", text: String(o.text) };

    if (o.type === "text-delta") return { kind: "text", text: String(o.text) };

    if (o.type === "tool-call") return { kind: "tool-call", name: String(o.name) };

    if (o.type === "tool-result") return { kind: "tool-result", hits: Number(o.hits) };

    if (o.type === "workflow-match") return { kind: "workflow", score: Number(o.score) };

  } catch {

    /* ignore */

  }

  return null;

}



/** SSE 协议层：原始流 ↔ UIMessage + 技术事件流 */
export function SseSplitView({ variant = "lab" }: { variant?: "lab" | "product" }) {
  const product = variant === "product";

  const [rawLines, setRawLines] = useState<string[]>([]);

  const [parsed, setParsed] = useState<Parsed[]>([]);

  const [running, setRunning] = useState(false);

  const [paused, setPaused] = useState(false);

  const [resumeMode, setResumeMode] = useState(false);

  const [ttfb, setTtfb] = useState<number | null>(null);

  const [bytes, setBytes] = useState(0);

  const [logs, setLogs] = useState<TechEvent[]>([]);

  const timers = useRef<number[]>([]);

  const idx = useRef(0);

  const startAt = useRef(0);



  const push = (api: string, detail: string, kind: TechEvent["kind"] = "io") => {

    setLogs((prev) => [...prev, mkTech(api, detail, kind)]);

  };



  function clearTimers() {

    timers.current.forEach(clearTimeout);

    timers.current = [];

  }



  function pump(from: number) {

    clearTimers();

    idx.current = from;

    setRunning(true);

    if (from === 0) {

      startAt.current = performance.now();

      setTtfb(null);

      setBytes(0);

    }

    function next() {

      if (idx.current >= RAW.length) {

        setRunning(false);

        push("stream.close", "SSE [DONE] · parse 完成", "stage");

        return;

      }

      const line = RAW[idx.current]!;

      const chunkIdx = idx.current;

      idx.current += 1;

      setRawLines((prev) => {

        if (prev.length === 0) setTtfb(Math.round(performance.now() - startAt.current));

        return [...prev, line];

      });

      setBytes((b) => b + line.length);

      push("http.on('data')", `chunk #${chunkIdx} · ${line.slice(0, 40)}…`, "io");

      const p = parseLine(line);

      if (p) {

        setParsed((prev) => [...prev, p]);

        if (p.kind === "start") push("parseUIMessage", `turnId=${p.turnId}`, "render");

        else if (p.kind !== "text") push("parseUIMessage", `{ type: "${p.kind}" }`, "render");

      }

      if (line.includes("[DONE]")) {

        setRunning(false);

        return;

      }

      const id = window.setTimeout(next, 420);

      timers.current.push(id);

    }

    next();

  }



  function start(resume = false) {

    clearTimers();

    setPaused(false);

    setResumeMode(resume);

    if (resume) {

      push("useAutoResume", "localStorage.pendingTurnId → GET /api/chat/resume", "resume");

      push("node:http.request", "续读 SSE · 非 undici fetch", "resume");

      setRawLines(RAW.slice(0, 4));

      setParsed(RAW.slice(0, 4).flatMap((l) => parseLine(l) ?? []));

      setBytes(RAW.slice(0, 4).join("").length);

      setTtfb(128);

      pump(4);

    } else {

      setLogs([]);

      setRawLines([]);

      setParsed([]);

      push("GraphQL Provider", "POST /graphql · subscription @stream", "stage");

      push("TransformStream", "buffer 按 \\n\\n 切 SSE 帧", "stage");

      pump(0);

    }

  }



  useEffect(() => () => clearTimers(), []);



  const uiText = parsed.filter((p) => p.kind === "text").map((p) => (p as { text: string }).text).join("");



  return (

    <div className={`sse-split${product ? " sse-split--product" : ""}`}>

      {product ? (
        <p className="sse-split-lead">
          {running
            ? "正在模拟一次 AI 流式回复…看左边 Raw 帧、右边解析结果。"
            : rawLines.length > 0
              ? "播放完毕。左边是 Network 里看不清的每一帧，右边是 AI SDK 语义字段。"
              : "点下面按钮，模拟 Network 里一条 SSE 流从开始到结束。"}
        </p>
      ) : null}

      <div className="sse-split-actions">

        <button
          type="button"
          className={product ? "sp-play-btn" : "cta sm"}
          onClick={() => start(false)}
          disabled={running}
        >
          {product ? "▶ 播放模拟流" : "▶ send()"}
        </button>

        {!product ? (
        <button type="button" className="ghost-btn sm" onClick={() => start(true)} disabled={running}>

          ↻ useAutoResume

        </button>
        ) : (
        <button type="button" className="ghost-btn sm" onClick={() => start(true)} disabled={running} title="演示断线续传">
          ↻ 断线续传
        </button>
        )}

        {running && (

          <button

            type="button"

            className="ghost-btn sm"

            onClick={() => {

              if (paused) {

                setPaused(false);

                push("resume pump", `从 chunk #${idx.current} 继续`, "resume");

                pump(idx.current);

              } else {

                setPaused(true);

                clearTimers();

                setRunning(false);

                push("clearTimeout", `暂停于 chunk #${idx.current}`, "abort");

                push("localStorage.setItem", "'pendingTurnId' → 't-8f2a'", "storage");

              }

            }}

          >

            {paused ? "继续" : "暂停"}

          </button>

        )}

        {resumeMode && (
          <span className="sse-resume-banner">
            {product ? "模拟：刷新后续读未完成的流" : "pendingTurnId → GET /api/chat/resume"}
          </span>
        )}

      </div>



      <div className="sse-metrics">

        <div><span>{product ? "首帧耗时" : "TTFB"}</span><strong>{ttfb !== null ? `${ttfb}ms` : "—"}</strong></div>

        <div><span>{product ? "帧数" : "Chunks"}</span><strong>{rawLines.length}</strong></div>

        <div><span>{product ? "体积" : "Bytes"}</span><strong>{bytes}</strong></div>

        {!product ? (
        <div><span>Transport</span><strong>node:http</strong></div>
        ) : null}

      </div>



      <div className={`sse-split-grid${product ? " sse-split-grid--dual" : ""}`}>

        {!product ? (
        <TechEventLog events={logs} empty="点 send() 或 useAutoResume，看协议层 API…" />
        ) : null}



        <div className="sse-pane">

          <header>{product ? "左 · 原始 SSE 帧（Network 里看不清）" : "GraphQL SSE 原始 chunk"}</header>

          <pre>

            {rawLines.map((l, i) => (

              <div key={i} className={l.includes("tool") ? "hl-tool" : l.includes("workflow") ? "hl-wf" : ""}>

                <small>#{i}</small> {l}

              </div>

            ))}

            {running && <span className="caret">▍</span>}

          </pre>

        </div>



        <div className="sse-pane parsed">

          <header>{product ? "右 · AI SDK 解析结果（UI 真正用的）" : "AI SDK UIMessage parse 结果"}</header>

          <div className="sse-ui-parts">

            {parsed.map((p, i) => {

              if (p.kind === "start") return <div key={i} className="ui-part start">turnId: {p.turnId}</div>;

              if (p.kind === "reasoning") return <div key={i} className="ui-part reason">💭 {p.text}</div>;

              if (p.kind === "tool-call") return <div key={i} className="ui-part tool">🔧 tool-call: {p.name}</div>;

              if (p.kind === "tool-result") return <div key={i} className="ui-part tool done">✓ {p.hits} hits</div>;

              if (p.kind === "workflow") return <div key={i} className="ui-part wf">✦ match {Math.round(p.score * 100)}%</div>;

              if (p.kind === "done") return <div key={i} className="ui-part done">stream complete</div>;

              return null;

            })}

            {uiText && (

              <div className="ui-part text">

                <strong>assistant</strong>

                <p>{uiText}{running && <span className="caret">▍</span>}</p>

              </div>

            )}

          </div>

        </div>

      </div>

      {product && logs.length > 0 ? (
        <details className="sse-tech-details">
          <summary>技术细节（hook / parse / 续传日志）</summary>
          <TechEventLog events={logs} empty="" />
        </details>
      ) : null}

    </div>

  );

}


