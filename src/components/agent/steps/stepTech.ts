import type { StepId } from "./registry";

export type StepTech = {
  stack: string[];
  how: string;
  bits: string[];
};

export const STEP_TECH: Record<StepId, StepTech> = {
  nlu: {
    stack: ["Unicode NFKC", "正则分词", "CJK / Latin / Digit 字种计数"],
    how: "先把原句做 NFKC 归一，再用标点和空白切开，按 Unicode 区间数中文、英文、数字。这一步不调模型，只产出后面打分用的词表。",
    bits: [
      "String.normalize('NFKC') 去掉全角/半角差异",
      "split(/\\s+|[，。！？、,./:;!?()（）]/) 切词",
      "/[\\u4e00-\\u9fff]/ 计 CJK，/[a-zA-Z]/ 计拉丁，/\\d/ 计数字",
    ],
  },
  intent: {
    stack: ["词表打分路由", "explainDiscovery()", "第一名截断"],
    how: "把切好的词去对每条 Skill 的 triggers。命中加分、技能名包含再加分，按分数排序，只把第一名交给规划。",
    bits: [
      "agentSkills.ts · scoreSkillDetailed：触发词出现就加分",
      "explainDiscovery(query) 返回 SkillDiscoveryRow[]，带 breakdown",
      "并列时也只走第一名，避免两条流程同时开跑",
    ],
  },
  entity: {
    stack: ["正则抽槽", "关键词动作表", "location 回退"],
    how: "用正则抠 http(s) 网址，用固定动词表认动作，问句写「本站」或没写网址时，用当前页 origin 顶上。",
    bits: [
      "/https?:\\/\\/\\S+/ 抽 url",
      "动作词：检查 / 探活 / 分析 / 审计 / 检索 / 打开",
      "缺省 url = window.location.origin，target 写成 site:self",
    ],
  },
  plan: {
    stack: ["三角色流水线", "Planner → Executor → Reviewer", "先拆后跑"],
    how: "已经知道要哪条技能后，先写成任务单：谁规划、谁执行、谁收口。这一步只出计划，不调浏览器或检索。",
    bits: [
      "multiAgentRuntime：三角色逐步吐出中间产物",
      "失败时能指到「哪一个角色、哪一步」而不是整单作废",
      "真正调工具发生在运行内核，不在这里",
    ],
  },
  context: {
    stack: ["Working Set", "token budget", "location / document"],
    how: "只拣这一轮用得上的页面字段（origin、path、title），按 JSON 长度估占用，给后面工具结果留额度。",
    bits: [
      "字段来自 window.location 和 document.title / readyState",
      "budget 用滑条模拟窗口，预留 512 给工具回包",
      "多的字段关掉就不进上下文，避免整页 HTML 塞进去",
    ],
  },
  dsl: {
    stack: ["SKILL.md 说明书", "Vite ?raw", "工具白名单"],
    how: "每条技能是一份机器认的说明书：路径、触发词、步骤、能调哪些工具。内核只认这些字段。",
    bits: [
      "src/skills/*/SKILL.md 用 ?raw 打进包",
      "AgentSkill { skillPath, triggers, steps, tools }",
      "没写进 tools 白名单的，运行时不能 dispatch",
    ],
  },
  manage: {
    stack: ["workflow_run", "工单状态机", "去重 / 版本"],
    how: "把说明书落成一张可跑的工单：给 id、排队、记版本。同一请求点两次合并成一单。",
    bits: [
      "MCP 工具 workflow_run → { workflowId, status, version }",
      "状态：排队 / 运行 / 完成，失败只改这张单",
      "版本钉住后才能回放同一份说明书",
    ],
  },
  pattern: {
    stack: ["seq / par / branch", "调度器", "依赖图"],
    how: "只决定几步怎么排：顺序、并行或失败分叉。互不依赖的探活可以一起打，这里还不执行。",
    bits: [
      "seq：探活完了才看页面",
      "par：几页同时打，最后汇总",
      "branch：失败走重试，成功才进下一步",
    ],
  },
  engine: {
    stack: ["解释器", "程序计数器 pc", "runSkill() → MCP"],
    how: "按说明书一步一步调工具：读当前步、dispatch、写回结果，pc++。点一次 step() 只走一步。",
    bits: [
      "runSkill(skill, query) 按 steps[] 顺序调 mcpServer.callTool",
      "说明书里的 tool 名必须对得上注册名，对不上就停",
      "reset 只清 pc，不改 SKILL.md",
    ],
  },
  mech: {
    stack: ["模板插值", "沙箱", "HITL 放行"],
    how: "把 ${origin} ${path} 这类空位换成真实值，危险写入先停住等人点「允许」，再真正外呼。",
    bits: [
      "String.replace 填 ${变量}",
      "沙箱阶段只准备参数，不发请求",
      "HITL：允许之后才进入 done，避免访客页乱写",
    ],
  },
  ctrl: {
    stack: ["Router Eval", "expected vs predicted", "局部重试"],
    how: "用固定评测集对照「本该走哪条技能、实际走了哪条」。超时只重试坏的那一段，已成功的留下。",
    bits: [
      "evalHarness.runRouterEval()：5 条用例打 explainDiscovery",
      "看 pass / top3，优先改触发词而不是调温度",
      "工具指标：成功率、avg / p50 / p99",
    ],
  },
  browser: {
    stack: ["fetch HEAD", "DOM 无障碍快照", "Performance Timing"],
    how: "真正碰网页：HEAD 探活看能不能访问，走 DOM 收集可点节点，再用 Navigation Timing 看快慢。",
    bits: [
      "http_probe：真实 fetch，记 status / latencyMs",
      "browser_snapshot：walk DOM，收 role / name / tag",
      "PerformanceNavigationTiming：ttfb、load、resourceCount",
    ],
  },
  mcp: {
    stack: ["JSON-RPC 2.0", "tools/list", "tools/call"],
    how: "内核不直接打外部接口。统一走进程内 MCP：先列出工具，再 call 其中一把，回包装成协议结果。",
    bits: [
      "mcpServer：jsonrpc 2.0，id / method / params",
      "tools/list 和对话里的开关是同一份名单",
      "失败带 error.code，不把整个页面打挂",
    ],
  },
  kb: {
    stack: ["Hybrid RAG", "词重叠打分", "出处回传"],
    how: "在本站项目说明里切段、分词，按词重叠 + 项目直匹配 + 段落类型加权，只回 topK 并带 chunkId。",
    bits: [
      "ragEngine.retrieveRag(query, topK)",
      "pipeline：buildCorpus → tokenize → hybrid-score → direct-match",
      "命中带 score / matchedTerms / rank，写答案时能引用",
    ],
  },
};
