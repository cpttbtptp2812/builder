import type { ReactNode } from "react";
import { STEP_REGISTRY, type StepId } from "../../agent/steps/registry";
import type { PipelineStage } from "../../../lib/workingSet";

/** 客户向步骤说明 — 白话，不用内部术语 */
const CUSTOMER_HINT: Partial<Record<StepId, string>> = {
  nlu: "先读懂您输入的问题，提取关键词。",
  intent: "判断您想查知识、调工具还是一般对话。",
  entity: "提取问题里的关键信息（如项目名、网址）。",
  plan: "规划回答需要哪几步。",
  context: "整理当前对话与页面上下文，控制信息量。",
  dsl: "匹配对应的处理流程。",
  manage: "创建本轮任务并排队执行。",
  pattern: "决定步骤是顺序还是并行执行。",
  engine: "按流程逐步执行。",
  mech: "填充参数并做安全检查。",
  ctrl: "监控执行结果，失败时重试。",
  browser: "访问网页或检查站点状态。",
  mcp: "调用外部工具获取数据。",
  kb: "在知识库中检索与问题最相关的段落。",
};

export function FlowDetailSheet({
  open,
  onClose,
  running,
  stages,
  children,
}: {
  open: boolean;
  onClose: () => void;
  running?: boolean;
  stages: PipelineStage[];
  children: ReactNode;
}) {
  if (!open) return null;

  const active = stages.find((s) => s.status === "active");
  const activeDef = active ? STEP_REGISTRY[active.id as StepId] : null;
  const doneCount = stages.filter((s) => s.status === "done").length;
  const customerHint = active ? CUSTOMER_HINT[active.id as StepId] ?? activeDef?.job : undefined;

  return (
    <div className="ua-flow-sheet-back" onClick={onClose} role="presentation">
      <aside
        className="ua-flow-sheet"
        onClick={(e) => e.stopPropagation()}
        aria-label="处理路径详情"
      >
        <header className="ua-flow-sheet-head">
          <div>
            <strong>{running ? "Agent 正在处理" : "本轮处理路径"}</strong>
            <p>
              {running
                ? "下方是当前进行到哪一步，以及完整处理路径。答复生成后会在左侧对话区显示。"
                : "这是 Agent 回答您问题时经过的步骤，便于核对引用来源与处理逻辑。"}
            </p>
          </div>
          <button type="button" className="ua-flow-sheet-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        {(running || activeDef) && (
          <section className="ua-flow-sheet-now">
            {running && activeDef ? (
              <>
                <span className="ua-flow-sheet-now-label">当前步骤</span>
                <h3>{activeDef.label}</h3>
                <p>{customerHint ?? activeDef.explain}</p>
                <span className="ua-flow-sheet-now-meta">
                  已完成 {doneCount} 步 · 共 14 步
                </span>
              </>
            ) : (
              <>
                <span className="ua-flow-sheet-now-label">状态</span>
                <h3>处理已完成</h3>
                <p>共完成 {doneCount} 步。可在左侧查看带引用的答复内容。</p>
              </>
            )}
          </section>
        )}

        <div className="ua-flow-sheet-body">{children}</div>
      </aside>
    </div>
  );
}
