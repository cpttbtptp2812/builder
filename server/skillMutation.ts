/**
 * 技能变异测试：每个变异体都走真实发版检查（evaluateSkillGate + 服务端真实执行）。
 * 检查结论比原版自检更严 = 被抓住；证明器证明与原版等价的变异体不计入分母。
 * 没被抓住的：数值变异由证明器生成一张能区分的单据，结构变异用已认可版本的输出指纹，生成检查 case；
 * 新 case 必须先在原版上通过、再在真实检查里抓住变异体，才会给出。
 */

import type { Hono } from "hono";
import { enrichSkillCatalog, hydrateSkill, parseSkillMarkdown, type SkillManifest } from "../src/lib/skillMarkdown.ts";
import { evaluateSkillGate } from "../src/lib/evaluateSkillGate.ts";
import { mustRunServerProcessSkill } from "../src/lib/customerSkillKernel.ts";
import { gateQueryWithSampleData } from "../src/lib/productSkillInputs.ts";
import { stepFingerprint, type SkillTraceCase, type TraceObservation } from "../src/lib/provingGround.ts";
import { generateSkillMutants, MUTANT_KIND_LABEL, type MutantKind } from "../src/lib/skillMutants.ts";
import type { GateVerdict } from "../src/lib/ownagentProtocol.ts";
import { runLiveGateComparisonOnServer } from "./liveGateRunner.ts";
import { runSkillManifestOnServer } from "./skills.ts";
import { appendGateCases, loadGateCases, loadGatePolicy, teamAccess, writeAudit } from "./skillGate.ts";
import { proveLedgerRules } from "./ruleProver.ts";
import { currentSkillRaw } from "./labSession.ts";

export type MutantOutcome = {
  id: string;
  kind: MutantKind;
  kindLabel: string;
  label: string;
  status: "killed" | "survived" | "equivalent";
  gate: GateVerdict;
  reason: string;
  killedBySuggestion: string | null;
};

export type SuggestedCase = {
  case: SkillTraceCase;
  why: string;
  csv: string | null;
  kills: string[];
};

export type MutationReport = {
  ok: boolean;
  error?: string;
  skillId: string;
  version: string;
  selfGate: GateVerdict;
  cases: { id: string; query: string; observed: number; stopAt: string | null }[];
  mutants: MutantOutcome[];
  score: { killed: number; survived: number; equivalent: number; pct: number };
  byKind: { kind: MutantKind; label: string; killed: number; total: number }[];
  suggestions: SuggestedCase[];
  after: { killed: number; total: number; pct: number } | null;
  ms: number;
};

const RANK: Record<GateVerdict, number> = { PASS: 0, WARN: 1, BLOCK: 2 };

function hydrate(skillId: string, raw: string, tag: string): SkillManifest {
  return enrichSkillCatalog([hydrateSkill(raw, { id: skillId, skillPath: `${tag}://${skillId}` })], "server")[0]!;
}

async function gateOf(base: SkillManifest, cand: SkillManifest, cases: SkillTraceCase[]) {
  return evaluateSkillGate(
    { baseline: base, candidate: cand, cases, policy: loadGatePolicy(), environment: "prod" },
    { runComparison: runLiveGateComparisonOnServer },
  );
}

function mainReason(reasons: string[]): string {
  return reasons.find((r) => r.startsWith("[trace]") || r.startsWith("[compile]")) ?? reasons.find((r) => r !== "相对 baseline 有内容变更") ?? reasons[0] ?? "";
}

function pct(a: number, b: number): number {
  return b ? Math.round((a / b) * 1000) / 10 : 0;
}

/** 用原版真实运行同一句话，记录每步输出指纹；若被门闩拦下则记录拦在哪一步 */
async function goldenCase(base: SkillManifest, id: string, query: string): Promise<SkillTraceCase> {
  const { trace } = await runSkillManifestOnServer(base as Parameters<typeof runSkillManifestOnServer>[0], gateQueryWithSampleData(base.id, query), "skill-gate", {
    productWorkbench: true,
  });
  const last = trace[trace.length - 1];
  const stopAt = last && !last.ok && last.tool !== "__llm_product_brief__" ? last.stepId : undefined;
  const observe: TraceObservation[] = trace
    .filter((t) => t.ok && t.tool.startsWith("__") && t.tool !== "__llm_product_brief__")
    .map((t) => ({
      stepId: t.stepId,
      fingerprint: stepFingerprint(t.result),
      detail: String((t.result as { detail?: unknown } | undefined)?.detail ?? "").slice(0, 120),
    }));
  return {
    id,
    skillId: base.id,
    query,
    expect: { steps: base.steps.map((s) => ({ stepId: s.id, tool: s.tool })), observe, ...(stopAt ? { stopAt } : {}) },
  };
}

