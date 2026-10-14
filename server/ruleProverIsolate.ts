import { spawnSync } from "node:child_process";
import path from "node:path";
import type { RuleProofReport } from "../src/lib/ledgerRuleModel.ts";

function parseChildReport(stdout: string): RuleProofReport {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error("prove-ledger-child 无 stdout");
  return JSON.parse(trimmed) as RuleProofReport;
}

/** 子进程跑 Z3 证明，进程退出后 wasm 堆一并释放 */
export function proveLedgerRulesIsolated(baselineRaw: string, candidateRaw: string): RuleProofReport {
  const script = path.join(process.cwd(), "scripts", "prove-ledger-child.ts");
  const input = JSON.stringify({ baselineRaw, candidateRaw });
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = spawnSync("npx", ["tsx", script], {
      input,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      cwd: process.cwd(),
      shell: true,
      env: { ...process.env, OWNGENT_Z3_ISOLATE: "0" },
    });
    if (r.error) {
      lastErr = r.error.message;
      continue;
    }
    try {
      return parseChildReport(r.stdout);
    } catch {
      lastErr = (r.stderr || r.stdout || `exit ${r.status}`).trim();
    }
  }
  throw new Error(lastErr || "prove-ledger-child failed");
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
