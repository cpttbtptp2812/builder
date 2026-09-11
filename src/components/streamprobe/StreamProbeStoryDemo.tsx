import { useEffect, useRef, useState } from "react";

type Frame = {
  id: string;
  ms: number;
  /** 人话：这一帧意味着什么 */
  meaning: string;
  /** 开发者在查什么 */
  debugNote: string;
  raw: string;
  chatEffect?: "typing" | "tool" | "match" | "done";
  chatAppend?: string;
};

const FRAMES: Frame[] = [
  {
    id: "f1",
    ms: 142,
    meaning: "连接建立，后端开始推流",
    debugNote: "看首帧耗时 — 用户觉得「慢」often 是这里",
    raw: 'data: {"type":"start","turnId":"t-8f2a"}',
  },
  {
    id: "f2",
    ms: 380,
    meaning: "模型在推理（聊天 UI 往往不显示）",
    debugNote: "Network 里完全看不到；流里却有 reasoning",
    raw: 'data: {"type":"reasoning-delta","text":"解析用户意图…"}',
  },
  {
    id: "f3",
    ms: 520,
    meaning: "开始出字：「正在」",
    debugNote: "text-delta 第 1 片 — UI 逐字来源",
    raw: 'data: {"type":"text-delta","text":"正在"}',
    chatEffect: "typing",
    chatAppend: "正在",
  },
  {
    id: "f4",
    ms: 680,
    meaning: "继续出字：「检索工作流」",
    debugNote: "多片 delta 拼成完整回复",
    raw: 'data: {"type":"text-delta","text":"检索工作流"}',
    chatEffect: "typing",
    chatAppend: "检索工作流",
  },
  {
    id: "f5",
    ms: 910,
    meaning: "模型决定调工具：Knowledge",
    debugNote: "tool-call 字段错 / 缺 id → 对话直接挂",
    raw: 'data: {"type":"tool-call","name":"Knowledge","id":"tc-1"}',
    chatEffect: "tool",
  },
  {
    id: "f6",
    ms: 1240,
    meaning: "工具返回 3 条命中",
    debugNote: "tool-result 要和 call 的 id 对上",
    raw: 'data: {"type":"tool-result","toolCallId":"tc-1","hits":3}',
    chatEffect: "tool",
  },
  {
    id: "f7",
    ms: 1580,
    meaning: "匹配到工作流，置信度 94%",
    debugNote: "业务字段 — 只有拆开帧才能核对",
    raw: 'data: {"type":"workflow-match","score":0.94,"id":"w1"}',
    chatEffect: "match",
  },
  {
    id: "f8",
    ms: 1620,
    meaning: "流结束 [DONE]",
    debugNote: "断流 / 没收到 DONE → 前端一直 loading",
    raw: "event: done\\ndata: [DONE]",
    chatEffect: "done",
  },
];

type Phase = "idle" | "running" | "done";

/** 场景演示：Network 只有 pending，StreamProbe 逐帧展开 */
export function StreamProbeStoryDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [visibleCount, setVisibleCount] = useState(0);
  const [chatText, setChatText] = useState("");
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  function reset() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("idle");
    setVisibleCount(0);
    setChatText("");
    setStatusLine(null);
  }

  function run() {
    reset();
    setPhase("running");
    setStatusLine("用户发送：「帮我匹配工作流」");

    FRAMES.forEach((frame, i) => {
      const id = window.setTimeout(() => {
        setVisibleCount(i + 1);
        if (frame.chatAppend) setChatText((t) => t + frame.chatAppend);
        if (frame.chatEffect === "tool") setStatusLine("助手正在调用 Knowledge…");
        if (frame.chatEffect === "match") setStatusLine("匹配到工作流 weekly-report（94%）");
        if (frame.chatEffect === "done") {
          setPhase("done");
          setStatusLine(null);
        }
      }, frame.ms);
      timers.current.push(id);
    });
  }

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const visible = FRAMES.slice(0, visibleCount);
  const networkPending = phase === "running";

  return (
    <div className="sp-story">
      <div className="sp-story-intro">
        <p>
          <strong>这个演示在证明什么？</strong>
          同一次 AI 回复，Chrome Network 全程只有一行 <code>pending</code>；StreamProbe
          把藏在流里的 <strong>{FRAMES.length} 帧</strong> 拆开，并告诉你每帧在查什么问题。
        </p>
      </div>

      <button type="button" className="sp-play-btn" onClick={run} disabled={phase === "running"}>
        {phase === "idle" ? "▶ 模拟：用户发了一条 AI 消息" : phase === "running" ? "播放中…" : "↻ 再播一次"}
      </button>

      <div className="sp-story-grid">
        {/* 聊天 + Network */}
        <div className="sp-story-col">
          <div className="sp-mini-chat">
            <header>你的 AI 聊天页</header>
            <div className="sp-mini-chat-msg user">帮我匹配工作流</div>
            <div className="sp-mini-chat-msg bot">
              {chatText || (phase === "running" ? "▍" : "（等用户发送…）")}
            </div>
            {statusLine ? <div className="sp-mini-chat-status">{statusLine}</div> : null}
          </div>

          <div className="sp-mini-network">
            <header>Chrome Network（开发者工具）</header>
            {phase === "idle" ? (
              <p className="sp-mini-empty">发送消息后这里会出现一行请求</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={networkPending ? "pending" : "done"}>
                    <td>/api/chat</td>
                    <td>{networkPending ? "pending" : "200"}</td>
                    <td>fetch</td>
                  </tr>
                </tbody>
              </table>
            )}
            {phase !== "idle" && (
              <p className="sp-mini-network-note">
                {networkPending
                  ? "⚠️ 全程转圈，点进去也看不清 body 里一帧一帧的数据"
                  : "✓ 结束了，但仍是一整块响应 — 中途哪帧错了还是不知道"}
              </p>
            )}
          </div>
        </div>

        {/* StreamProbe */}
        <div className="sp-story-col sp-story-probe">
          <header>
            StreamProbe Side Panel
            {visibleCount > 0 ? <span>{visibleCount} 帧</span> : null}
          </header>

          {visible.length === 0 ? (
            <p className="sp-mini-empty">hook 页面里的流式请求后，每一帧会列在这里</p>
          ) : (
            <ul className="sp-frame-list">
              {visible.map((f, i) => (
                <li key={f.id} className="sp-frame-item">
                  <div className="sp-frame-head">
                    <span className="sp-frame-idx">#{i + 1}</span>
                    <span className="sp-frame-ms">+{f.ms}ms</span>
                  </div>
                  <strong>{f.meaning}</strong>
                  <em>{f.debugNote}</em>
                </li>
              ))}
            </ul>
          )}

          {phase === "done" && (
            <div className="sp-story-verdict">
              Network 只有 1 行；StreamProbe 看到 {FRAMES.length} 帧。
              <br />
              真实扩展还能看 Raw JSON、导出会话、查断流。
            </div>
          )}
        </div>
      </div>

      {visibleCount > 0 && (
        <details className="sse-tech-details">
          <summary>展开看原始 SSE 数据（给开发者的）</summary>
          <pre className="sp-raw-dump">
            {visible.map((f) => f.raw).join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}
