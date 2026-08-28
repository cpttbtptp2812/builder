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
  | { id: string; kind: "searching"; t: number; text: string }
  | { id: string; kind: "reasoning"; t: number; text: string; streaming?: boolean; collapsed?: boolean }
  | {
      id: string;
      kind: "workflows";
      t: number;
      items: { id: string; title: string; score: number; channel?: string }[];
    }
  | {
      id: string;
      kind: "process";
      t: number;
      title: string;
      status: "planning" | "running" | "done" | "failed";
      step: number;
      total: number;
      label: string;
    }
  | {
      id: string;
      kind: "tool";
      t: number;
      name: string;
      output: string;
      status: "loading" | "done";
    }
  | { id: string; kind: "rating"; t: number; voted?: "up" | "down" }
  | { id: string; kind: "topics"; t: number; title: string; items: string[] };

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
    channel: w.channel,
  }));
}

import { reasoningForProject, replyForProject } from "./knowledge";

export function replyFor(text: string): string {
  const fromKnowledge = replyForProject(text);
  if (fromKnowledge) return fromKnowledge;

  if (/运维|发布|检查/.test(text)) {
    return "已切换到运维 Agent 上下文。我在 DevOps 频道找到「发布前检查」流程，包含多环境 HTTP 探活与企业微信通知步骤。";
  }
  if (/运行|改价|上架|执行/.test(text)) {
    return "好的，正在启动「批量改价上架」流程。右侧回放面板会同步展示 DOM 步骤定位与执行进度。";
  }
  if (/工作流|自动化|流程/.test(text)) {
    return "我在场景库里找到了可能匹配的流程。你可以点选卡片开始执行，右侧可观看 DOM 回放演示。";
  }
  if (/知识|文档|RAG/.test(text)) {
    return "正在调用 Knowledge / MCP 工具检索知识库，结果会以工具卡形式展示在对话流中。";
  }
  return "这是基于 agent + iMean AI 架构的前端交互演示：流式对话、工具卡、工作流匹配与执行进度。";
}

export function reasoningFor(text: string): string {
  if (replyForProject(text) || /项目|介绍|简历|团队|性能|全部/.test(text)) {
    return reasoningForProject(text);
  }
  if (/知识|文档|RAG/.test(text)) {
    return "1. 解析用户意图 → 知识检索\n2. 选择 MCP Knowledge 工具\n3. 聚合 Top-K 片段并格式化输出";
  }
  if (/工作流|自动化|运行|改价/.test(text)) {
    return "1. 意图分类 → workflow_match\n2. 查询频道库与场景标签\n3. 按语义相似度排序返回 Top-N";
  }
  return "1. 分析请求类型\n2. 选择响应策略\n3. 组装流式输出";
}
