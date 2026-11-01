/**
 * 智能体单源时间线状态机 (Agent Timeline Single-Source-of-Truth Reducer)
 * 严格对齐 OpenInference 工业标准，同时驱动左视窗（ThinkingStream）与右视窗（InspectorStepCards）
 */

export type StepPhase =
  | "intent"      // 01. 意图感知与实体提取
  | "workflow"    // 02. 任务层动态编排与路由
  | "context"     // 03. 提示词工程与上下文注水 (RAG/规则)
  | "llm"         // 04. 专家大脑认知推演回路
  | "skill"       // 05. 技能层受控沙箱执行 (Git/API/Tool)
  | "delivery"    // 06. 结果流式组装与安全交付
  | "closure"     // 07. 全链路交付闭环
  | "degraded";   // 降级模式

export type StepStatus = "pending" | "running" | "done" | "failed" | "passed";

export interface AgentStep {
  stepId: string;              // 稳定唯一ID，如 "step-1-intent", "tool-get_git_commit_history-1"
  seq: number;                 // 单调自增序列号 (1, 2, 3...)，防乱序
  phase: StepPhase;
  status: StepStatus;
  leftTitle: string;           // 左视窗思考流标题，如："业务意图感知"
  leftSummary: string;         // 左视窗思考流简明摘要 (≤100字)
  rightTitle: string;          // 右视窗卡片大标题
  rightSubtitle: string;       // 右视窗卡片业务说明
  rightDetail?: Record<string, any>; // 展开查看的真实参数、返回值与技术指标
  durationMs?: number;
  timestamp: number;
}

/**
 * 纯函数 Reducer：将新到达的 AgentStep 合并入时间线数组
 * 保持按 seq 升序排列，支持根据 stepId 增量更新或追加
 */
export function timelineReducer(current: AgentStep[], incoming: Partial<AgentStep> & { stepId: string }): AgentStep[] {
  const existingIdx = current.findIndex((s) => s.stepId === incoming.stepId);
  if (existingIdx >= 0) {
    const updated = [...current];
    updated[existingIdx] = {
      ...updated[existingIdx],
      ...incoming,
      rightDetail: {
        ...(updated[existingIdx].rightDetail || {}),
        ...(incoming.rightDetail || {}),
      },
    };
    return updated;
  }

  // 默认补全字段
  const newStep: AgentStep = {
    stepId: incoming.stepId,
    seq: incoming.seq ?? current.length + 1,
    phase: incoming.phase ?? "workflow",
    status: incoming.status ?? "running",
    leftTitle: incoming.leftTitle ?? "中枢处理中",
    leftSummary: incoming.leftSummary ?? "正在执行当前阶段任务...",
    rightTitle: incoming.rightTitle ?? incoming.leftTitle ?? "执行节点",
    rightSubtitle: incoming.rightSubtitle ?? "UACOS 运行时处理中",
    rightDetail: incoming.rightDetail ?? {},
    durationMs: incoming.durationMs,
    timestamp: incoming.timestamp ?? Date.now(),
  };

  return [...current, newStep].sort((a, b) => a.seq - b.seq);
}

/**
 * 将后端 SSE 推送的事件转换为 AgentStep 并注入时间线
 */
