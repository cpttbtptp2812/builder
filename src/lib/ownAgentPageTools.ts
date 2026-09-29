/** 把 OwnAgent 这一页真正能做的事注册成页面工具。 */

import { getSkill } from "./agentSkills";
import { mcpServer } from "./mcpServer";
import { registerPageTool, unregisterPageTool } from "./pageTools";
import { newestDraftForSkill, requestSkillOpen } from "./skillCompareStore";
import { caseFromSkillSteps, saveCustomCase } from "./skillTraceCaseStore";

const NAMES = [
  "open_line",
  "search_library",
  "save_question",
  "publish_draft",
  "http_probe",
  "browser_snapshot",
  "knowledge_search",
  "workflow_run",
] as const;

const LINE_LABEL: Record<string, string> = {
  chat: "对话",
  compare: "技能",
  rag: "资料",
  prompts: "提示词",
  feed: "知识广场",
  guard: "规则",
  connect: "接入",
};

function go(view: string) {
  window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view } }));
}

export function installOwnAgentPageTools(): () => void {
  registerPageTool({
    name: "open_line",
    label: "打开栏目",
    description: "打开 OwnAgent 当前页面上的一个栏目",
    inputSchema: {
      type: "object",
      properties: { view: { type: "string", description: "栏目 id" } },
      required: ["view"],
    },
    annotations: { readOnlyHint: true },
    explain: (args) => `打开「${LINE_LABEL[String(args.view)] ?? String(args.view)}」`,
    execute: (args) => {
      const view = String(args.view);
      go(view);
      return { ok: true, view, label: LINE_LABEL[view] ?? view };
    },
  });

  registerPageTool({
    name: "search_library",
    label: "搜资料库",
    description: "用这一页的资料库检索，并打开资料",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
    annotations: { readOnlyHint: true },
    explain: (args) => `在资料库搜索「${String(args.query)}」`,
    execute: async (args) => {
      const query = String(args.query);
      const found = await mcpServer.callTool("knowledge_search", { query, topK: 3 });
      go("rag");
      return found.content;
    },
  });

  registerPageTool({
    name: "save_question",
    label: "记下必问",
    description: "把一句客户的话写进某个技能的发版必问",
    inputSchema: {
      type: "object",
      properties: {
        skillId: { type: "string" },
        query: { type: "string" },
        skillLabel: { type: "string" },
      },
      required: ["skillId", "query"],
    },
    annotations: { consequentialHint: true },
    explain: (args) => `把「${String(args.query)}」记成「${String(args.skillLabel ?? args.skillId)}」的必问`,
    execute: (args) => {
      const skillId = String(args.skillId);
      const query = String(args.query);
      const skill = getSkill(skillId);
      if (!skill) return { ok: false, error: "没有这个技能" };
      const made = caseFromSkillSteps(
        skillId,
        query,
        skill.steps.map((s) => ({ id: s.id, tool: s.tool })),
      );
      const { custom: _custom, ...row } = made;
      saveCustomCase(row);
      return { ok: true, query, skillLabel: String(args.skillLabel ?? skill.name) };
    },
  });

  registerPageTool({
    name: "publish_draft",
    label: "发布草稿",
    description: "打开该技能并按发版检查的结果发布草稿",
    inputSchema: {
      type: "object",
      properties: {
        skillId: { type: "string" },
        skillLabel: { type: "string" },
      },
      required: ["skillId"],
    },
    annotations: { consequentialHint: true },
    explain: (args) => `发布「${String(args.skillLabel ?? args.skillId)}」的草稿。会先走发版检查，过不了就不会上线。`,
    execute: (args) => {
      const skillId = String(args.skillId);
      if (!newestDraftForSkill(skillId)) return { ok: false, error: "没有草稿" };
      sessionStorage.setItem("oa-page-publish", skillId);
      requestSkillOpen(skillId);
      window.dispatchEvent(new CustomEvent("ownagent:page-publish"));
      return { ok: true, skillLabel: String(args.skillLabel ?? skillId) };
    },
  });

  registerPageTool({
    name: "http_probe",
    label: "探活",
    description: "由这一页发出真实请求，看地址能不能打开",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        method: { type: "string" },
      },
      required: ["url"],
    },
    annotations: { readOnlyHint: true },
    explain: (args) => `探活 ${String(args.url)}`,
    execute: async (args) => {
      const out = await mcpServer.callTool("http_probe", args);
      return out.isError ? { ok: false, error: "探活失败", detail: out.content } : out.content;
    },
  });

  registerPageTool({
    name: "browser_snapshot",
    label: "看这个页面",
    description: "读当前这个页面的结构，不离开本页",
    inputSchema: {
      type: "object",
      properties: { compact: { type: "boolean" } },
    },
    annotations: { readOnlyHint: true },
    explain: () => "读取你正在看的这个页面",
    execute: async (args) => {
      const out = await mcpServer.callTool("browser_snapshot", args, { snapshotRoot: document.body });
      return out.isError ? { ok: false, error: "没读到页面" } : out.content;
    },
  });

  registerPageTool({
    name: "knowledge_search",
    label: "查资料",
    description: "在这一页的资料库里查，不跳走",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        topK: { type: "number" },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true },
    explain: (args) => `在资料库查「${String(args.query)}」`,
    execute: async (args) => {
      const out = await mcpServer.callTool("knowledge_search", args);
      return out.isError ? { ok: false, error: "资料库没有结果" } : out.content;
    },
  });

  registerPageTool({
    name: "workflow_run",
    label: "跑工作流",
    description: "把一条工作流放进本机队列",
    inputSchema: {
      type: "object",
      properties: {
        workflowId: { type: "string" },
        mode: { type: "string" },
      },
      required: ["workflowId"],
    },
    annotations: { consequentialHint: true },
    explain: (args) => `把工作流「${String(args.workflowId)}」放进队列`,
    execute: async (args) => {
      const out = await mcpServer.callTool("workflow_run", args);
      return out.isError ? { ok: false, error: "没放进队列" } : out.content;
    },
  });

  return () => {
    for (const name of NAMES) unregisterPageTool(name);
  };
}
