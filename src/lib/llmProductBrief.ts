/** 办事 LLM 步：只写说明，数字锁引擎 facts */

export type ProductLlmConfig = {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  preset?: string;
};

export type EngineFacts = {
  engineSummary: string;
  /** report 步给模型的完整事实（含明细），没有则只用 engineSummary */
  engineDetail?: string;
  lockedNumbers: string[];
  materialTitle?: string;
  rowCount?: number;
  columnNames?: string[];
};

export function isProductLlmConfigured(cfg: ProductLlmConfig | undefined): boolean {
  if (!cfg?.enabled) return false;
  if (!cfg.baseUrl.trim() || !cfg.model.trim()) return false;
  if (cfg.preset === "ollama" || cfg.preset === "webllm") return true;
  if (cfg.preset === "ollama-cloud") return Boolean(cfg.apiKey.trim());
  return Boolean(cfg.apiKey.trim());
}

export function resolveLlmBaseUrlServer(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

/** 从引擎 report 步输出抽取锁数集合 */
export function engineFactsFromReport(
  report: unknown,
  extras?: { materialTitle?: string; rowCount?: number; columnNames?: string[] },
): EngineFacts | null {
  const r = report as {
    summary?: string;
    detail?: string;
    llmFacts?: string;
    dashboard?: { sheet?: { summary?: string } };
  } | null;
  const engineSummary =
    (typeof r?.summary === "string" && r.summary.trim()) ||
    (typeof r?.detail === "string" && r.detail.trim()) ||
    (typeof r?.dashboard?.sheet?.summary === "string" && r.dashboard.sheet.summary.trim()) ||
    "";
  if (!engineSummary) return null;
  const lockedNumbers = extractLockedNumbers(engineSummary);
  return {
    engineSummary,
    engineDetail: typeof r?.llmFacts === "string" && r.llmFacts.trim() ? r.llmFacts.trim() : undefined,
    lockedNumbers,
    materialTitle: extras?.materialTitle,
    rowCount: extras?.rowCount,
    columnNames: extras?.columnNames,
  };
}

export function extractLockedNumbers(text: string): string[] {
  const found = new Set<string>();
  const re = /\d[\d,]*(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0].replace(/,/g, "");
    if (raw.length >= 2 || raw.includes(".")) found.add(raw);
    else if (Number(raw) >= 10) found.add(raw);
  }
  return [...found];
}

function normalizeNum(s: string): string {
  return s.replace(/,/g, "").trim();
}

/** 模型输出须包含引擎关键数字（归一化后子串匹配） */
export function briefMatchesLockedNumbers(brief: string, locked: string[]): boolean {
  if (!locked.length) return true;
  const normBrief = brief.replace(/,/g, "");
  let hits = 0;
  for (const n of locked) {
    const key = normalizeNum(n);
    if (key && normBrief.includes(key)) hits += 1;
  }
  return hits >= Math.min(locked.length, Math.max(1, Math.ceil(locked.length * 0.6)));
}

export type LlmBriefStyle = {
  /** 角色一句话，例如「客服主管」 */
  role?: string;
  /** 要写什么 */
  task?: string;
  /** true：输出必须包含引擎关键数字（默认）；false：写回复/通知类内容，只禁止编造 */
  lockNumbers?: boolean;
  maxTokens?: number;
};

const DEFAULT_ROLE = "企业报销对账办事员";
const DEFAULT_TASK = "只根据给定的「引擎事实」写一段中文办结说明（2～4 句）。不要 Markdown 标题，不要列表，不要括号里的技术说明。";

