import { useEffect, useRef, useState } from "react";
import { AGENT_SSE_LINES, createSSEByteStream } from "../../lib/streams";
import { runStreamPipeline, supportsTextDecoderStream, type PipelineStage } from "../../lib/streamPipeline";
import type { UIPart } from "../../lib/streams";

const STAGES: { id: PipelineStage; label: string; hint: string }[] = [
  { id: "source", label: "① 收字节", hint: "后端推来的原始数据" },
  { id: "decode", label: "② 解码", hint: "字节 → 文字" },
  { id: "sse-parse", label: "③ 拆 SSE", hint: "按帧切分" },
  { id: "ui-map", label: "④ 转 UI", hint: "变成聊天部件" },
  { id: "done", label: "⑤ 完成", hint: "流结束" },
];

/** TransformStream 管道 — AI SDK SSE 消费链 */
export function StreamPipelineLab({ trigger = 0 }: { trigger?: number }) {
  const [stage, setStage] = useState<PipelineStage>("source");
  const [parts, setParts] = useState<UIPart[]>([]);
  const [raw, setRaw] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (trigger <= 0) return;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;

    setParts([]);
    setRaw([]);
    setRunning(true);
    setStage("source");

    const bytes = createSSEByteStream(AGENT_SSE_LINES, 400);
    runStreamPipeline(
      bytes,
      (s) => { if (!ac.signal.aborted) setStage(s); },
      (p) => {
        if (ac.signal.aborted) return;
        setParts((prev) => [...prev, p]);
        setRaw((prev) => [...prev, JSON.stringify(p)]);
      },
      () => {},
    ).finally(() => {
      if (!ac.signal.aborted) setRunning(false);
    });

    return () => ac.abort();
  }, [trigger]);

  const text = parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("");
  const stageIdx = STAGES.findIndex((s) => s.id === stage);

  return (
    <div className="tech-lab stream-pipeline-lab">
      <header className="tech-lab-head">
        <div>
          <h3>数据怎么变成聊天界面</h3>
          <p>后端推流 → 五步转换 → 左边是程序读的数据，右边是用户看到的</p>
        </div>
        <span className={`live-pulse indigo ${running ? "" : "off"}`}>
          {running ? "接收中…" : "等待开始"}
        </span>
      </header>

      <div className="pipeline-stages">
        {STAGES.map((s, i) => (
          <div
            key={s.id}
            className={`pipeline-stage ${stage === s.id ? "active" : stageIdx > i ? "done" : ""}`}
            title={s.hint}
          >
            <span className="pipeline-idx">{i + 1}</span>
            <div>
              <strong>{s.label}</strong>
              <code>{s.hint}</code>
            </div>
          </div>
        ))}
      </div>

      <div className="pipeline-compare-labels">
        <span>← 程序用的 JSON</span>
        <span>用户看到的界面 →</span>
      </div>

      <div className="pipeline-output">
        <div className="fx-terminal">
          <div className="fx-terminal-bar">
            <span>解析结果 · {parts.length} 条</span>
            <em>给代码消费</em>
          </div>
          <pre className="fx-terminal-body sm">
            {raw.length === 0 && !running && (
              <span className="pipeline-empty">点上方「开始演示」，这里会出现 JSON…</span>
            )}
            {raw.map((l, i) => <div key={i}>{l}</div>)}
            {running && <span className="caret">▍</span>}
          </pre>
        </div>
        <div className="ui-message-panel">
          <header>
            <span>聊天界面预览</span>
            <em>给人看</em>
          </header>
          <div className="ui-message-parts">
            {parts.length === 0 && !running && (
              <p className="pipeline-empty ui">工具卡、思考过程、正文会出现在这里</p>
            )}
            {parts.map((p, i) => {
              if (p.type === "tool-call") {
                return (
                  <div key={i} className="ui-part tool">
                    <small>工具调用</small>
                    🔧 {p.name}
                  </div>
                );
              }
              if (p.type === "tool-result") {
                return (
                  <div key={i} className="ui-part tool done">
                    <small>工具返回</small>
                    查到 {p.hits} 条结果
                  </div>
                );
              }
              if (p.type === "reasoning") {
                return (
                  <div key={i} className="ui-part reason">
                    <small>思考过程（可折叠）</small>
                    {p.text}
                  </div>
                );
              }
              if (p.type === "done") {
                return <div key={i} className="ui-part done">✓ 回答结束</div>;
              }
              return null;
            })}
            {text && (
              <div className="ui-part text">
                <small>AI 回复</small>
                <strong>assistant</strong> {text}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