function caseCsv(row: { gross: number; tax: number; invoice: number | null }): string {
  const f = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4))));
  return ["部门,申请人,金额,税额,发票额,状态", `证明器补测,区分单据,${f(row.gross)},${f(row.tax)},${row.invoice == null ? "" : f(row.invoice)},待审`].join("\n");
}

export async function runMutationSuite(skillId: string, raw: string, version = ""): Promise<MutationReport> {
  const started = Date.now();
  const empty = (error: string): MutationReport => ({
    ok: false,
    error,
    skillId,
    version: "",
    selfGate: "PASS",
    cases: [],
    mutants: [],
    score: { killed: 0, survived: 0, equivalent: 0, pct: 0 },
    byKind: [],
    suggestions: [],
    after: null,
    ms: Date.now() - started,
  });
  if (!mustRunServerProcessSkill(skillId)) return empty("变异测试只针对办事技能。");
  const parsed = parseSkillMarkdown(raw);
  const base = hydrate(skillId, raw, "mutation-base");
  if ((base.diagnostics ?? []).some((d) => d.level === "error")) return empty("原版本身编译不过，先修好再测。");
  const cases = loadGateCases(skillId);
  const self = await gateOf(base, base, cases);
  const mutants = generateSkillMutants(raw);
  if (!mutants.length) return empty("这项技能生成不出变异体。");

  const outcomes: MutantOutcome[] = [];
  const survivors: { m: (typeof mutants)[number]; skill: SkillManifest; proof: Awaited<ReturnType<typeof proveLedgerRules>> | null }[] = [];
  for (const m of mutants) {
    const skill = hydrate(skillId, m.raw, `mutant-${m.id}`);
    const gate = await gateOf(base, skill, cases);
    const killed = RANK[gate.gate] > RANK[self.gate];
    let status: MutantOutcome["status"] = killed ? "killed" : "survived";
    let reason = killed ? mainReason(gate.reasons) : "检查集全部通过，没发现这处改坏";
    const proof = m.kind === "param" ? await proveLedgerRules(raw, m.raw) : null;
    if (proof?.supported && proof.verdict === "equivalent") {
      status = "equivalent";
      reason = killed
        ? "证明器已证明业务结果与原版完全相同（检查只因说明文字不同而报警），不计入得分"
        : "证明器已证明：任何单据在两版下结果都一样，不算漏检";
    }
    outcomes.push({ id: m.id, kind: m.kind, kindLabel: MUTANT_KIND_LABEL[m.kind], label: m.label, status, gate: gate.gate, reason, killedBySuggestion: null });
    if (status === "survived") survivors.push({ m, skill, proof });
  }

  const baseQuery = cases[0]?.query ?? parsed.triggers[0] ?? parsed.name;
  const suggestions: SuggestedCase[] = [];
  const killsWith = async (skill: SkillManifest, extra: SkillTraceCase) =>
    RANK[(await gateOf(base, skill, [...cases, extra])).gate] > RANK[self.gate];

  for (const s of survivors) {
    const outcome = outcomes.find((o) => o.id === s.m.id)!;
    let hit: SuggestedCase | undefined;
    for (const sug of suggestions) {
      if (await killsWith(s.skill, sug.case)) {
        hit = sug;
        break;
      }
    }
    if (!hit) {
      let candidate: SuggestedCase | null = null;
      const ce = s.proof?.counterexamples.find((c) => c.engineConfirmed) ?? s.proof?.counterexamples[0];
      if (ce) {
        const csv = caseCsv(ce.row);
        const golden = await goldenCase(base, `mut-${skillId}-${s.m.id}`, `${baseQuery}\n\n\`\`\`csv\n${csv}\n\`\`\``);
        candidate = { case: golden, csv, why: `证明器找到的区分单据：${ce.fieldLabel}在两版下不同（原版 ${ce.baseline.queue}${ce.baseline.blocked ? "·拦截" : ""}，改坏版 ${ce.candidate.queue}${ce.candidate.blocked ? "·拦截" : ""}）`, kills: [] };
      } else if (s.m.kind !== "param") {
        const golden = await goldenCase(base, `mut-${skillId}-fingerprint`, baseQuery);
        candidate = { case: golden, csv: null, why: `给现有检查句子加上原版每步输出指纹（${golden.expect.observe?.length ?? 0} 步）`, kills: [] };
      }
      if (candidate && (await gateOf(base, base, [...cases, candidate.case])).gate === self.gate && (await killsWith(s.skill, candidate.case))) {
        suggestions.push(candidate);
        hit = candidate;
      }
    }
    if (hit) {
      hit.kills.push(s.m.id);
      outcome.killedBySuggestion = hit.case.id;
    }
  }

  const counted = outcomes.filter((o) => o.status !== "equivalent");
  const killed = counted.filter((o) => o.status === "killed").length;
  let after: MutationReport["after"] = null;
  if (suggestions.length) {
    const all = [...cases, ...suggestions.map((s) => s.case)];
    let k = 0;
    for (const o of counted) {
      if (o.status === "killed") {
        k += 1;
        continue;
      }
      const m = mutants.find((x) => x.id === o.id)!;
      if (RANK[(await gateOf(base, hydrate(skillId, m.raw, `mutant-${m.id}`), all)).gate] > RANK[self.gate]) k += 1;
    }
    after = { killed: k, total: counted.length, pct: pct(k, counted.length) };
  }

  const kinds = [...new Set(outcomes.map((o) => o.kind))];
  return {
    ok: true,
    skillId,
    version,
    selfGate: self.gate,
    cases: cases.map((c) => ({ id: c.id, query: c.query.split("\n")[0]!.slice(0, 80), observed: c.expect.observe?.length ?? 0, stopAt: c.expect.stopAt ?? null })),
    mutants: outcomes,
    score: { killed, survived: counted.length - killed, equivalent: outcomes.length - counted.length, pct: pct(killed, counted.length) },
    byKind: kinds.map((kind) => {
      const rows = outcomes.filter((o) => o.kind === kind && o.status !== "equivalent");
      return { kind, label: MUTANT_KIND_LABEL[kind], killed: rows.filter((o) => o.status === "killed").length, total: rows.length };
    }),
    suggestions,
    after,
    ms: Date.now() - started,
  };
}

