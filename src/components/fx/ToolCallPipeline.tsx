import { useEffect, useState } from "react";

export type PipelineStep = { id: string; label: string; detail: string };

const RELEASE_CHECK: PipelineStep[] = [
  { id: "reason", label: "思考链", detail: "解析「发布前检查」→ 匹配 DevOps 流程" },
  { id: "http", label: "HTTP 探针", detail: "GET staging/api/health → 200 OK (42ms)" },
  { id: "vnc", label: "noVNC 截图", detail: "远程浏览器截图 · 确认无报错弹窗" },
  { id: "wx", label: "企业微信通知", detail: "webhook 推送 · 检查通过" },
];

const KNOWLEDGE: PipelineStep[] = [
  { id: "reason", label: "思考链", detail: "意图识别 → knowledge_retrieval" },
  { id: "mcp", label: "MCP 知识库", detail: "tool-call: Knowledge · query=部署规范" },
  { id: "rag", label: "RAG 检索", detail: "Top-3：部署规范 v2.1 / API 限流 / 权限模型" },
  { id: "stream", label: "流式回复", detail: "text-delta 逐 token 推送至对话 UI" },
];

const PIPELINES = { release: RELEASE_CHECK, knowledge: KNOWLEDGE };

/** Agent 核心：Tool Call 流水线 */
export function ToolCallPipeline({
  variant = "release",
  trigger,
  onVnc,
}: {
  variant?: "release" | "knowledge";
  trigger: number;
  onVnc?: () => void;
}) {
  const steps = PIPELINES[variant];
  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (trigger <= 0) return;
    setStep(-1);
    setRunning(true);
    let i = 0;
    const t = window.setInterval(() => {
      const cur = steps[i];
      if (cur?.id === "vnc") onVnc?.();
      setStep(i);
      i += 1;
      if (i >= steps.length) {
        window.clearInterval(t);
        setRunning(false);
      }
    }, 850);
    return () => clearInterval(t);
  }, [trigger, onVnc, steps]);

  if (trigger <= 0) {
    return (
      <div className="tool-pipeline idle">
        <p>开始对话后，工具会在这里逐步执行</p>
      </div>
    );
  }

  return (
    <div className="tool-pipeline">
      {steps.map((s, i) => (
        <div
          key={s.id}
          className={`tool-step ${i <= step ? "on" : ""} ${i === step && running ? "active" : ""}`}
        >
          <div className="tool-step-head">
            <span className="tool-step-idx">{i + 1}</span>
            <strong>{s.label}</strong>
            {i < step && <em>done</em>}
            {i === step && running && <em className="live">running</em>}
          </div>
          {i <= step && <p>{s.detail}</p>}
        </div>
      ))}
    </div>
  );
}
