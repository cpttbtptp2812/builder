/**
 * 独立进程跑单次 proveLedgerRules，避免 Z3 wasm 在同一 Node 进程内累积内存。
 * stdin: { "baselineRaw": "...", "candidateRaw": "..." }
 * stdout: RuleProofReport JSON（Z3 崩溃时也写 unknown 报告并 exit 0，避免父进程误判）
 */
import { readFileSync } from "node:fs";
import type { RuleProofReport } from "../src/lib/ledgerRuleModel.ts";

function failSoft(reason: string): never {
  process.stdout.write(JSON.stringify(unknownReport(reason)));
  process.exit(0);
}

function unknownReport(reason: string): RuleProofReport {
  return {
    supported: false,
    reason,
    verdict: "unknown",
    headline: reason,
    solver: { name: "Z3", version: "", ms: 0, queries: 0, assertions: 0 },
    scale: 100,
    stepsCompared: 0,
    stepsChanged: [],
    structuralChanges: [],
    unmodeled: [],
    counterexamples: [],
    deadBranches: [],
    smtlib: "",
  };
}

process.on("uncaughtException", (err) => {
  failSoft(`证明器未捕获异常：${(err instanceof Error ? err.message : String(err)).slice(0, 240)}`);
});
process.on("unhandledRejection", (reason) => {
  failSoft(`证明器 Promise 拒绝：${String(reason).slice(0, 240)}`);
});

const input = readFileSync(0, "utf8");
let body: { baselineRaw?: string; candidateRaw?: string };
try {
  body = JSON.parse(input) as { baselineRaw?: string; candidateRaw?: string };
} catch {
  process.stdout.write(JSON.stringify(unknownReport("证明子进程：stdin 不是合法 JSON。")));
  process.exit(0);
}
if (!body.baselineRaw || !body.candidateRaw) {
  process.stdout.write(JSON.stringify(unknownReport("证明子进程缺少 baselineRaw 或 candidateRaw。")));
  process.exit(0);
}

try {
  const { proveLedgerRules } = await import("../server/ruleProver.ts");
  const report = await proveLedgerRules(body.baselineRaw, body.candidateRaw);
  process.stdout.write(JSON.stringify(report));
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  process.stdout.write(JSON.stringify(unknownReport(`证明器异常：${msg.slice(0, 240)}`)));
}
process.exit(0);