export function registerSkillMutation(app: Hono) {
  app.post("/api/lab/mutation", async (c) => {
    const body = await c.req.json<{ skillId?: string; raw?: string }>().catch(() => null);
    const skillId = String(body?.skillId ?? "");
    const skill = currentSkillRaw(skillId);
    if (!skill) return c.json({ error: "没有这项技能" }, 404);
    const draft = typeof body?.raw === "string" && body.raw.trim() && body.raw !== skill.raw ? body.raw : null;
    try {
      return c.json(await runMutationSuite(skillId, draft ?? skill.raw, draft ? "草稿" : skill.version));
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "变异测试失败" }, 500);
    }
  });
  app.post("/api/lab/mutation/adopt", async (c) => {
    const access = teamAccess(c.req.header("authorization"), "prod", "publish");
    if (!access.ok) return c.json({ error: access.error }, access.status);
    const body = await c.req.json<{ skillId?: string; cases?: SkillTraceCase[] }>().catch(() => null);
    const skillId = String(body?.skillId ?? "");
    const cases = Array.isArray(body?.cases) ? body.cases : [];
    if (!currentSkillRaw(skillId) || !cases.length) return c.json({ error: "skillId 与 cases 必填" }, 400);
    const valid = cases.filter(
      (row) => row && typeof row.id === "string" && row.skillId === skillId && typeof row.query === "string" && Array.isArray(row.expect?.steps),
    );
    if (valid.length !== cases.length) return c.json({ error: "case 格式不对" }, 400);
    const total = appendGateCases(skillId, valid);
    writeAudit({ skillId, action: "cases.adopt", actor: access.actor, note: `变异测试补充 ${valid.length} 条`, payload: valid.map((v) => v.id) });
    return c.json({ ok: true, added: valid.length, total });
  });
}
