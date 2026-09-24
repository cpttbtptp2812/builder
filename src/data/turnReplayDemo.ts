/** Turn 回放演示 — 首页 / 产品预览用的一轮完整决策链 */

import type { FlowJournalNode } from "../lib/turnFlowJournal";

export const DEMO_REPLAY_QUERY = "产品怎么部署到 Docker？";

export const DEMO_REPLAY_JOURNAL: FlowJournalNode[] = [
  {
    id: "read",
    label: "读问题",
    hint: "Agent 先理解您问了什么",
    status: "done",
    chips: ["产品怎么部署到 Docker？"],
    evidence: [
      {
        id: "q",
        kind: "query",
        title: "产品怎么部署到 Docker？",
      },
    ],
  },
  {
    id: "route",
    label: "定路径",
    hint: "判断走知识库、工具还是技能",
    status: "done",
    chips: ["知识广场已有答案（匹配 94%）"],
    evidence: [
      {
        id: "plaza",
        kind: "route",
        title: "知识广场命中",
        excerpt: "Docker 一键部署：docker compose up -d，默认 8787 端口…",
        score: 0.94,
        meta: "零 Token",
      },
    ],
  },
  {
    id: "fetch",
    label: "取材料",
    hint: "检索知识库或调用工具拿依据",
    status: "done",
    chips: ["OwnAgent 部署 · 相关度 94%"],
    evidence: [
      {
        id: "hit-1",
        kind: "hit",
        title: "OwnAgent 部署指南",
        excerpt: "docker compose up -d 启动 web + api + clip 三服务…",
        score: 0.94,
        meta: "广场 · 已验证",
      },
    ],
  },
  {
    id: "write",
    label: "写答复",
    hint: "基于材料组织回答",
    status: "done",
    chips: ["答复已生成 · 186 字"],
    evidence: [
      {
        id: "answer",
        kind: "stream",
        title: "答复已生成",
        excerpt: "在项目根目录执行 docker compose up -d…",
        meta: "186 字 · 0 Token",
      },
    ],
  },
];

export const DEMO_REPLAY_MS = 1240;
