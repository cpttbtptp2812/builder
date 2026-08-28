/** 一键演示场景 — 对齐 agent / imean-ai 核心交互链路 */

export type Scenario = {
  id: string;
  label: string;
  project: "agent" | "imean" | "both";
  prompt: string;
  desc: string;
};

export const SCENARIOS: Scenario[] = [
  {
    id: "workflow",
    label: "工作流匹配",
    project: "imean",
    prompt: "帮我找一个电商自动化工作流",
    desc: "iMean · chatMatchWorkflows → 匹配卡片",
  },
  {
    id: "knowledge",
    label: "MCP 工具卡",
    project: "agent",
    prompt: "查一下知识库文档和 RAG 检索结果",
    desc: "Agent · Knowledge / MCP 工具渲染",
  },
  {
    id: "execute",
    label: "执行进度",
    project: "imean",
    prompt: "运行批量改价上架流程",
    desc: "iMean · process 步骤 + DOM 回放",
  },
  {
    id: "agent",
    label: "多智能体",
    project: "agent",
    prompt: "切换运维 Agent 做发布前检查",
    desc: "Agent · 智能体切换 + 专属开场",
  },
];

export const REPLAY_STEPS = [
  { selector: "nav.products", label: "定位商品管理入口" },
  { selector: "table.sku-list", label: "读取 SKU 表格" },
  { selector: "input.price", label: "填写改价字段" },
  { selector: "button.submit", label: "提交并等待响应" },
];
