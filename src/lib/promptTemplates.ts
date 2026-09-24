/** Prompt 模板 — 对齐岗位 Prompt 工程 / RAG / Agent 场景 */

export type PromptTemplate = {
  id: string;
  name: string;
  description: string;
  category: "rag" | "agent" | "tool" | "eval";
  template: string;
  /** 注入 system prompt 的运行时指令（对话立即生效） */
  systemAddon?: string;
  updatedAt: string;
};

const KEY = "ownagent-prompt-templates-v1";

const BUILT_IN: PromptTemplate[] = [
  {
    id: "rag-qa",
    name: "RAG 知识问答",
    description: "检索知识库后作答，要求标注引用来源",
    category: "rag",
    template:
      "请基于知识库检索结果回答。若知识库无相关内容，明确说明并给出可补充的资料方向。\n\n用户问题：{{query}}",
    systemAddon:
      "【RAG 模式】必须先调用 knowledge_search，回答必须标注来源 chunkId / 项目名；无命中时明确说明并建议补充资料。",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tool-probe",
    name: "Tool Calling · 站点探活",
    description: "调用 http_probe 检查关键页面可用性",
    category: "tool",
    template:
      "请使用 http_probe 工具检查以下 URL 是否可访问，汇总状态码与延迟，并给出修复建议：\n\n{{query}}",
    systemAddon: "【Tool 模式】优先 http_probe，汇总 status / latency，失败时说明 CORS 或网络原因。",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "agent-plan",
    name: "Agent 多步任务",
    description: "拆解复杂任务并逐步执行（Planning → Tools → Action）",
    category: "agent",
    template:
      "将以下任务拆解为可执行 steps，按需调用工具，每步说明依据与结果，最后汇总：\n\n{{query}}",
    systemAddon:
      "【Agent 模式】按 Planning → Tools → Action 拆解；每步写清依据，禁止跳过工具直接编造。",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "eval-regression",
    name: "评测回归",
    description: "运行内置 Router / Policy 评测集",
    category: "eval",
    template: "/eval",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "multi-agent",
    name: "多 Agent 工作流",
    description: "JD：Agentic Workflow / 多智能体编排",
    category: "agent",
    template:
      "以 Planner → Executor → Reviewer 多 Agent 流程处理：\n\n{{query}}\n\n每步说明角色分工与工具调用。",
    systemAddon: "【Multi-Agent】显式标注 Planner / Executor / Reviewer 三角色输出，Reviewer 必须检查 groundedness。",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "rag-rewrite",
    name: "RAG Query Rewrite",
    description: "JD：Query Rewrite / 上下文工程",
    category: "rag",
    template:
      "先改写用户问题为 3 个检索 query，再分别检索知识库，合并去重后作答：\n\n{{query}}",
    systemAddon:
      "【Query Rewrite】检索前将用户问题改写为 2–3 个检索 query；合并多路 hits 去重后作答，列出用到的 query。",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "hitl-ticket",
    name: "HITL 高风险操作",
    description: "JD：Human-in-the-Loop / 安全合规",
    category: "tool",
    template: "请评估以下操作是否需要人工审批，并走 ticket 流程：\n\n{{query}}",
    systemAddon:
      "【HITL 模式】mutate 类操作只许 ticket_draft，禁止 ticket_commit；必须说明风险与需人工确认的原因。",
    updatedAt: new Date().toISOString(),
  },
];

function uid() {
  return `pt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function readCustom(): PromptTemplate[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PromptTemplate[];
  } catch {
    return [];
  }
}

function writeCustom(list: PromptTemplate[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 32)));
}

export function listPromptTemplates(): PromptTemplate[] {
  const custom = readCustom();
  const ids = new Set(custom.map((t) => t.id));
  return [...BUILT_IN.filter((t) => !ids.has(t.id)), ...custom];
}

export function savePromptTemplate(input: Omit<PromptTemplate, "id" | "updatedAt"> & { id?: string }) {
  const custom = readCustom();
  const now = new Date().toISOString();
  if (input.id && !input.id.startsWith("pt-")) {
    const idx = custom.findIndex((t) => t.id === input.id);
    const row: PromptTemplate = { ...input, id: input.id, updatedAt: now };
    if (idx >= 0) custom[idx] = row;
    else custom.unshift(row);
    writeCustom(custom);
    return row;
  }
  const row: PromptTemplate = {
    id: input.id ?? uid(),
    name: input.name,
    description: input.description,
    category: input.category,
    template: input.template,
    updatedAt: now,
  };
  custom.unshift(row);
  writeCustom(custom);
  return row;
}

export function deletePromptTemplate(id: string) {
  if (BUILT_IN.some((t) => t.id === id)) return false;
  writeCustom(readCustom().filter((t) => t.id !== id));
  return true;
}

export function applyPromptTemplate(template: PromptTemplate, query: string) {
  if (template.template.includes("{{query}}")) {
    return template.template.replace(/\{\{query\}\}/g, query.trim() || "（在此填写具体问题）");
  }
  return template.template;
}

export const PROMPT_CATEGORY_LABEL: Record<PromptTemplate["category"], string> = {
  rag: "RAG",
  agent: "Agent",
  tool: "Tool Calling",
  eval: "评测",
};
