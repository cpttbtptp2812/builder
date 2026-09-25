/** 实验执行 — 并发调用 A/B、重复采样、打分、汇总与上线建议 */

import { gradeSide, judgePair } from "./graders";
import { median, pct, signTest, wilson } from "./stats";
import type {
  CaseOutcome,
  CaseResult,
  EvalCase,
  EvalSuite,
  EvalTarget,
  InvokeResult,
  LlmFn,
  RunOptions,
  RunSummary,
  SideSample,
} from "./types";

export type RunnerDeps = {
  invoke: (target: EvalTarget, question: string) => Promise<InvokeResult>;
  llm?: LlmFn;
  onProgress?: (done: number, total: number, results: CaseResult[]) => void;
  shouldStop?: () => boolean;
};

async function sample(target: EvalTarget, c: EvalCase, deps: RunnerDeps, llm?: LlmFn): Promise<SideSample> {
  let r = await deps.invoke(target, c.question);
  // 网络抖动重试一次
  if (r.error && /超时|调用失败|HTTP 5\d\d|HTTP 429/.test(r.error)) r = await deps.invoke(target, c.question);
  const grade = await gradeSide(c, r, llm);
  return { ...r, grade };
}

function passRate(samples: SideSample[]) {
  return samples.length ? samples.filter((s) => s.grade.pass).length / samples.length : 0;
}

async function runCase(
  c: EvalCase,
  a: EvalTarget,
  b: EvalTarget | null,
  opt: RunOptions,
  deps: RunnerDeps,
): Promise<CaseResult> {
  const llm = opt.useLlmJudge ? deps.llm : undefined;
  const aS: SideSample[] = [];
  const bS: SideSample[] = [];
  for (let i = 0; i < Math.max(1, opt.repeats); i++) {
    const [x, y] = await Promise.all([sample(a, c, deps, llm), b ? sample(b, c, deps, llm) : Promise.resolve(null)]);
    aS.push(x);
    if (y) bS.push(y);
  }
  const aPassRate = passRate(aS);
  const bPassRate = passRate(bS);
  const allErr = (xs: SideSample[]) => xs.length > 0 && xs.every((s) => s.error);

  let outcome: CaseOutcome;
  let pair: CaseResult["pair"];
  if (!b) {
    outcome = allErr(aS) ? "error" : aPassRate >= 0.5 ? "pass" : "fail";
  } else if (allErr(aS) || allErr(bS)) {
    outcome = "error";
  } else {
    if (llm && aS[0]!.answer.trim() && bS[0]!.answer.trim() && aS[0]!.answer.trim() !== bS[0]!.answer.trim()) {
      try {
        pair = await judgePair(llm, c, aS[0]!.answer, bS[0]!.answer);
      } catch (err) {
        pair = { winner: "tie", reason: `对比裁判失败：${err instanceof Error ? err.message : String(err)}`, consistent: false };
      }
    }
    if (bPassRate > aPassRate) outcome = "better";
    else if (bPassRate < aPassRate) outcome = "worse";
    else if (pair?.consistent && pair.winner === "B") outcome = "better";
    else if (pair?.consistent && pair.winner === "A") outcome = "worse";
    else if (!pair && checkScore(bS) > checkScore(aS) + 1e-9) outcome = "better";
    else if (!pair && checkScore(bS) < checkScore(aS) - 1e-9) outcome = "worse";
    else outcome = "same";
  }
  return { caseId: c.id, question: c.question, reference: c.reference, a: aS, b: bS, aPassRate, bPassRate, pair, outcome };
}

/** 没有裁判时的细分：通过的检查项占比（取各次平均） */
function checkScore(xs: SideSample[]): number {
  if (!xs.length) return 0;
  return xs.reduce((s, x) => s + (x.grade.checks.length ? x.grade.checks.filter((k) => k.pass).length / x.grade.checks.length : 0), 0) / xs.length;
}

