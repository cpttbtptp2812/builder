import { spawnSync } from "node:child_process";
import path from "node:path";
import type { RuleProofReport } from "../src/lib/ledgerRuleModel.ts";

/** 子进程跑 Z3 证明，进程退出后 wasm 堆一并释放 */
export function proveLedgerRulesIsolated(baselineRaw: string, candidateRaw: string): RuleProofReport {
  const script = path.join(process.cwd(), "scripts", "prove-ledger-child.ts");
  const input = JSON.stringify({ baselineRaw, candidateRaw });
  const r = spawnSync("npx", ["tsx", script], {
    input,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    cwd: process.cwd(),
    shell: true,
    env: { ...process.env, OWNGENT_Z3_ISOLATE: "0" },
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || "prove-ledger-child failed").trim());
  }
  return JSON.parse(r.stdout) as RuleProofReport;
}

export async function proveLedgerRulesMaybeIsolated(
  baselineRaw: string,
  candidateRaw: string,
): Promise<RuleProofReport> {
  if (process.env.OWNAGENT_Z3_ISOLATE === "1") {
    return proveLedgerRulesIsolated(baselineRaw, candidateRaw);
  }
  const { proveLedgerRules } = await import("./ruleProver.ts");
  return proveLedgerRules(baselineRaw, candidateRaw);
}
