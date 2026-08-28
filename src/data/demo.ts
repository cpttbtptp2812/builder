export type Agent = {
  id: string;
  name: string;
  desc: string;
  opening: string;
  tags: string[];
};

export type Workflow = {
  id: string;
  channel: string;
  title: string;
  desc: string;
  steps: number;
};

export type ChatMsg =
  | { id: string; kind: "user"; text: string; t: number }
  | { id: string; kind: "assistant"; text: string; t: number; streaming?: boolean }
  | {
      id: string;
      kind: "workflows";
      t: number;
      items: { id: string; title: string; score: number }[];
    }
  | {
      id: string;
      kind: "process";
      t: number;
      title: string;
      status: "running" | "done" | "failed";
      step: number;
      total: number;
      label: string;
    }
  | { id: string; kind: "tool"; t: number; name: string; output: string }
  | { id: string; kind: "rating"; t: number };

export type Session = {
  id: string;
  title: string;
  agentId: string;
  agentName: string;
  messages: ChatMsg[];
  updatedAt: number;
};

export const AGENTS: Agent[] = [
  {
    id: "master",
    name: "默认助手",
    desc: "通用对话、工具调用与工作流编排（参考 UniAgent）",
    opening: "你好，我可以聊天、查知识库，或在对话里触发工作流。",
    tags: ["对话", "工具", "工作流"],
  },
  {
    id: "ops",
    name: "运维 Agent",
    desc: "巡检脚本、告警处理与自动化回放",
    opening: "描述你的运维场景，我会匹配可执行的自动化流程。",
    tags: ["巡检", "HTTP", "通知"],
  },
  {
    id: "data",
    name: "数据分析",
    desc: "表格导入、LLM 抽取与报表（参考 iMean 组件流）",
    opening: "可以上传表格或描述分析需求，我会规划数据处理步骤。",
    tags: ["ImportTable", "LLM", "Sheet"],
  },
];

export const WORKFLOWS: Workflow[] = [
  {
    id: "w1",
    channel: "电商运营",
    title: "批量改价上架",
    desc: "表格导入 SKU → 打开后台 → DOM 步骤回放改价（iMean 回放引擎）",
    steps: 12,
  },
  {
    id: "w2",
    channel: "电商运营",
    title: "异常订单排查",
    desc: "规则匹配 + HTTP 拉取 + 结果导出",
    steps: 8,
  },
  {
    id: "w3",
    channel: "办公自动化",
    title: "会议纪要 → 待办",
    desc: "LLM 抽取 Action Items 并写入在线表格",
    steps: 5,
  },
  {
    id: "w4",
    channel: "DevOps",
    title: "发布前检查",
    desc: "多环境 HTTP 探活、等待、企业微信通知",
    steps: 9,
  },
];

export const RUN_STEPS = [
  "planningProcessStructure",
  "打开场景 URL",
  "taggingAtomicFlow",
  "填写表单字段",
  "execHTTPRequest",
  "execPrintComponent",
  "finishProcess",
];

export function id() {
  return crypto.randomUUID();
}

export function matchWorkflows(q: string) {
  const s = q.toLowerCase();
  const hit = WORKFLOWS.filter(
    (w) =>
      w.title.includes(q) ||
      w.desc.includes(q) ||
      w.channel.includes(q) ||
      /工作流|自动化|流程|跑一下|执行/.test(s),
  );
  return (hit.length ? hit : WORKFLOWS.slice(0, 2)).map((w, i) => ({
    id: w.id,
    title: w.title,
    score: 0.94 - i * 0.07,
  }));
}

export function replyFor(text: string): string {
  if (/工作流|自动化|流程/.test(text)) {
    return "我在场景库里找到了可能匹配的流程。你可以点选卡片开始执行，或到「工作流库」浏览全部频道。";
  }
  if (/知识|文档|RAG/.test(text)) {
    return "（模拟 MCP/Knowledge 工具）已从知识库检索到 3 条相关片段，并在下方展示工具结果卡片。";
  }
  return `已收到你的问题。这是功能展示页：支持流式回复、工作流匹配、执行进度与工具卡片——对应 agent 与 iMean 的核心交互。`;
}
