/** 回归评测 — 数据模型（浏览器与服务端共用，不依赖任何运行环境） */

export type TargetKind = "http" | "openai" | "builtin";

/** 接口接入：把客户自己的 AI 应用当黑盒调用 */
export type HttpTargetConfig = {
  url: string;
  method: "POST" | "GET";
  headers: Record<string, string>;
  /** 请求体模板，{{question}} 会替换为问题（已做 JSON 转义） */
  bodyTemplate: string;
  /** 从响应里取答案的路径，如 answer / choices.0.message.content */
  answerPath: string;
  /** 从响应里取引用列表的路径（可选） */
  citationsPath?: string;
  /** 引用项里取文本的字段（可选，默认依次尝试 content/text/title） */
  citationField?: string;
  /** 响应是 SSE 流 */
  stream?: boolean;
  /** 流式：delta = 逐段拼接；final = 取最后一段 */
  streamMode?: "delta" | "final";
  /** 流式：只取该事件名的数据（如 conversation.message.delta） */
  streamEvent?: string;
};

/** 直连 OpenAI 兼容模型：用来对比两个模型 / 两版系统提示词 */
export type OpenAiTargetConfig = {
  baseUrl: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
  temperature: number;
};

/** 本系统内置 Agent */
export type BuiltinTargetConfig = {
  /** full = 技能路由 + 资料库；kb-only = 只查资料库 */
  variant: "full" | "kb-only";
};

export type EvalTarget = {
  id: string;
  name: string;
  kind: TargetKind;
  preset?: string;
  note?: string;
  http?: HttpTargetConfig;
  openai?: OpenAiTargetConfig;
  builtin?: BuiltinTargetConfig;
  createdAt: string;
  updatedAt: string;
};

export type CaseOrigin = "import" | "paste" | "log" | "generated" | "manual";

export type EvalCase = {
  id: string;
  question: string;
  /** 参考答案 */
  reference?: string;
  mustInclude?: string[];
  mustNotInclude?: string[];
  /** 回答或引用里应出现的来源（文档标题 / 关键词） */
  expectSource?: string;
  tags?: string[];
  origin?: CaseOrigin;
};

export type EvalSuite = {
  id: string;
  name: string;
  description?: string;
  cases: EvalCase[];
  createdAt: string;
  updatedAt: string;
};

export type InvokeResult = {
  answer: string;
  citations: string[];
  latencyMs: number;
  error?: string;
};

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };
export type LlmFn = (messages: LlmMessage[]) => Promise<string>;

export type JudgeConfig = { baseUrl: string; model: string; apiKey: string };

export type RunOptions = {
  repeats: number;
  concurrency: number;
  useLlmJudge: boolean;
  gate: {
    /** 允许变差的题数上限 */
    maxWorse: number;
    /** B 通过率不得低于 A 的幅度（0.05 = 允许降 5 个百分点） */
    maxPassDrop: number;
  };
};

export const DEFAULT_RUN_OPTIONS: RunOptions = {
  repeats: 1,
  concurrency: 3,
  useLlmJudge: true,
  gate: { maxWorse: 0, maxPassDrop: 0 },
};

export type CheckResult = { id: string; label: string; pass: boolean; detail?: string };

export type JudgeVerdict = { verdict: "pass" | "fail" | "unsure"; reason: string };

export type SideGrade = {
  pass: boolean;
  checks: CheckResult[];
  judge?: JudgeVerdict;
  /** 参考答案内容在回答里的覆盖率 0~1 */
  similarity?: number;
};

export type SideSample = InvokeResult & { grade: SideGrade };

export type PairVerdict = {
  winner: "A" | "B" | "tie";
  reason: string;
  /** 交换顺序两次判断一致 */
  consistent: boolean;
};

export type CaseOutcome = "better" | "worse" | "same" | "pass" | "fail" | "error";

export type CaseResult = {
  caseId: string;
  question: string;
  reference?: string;
  a: SideSample[];
  b: SideSample[];
  aPassRate: number;
  bPassRate: number;
  pair?: PairVerdict;
  outcome: CaseOutcome;
};

export type RunVerdict = "ship" | "risk" | "block";

export type RunSummary = {
  total: number;
  compare: boolean;
  better: number;
  worse: number;
  same: number;
  errors: number;
  aPassRate: number;
  bPassRate: number;
  /** B 通过率 95% 区间 */
  bPassCi: [number, number];
  aPassCi: [number, number];
  /** 变好/变差 的符号检验 p 值（越小越说明不是偶然） */
  pValue: number | null;
  aLatencyP50: number;
  bLatencyP50: number;
  judged: boolean;
  verdict: RunVerdict;
  verdictTitle: string;
  reasons: string[];
};

export type RunStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export type EvalRun = {
  id: string;
  name: string;
  suiteId: string;
  suiteName: string;
  targetA: { id: string; name: string };
  targetB: { id: string; name: string } | null;
  options: RunOptions;
  status: RunStatus;
  progress: { done: number; total: number };
  results: CaseResult[];
  summary?: RunSummary;
  error?: string;
  judgeModel?: string;
  createdAt: string;
  finishedAt?: string;
};

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