export async function runLlmProductBrief(opts: {
  query: string;
  facts: EngineFacts;
  llm: ProductLlmConfig;
  materialSample?: string;
  style?: LlmBriefStyle;
}): Promise<{ ok: true; brief: string } | { ok: false; reason: string }> {
  if (!isProductLlmConfigured(opts.llm)) {
    return { ok: false, reason: "LLM 未启用或未配置" };
  }
  const baseUrl = resolveLlmBaseUrlServer(opts.llm.baseUrl);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.llm.apiKey.trim()) headers.Authorization = `Bearer ${opts.llm.apiKey.trim()}`;
  const lock = opts.style?.lockNumbers !== false;

  const system = [
    `你是${opts.style?.role?.trim() || DEFAULT_ROLE}。`,
    opts.style?.task?.trim() || DEFAULT_TASK,
    lock
      ? "禁止修改、编造任何金额、合计、行数、条数；必须与引擎事实一致。"
      : "所有编号、时间、人名、数字只能照抄引擎事实里出现的，不得编造事实里没有的承诺或数字。",
  ].join("\n");

  const user = [
    `用户诉求：${opts.query.slice(0, 400)}`,
    opts.facts.materialTitle ? `材料：${opts.facts.materialTitle}${opts.facts.rowCount != null ? `，${opts.facts.rowCount} 行` : ""}` : "",
    opts.materialSample ? `材料片段（仅语境）：\n${opts.materialSample.slice(0, 800)}` : "",
    `引擎事实（数字不可改）：\n${opts.facts.engineDetail ?? opts.facts.engineSummary}`,
    lock && opts.facts.lockedNumbers.length ? `锁数：${opts.facts.lockedNumbers.join("、")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: opts.llm.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: opts.style?.maxTokens && opts.style.maxTokens > 0 ? Math.min(4000, opts.style.maxTokens) : 320,
        stream: false,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { ok: false, reason: `LLM HTTP ${res.status}: ${err.slice(0, 120)}` };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const brief = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!brief) return { ok: false, reason: "LLM 空回复" };
    if (lock && !briefMatchesLockedNumbers(brief, opts.facts.lockedNumbers)) {
      return { ok: false, reason: "LLM 说明与引擎锁数不一致" };
    }
    return { ok: true, brief };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "LLM 请求失败" };
  }
}

function sampleMaterialRows(columns: string[], rows: string[][], max = 3): string {
  const head = columns.join(",");
  const body = rows.slice(0, max).map((r) => r.join(","));
  return [head, ...body].join("\n");
}

/** product-run 工具 __llm_product_brief__ */
export async function executeLlmProductBriefTool(opts: {
  query: string;
  reportVar: unknown;
  llm?: ProductLlmConfig;
  material?: { title?: string; rowCount?: number; columns?: string[]; rows?: string[][] };
  /** 结论之后附上模型写的内容（回复草稿、通知），而不是用模型的话替换结论 */
  keepEngineLine?: boolean;
} & LlmBriefStyle): Promise<{
  summary: string;
  detail: string;
  markdown?: string;
  meta: Record<string, unknown>;
}> {
  const facts = engineFactsFromReport(opts.reportVar, {
    materialTitle: opts.material?.title,
    rowCount: opts.material?.rowCount,
    columnNames: opts.material?.columns,
  });
  if (!facts) {
    return {
      summary: "引擎未产出结论，无法生成说明。",
      detail: "缺少 report 步结果",
      meta: { llm: "no_engine_facts" },
    };
  }

  const engineLine = facts.engineSummary;
  if (opts.llm?.enabled && opts.llm.preset === "webllm") {
    return {
      summary: engineLine,
      detail: engineLine,
      markdown: engineLine,
      meta: { llm: "browser", model: opts.llm.model, lockedNumbers: facts.lockedNumbers, engineSummary: engineLine },
    };
  }
  if (!isProductLlmConfigured(opts.llm)) {
    return {
      summary: engineLine,
      detail: `未启用大模型，未发起模型请求。计算结论：${engineLine}`,
      meta: { llm: "skipped", reason: "not_configured" },
    };
  }

  const materialSample =
    opts.material?.columns?.length && opts.material.rows?.length
      ? sampleMaterialRows(opts.material.columns, opts.material.rows)
      : undefined;

  const llmOut = await runLlmProductBrief({
    query: opts.query,
    facts,
    llm: opts.llm!,
    materialSample,
    style: { role: opts.role, task: opts.task, lockNumbers: opts.lockNumbers, maxTokens: opts.maxTokens },
  });

  if (llmOut.ok) {
    const text = opts.keepEngineLine ? `${engineLine}\n\n${llmOut.brief}` : llmOut.brief;
    return {
      summary: text,
      detail: llmOut.brief,
      markdown: text,
      meta: { llm: "used", model: opts.llm!.model },
    };
  }

  return {
    summary: `${engineLine}\n\n模型说明未生成。`,
    detail: "模型说明未生成。",
    markdown: engineLine,
    meta: { llm: "failed", reason: llmOut.reason },
  };
}