export async function runExperiment(
  suite: EvalSuite,
  a: EvalTarget,
  b: EvalTarget | null,
  opt: RunOptions,
  deps: RunnerDeps,
): Promise<{ results: CaseResult[]; summary: RunSummary; stopped: boolean }> {
  const cases = suite.cases;
  const results: (CaseResult | undefined)[] = new Array(cases.length);
  let next = 0;
  let done = 0;
  let stopped = false;

  async function worker() {
    while (next < cases.length) {
      if (deps.shouldStop?.()) {
        stopped = true;
        return;
      }
      const idx = next++;
      results[idx] = await runCase(cases[idx]!, a, b, opt, deps);
      done++;
      deps.onProgress?.(done, cases.length, results.filter((r): r is CaseResult => Boolean(r)));
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opt.concurrency, 8)) }, worker));
  const list = results.filter((r): r is CaseResult => Boolean(r));
  return { results: list, summary: summarize(list, Boolean(b), opt), stopped };
}

export function summarize(results: CaseResult[], compare: boolean, opt: RunOptions): RunSummary {
  const total = results.length;
  const count = (o: CaseOutcome) => results.filter((r) => r.outcome === o).length;
  const better = count("better");
  const worse = count("worse");
  const same = count("same");
  const errors = count("error");
  const aPass = results.reduce((s, r) => s + r.aPassRate, 0);
  const bPass = results.reduce((s, r) => s + r.bPassRate, 0);
  const aPassRate = total ? aPass / total : 0;
  const bPassRate = total ? bPass / total : 0;
  const judged = results.some((r) => r.a.some((s) => s.grade.judge));
  const reasons: string[] = [];

  let verdict: RunSummary["verdict"] = "ship";
  if (!compare) {
    if (errors > total * 0.2) {
      verdict = "risk";
      reasons.push(`${errors} 题调用失败，先检查接口配置`);
    }
    if (aPassRate < 0.8) {
      verdict = aPassRate < 0.6 ? "block" : "risk";
      reasons.push(`通过率 ${pct(aPassRate)}，${aPassRate < 0.6 ? "明显偏低" : "还有提升空间"}`);
    }
    if (!reasons.length) reasons.push(`通过率 ${pct(aPassRate)}，表现稳定`);
  } else {
    if (errors > total * 0.2) {
      verdict = "risk";
      reasons.push(`${errors} 题调用失败，结论可能不准`);
    }
    if (worse > opt.gate.maxWorse) {
      verdict = "block";
      reasons.push(`${worse} 题变差，超过门槛（最多允许 ${opt.gate.maxWorse} 题）`);
    }
    if (bPassRate < aPassRate - opt.gate.maxPassDrop - 1e-9) {
      verdict = "block";
      reasons.push(`通过率从 ${pct(aPassRate)} 降到 ${pct(bPassRate)}`);
    }
    if (verdict === "ship" && worse > 0) {
      verdict = "risk";
      reasons.push(`有 ${worse} 题变差，建议逐条确认`);
    }
    if (verdict === "ship" && bPassRate < 0.6) {
      verdict = "risk";
      reasons.push(`没有变差，但改动后通过率只有 ${pct(bPassRate)}，整体质量偏低`);
    }
    if (better > 0) reasons.push(`${better} 题变好`);
    if (!reasons.length) reasons.push("没有发现变差的题");
  }

  const title = { ship: compare ? "可以上线" : "表现良好", risk: "有风险，先看变差的题", block: compare ? "别上线" : "问题较多" }[verdict];
  const lat = (side: "a" | "b") => median(results.flatMap((r) => r[side].filter((s) => !s.error).map((s) => s.latencyMs)));
  return {
    total,
    compare,
    better,
    worse,
    same,
    errors,
    aPassRate,
    bPassRate,
    aPassCi: wilson(Math.round(aPass), total),
    bPassCi: wilson(Math.round(bPass), total),
    pValue: compare ? signTest(better, worse) : null,
    aLatencyP50: lat("a"),
    bLatencyP50: lat("b"),
    judged,
    verdict,
    verdictTitle: title,
    reasons,
  };
}
