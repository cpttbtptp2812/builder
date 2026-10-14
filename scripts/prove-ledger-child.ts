/**
 * 独立进程跑单次 proveLedgerRules，避免 Z3 wasm 在同一 Node 进程内累积内存。
 * stdin: { "baselineRaw": "...", "candidateRaw": "..." }
 * stdout: RuleProofReport JSON
 */
import { readFileSync } from "node:fs";

const input = readFileSync(0, "utf8");
const body = JSON.parse(input) as { baselineRaw?: string; candidateRaw?: string };
if (!body.baselineRaw || !body.candidateRaw) {
  console.error("baselineRaw and candidateRaw required");
  process.exit(2);
}

const { proveLedgerRules } = await import("../server/ruleProver.ts");
const report = await proveLedgerRules(body.baselineRaw, body.candidateRaw);
process.stdout.write(JSON.stringify(report));