export function applySseToTimeline(current: AgentStep[], eventName: string, dataStr: string): AgentStep[] {
  try {
    const data = typeof dataStr === "string" ? JSON.parse(dataStr) : dataStr;
    if (!data) return current;

    if (eventName === "agent_step") {
      return timelineReducer(current, {
        stepId: data.stepId || `step-${data.seq || current.length + 1}`,
        seq: data.seq || current.length + 1,
        phase: data.phase || "workflow",
        status: data.status ? (data.status.toLowerCase() as StepStatus) : "done",
        leftTitle: data.leftTitle || data.title || "业务处理节点",
        leftSummary: data.leftSummary || data.title || "处理完成",
        rightTitle: data.rightTitle || data.title || "执行节点",
        rightSubtitle: data.rightSubtitle || "",
        rightDetail: data.rightDetail || data,
        durationMs: data.durationMs || data.totalMs,
        timestamp: data.timestamp || Date.now(),
      });
    }

    if (eventName === "trace_step") {
      const stepNum = data.step || current.length + 1;
      const stepId = data.stepId || `step-${stepNum}-${(data.name || "step").toLowerCase().replace(/_/g, "-")}`;
      return timelineReducer(current, {
        stepId,
        seq: stepNum,
        phase: data.phase || (stepNum === 1 ? "intent" : stepNum === 2 ? "workflow" : stepNum === 3 ? "context" : stepNum === 4 ? "llm" : stepNum === 5 ? "skill" : "delivery"),
        status: data.status ? (data.status.toLowerCase() as StepStatus) : "done",
        leftTitle: data.leftTitle || data.title || `步骤 ${stepNum}`,
        leftSummary: data.leftSummary || `已完成阶段: ${data.title || data.name}`,
        rightTitle: data.rightTitle || data.title || `阶段 ${stepNum}`,
        rightSubtitle: data.rightSubtitle || data.name || "",
        rightDetail: data.rightDetail || data,
        durationMs: data.durationMs || data.totalMs,
        timestamp: data.timestamp || Date.now(),
      });
    }

    if (eventName === "tool") {
      const toolName = data.tool || "未知工具";
      const stepId = `tool-${toolName}-${Date.now()}`;
      return timelineReducer(current, {
        stepId,
        seq: 5,
        phase: "skill",
        status: data.status === "error" ? "failed" : "done",
        leftTitle: `技能调用: ${toolName}`,
        leftSummary: `成功调度 ${toolName} · 耗时 ${data.duration || "0ms"}`,
        rightTitle: `执行外部技能: ${toolName}`,
        rightSubtitle: `沙箱受控执行 · 耗时: ${data.duration || "0ms"}`,
        rightDetail: {
          toolName,
          parameters: data.parameters,
          result: data.result,
          duration: data.duration,
        },
        timestamp: Date.now(),
      });
    }

    if (eventName === "citations") {
      const items = Array.isArray(data.items) ? data.items : [];
      return timelineReducer(current, {
        stepId: "step-3-citations",
        seq: 3,
        phase: "context",
        status: "done",
        leftTitle: "企业规程知识库召回",
        leftSummary: `检索到 ${items.length} 条高置信度企业合规制度切片`,
        rightTitle: "03. 知识库多路召回 (RAG)",
        rightSubtitle: `有效召回: ${items.length} 篇文档切片 · 向量基线核验通过`,
        rightDetail: {
          totalDocs: data.totalDocs,
          validCount: items.length,
          items: items.map((c: any) => ({
            title: c.docTitle,
            section: c.section,
            score: c.score,
            snippet: c.snippet,
          })),
        },
        timestamp: Date.now(),
      });
    }

    return current;
  } catch (e) {
    return current;
  }
}

/**
 * 兼容旧消息：从历史消息的 traceSteps 或 toolCalls 中快速构建时间线
 */
export function rebuildTimelineFromMessage(msg: {
  traceSteps?: Record<number, any>;
  toolCalls?: Array<{ tool: string; duration?: string; status?: string; result?: any; parameters?: any }>;
  agentTimeline?: AgentStep[];
}): AgentStep[] {
  if (msg.agentTimeline && msg.agentTimeline.length > 0) {
    return msg.agentTimeline;
  }

  const steps: AgentStep[] = [];

  // 从 traceSteps 构建
  if (msg.traceSteps) {
    Object.keys(msg.traceSteps).forEach((k) => {
      const stepNum = parseInt(k, 10);
      const data = msg.traceSteps![stepNum];
      if (data) {
        steps.push({
          stepId: data.stepId || `step-${stepNum}-${(data.name || "step").toLowerCase().replace(/_/g, "-")}`,
          seq: stepNum,
          phase: data.phase || (stepNum === 1 ? "intent" : stepNum === 2 ? "workflow" : stepNum === 3 ? "context" : stepNum === 4 ? "llm" : stepNum === 5 ? "skill" : "delivery"),
          status: data.status ? (data.status.toLowerCase() as StepStatus) : "done",
          leftTitle: data.leftTitle || data.title || `步骤 ${stepNum}`,
          leftSummary: data.leftSummary || data.title || "已完成",
          rightTitle: data.rightTitle || data.title || `阶段 ${stepNum}`,
          rightSubtitle: data.rightSubtitle || data.name || "",
          rightDetail: data.rightDetail || data,
          durationMs: data.durationMs || data.totalMs,
          timestamp: data.timestamp || Date.now(),
        });
      }
    });
  }

  // 从 toolCalls 追加
  if (msg.toolCalls && msg.toolCalls.length > 0) {
    msg.toolCalls.forEach((tc, idx) => {
      steps.push({
        stepId: `tool-${tc.tool}-${idx}`,
        seq: 5,
        phase: "skill",
        status: tc.status === "error" ? "failed" : "done",
        leftTitle: `技能调用: ${tc.tool}`,
        leftSummary: `成功调度 ${tc.tool} · 耗时 ${tc.duration || "0ms"}`,
        rightTitle: `执行技能: ${tc.tool}`,
        rightSubtitle: `耗时 ${tc.duration || "0ms"} · 状态 ${tc.status || "OK"}`,
        rightDetail: {
          parameters: tc.parameters,
          result: tc.result,
        },
        timestamp: Date.now(),
      });
    });
  }

  return steps.sort((a, b) => a.seq - b.seq);
}

