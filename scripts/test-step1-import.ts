/**
 * ledger-desk：门闩 → 解析导入 → import part ready → 可继续（不跑办结）。
 */
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(os.tmpdir(), `ownagent-step1-${randomUUID()}.sqlite`);

import { parseCsvText } from "../src/lib/productDataStore.ts";
import { dbRun } from "../server/db.ts";
import { continueProductRun, saveServerDataset, startProductRun } from "../server/productRun.ts";
import { requirementsForSkill } from "../src/lib/productSkillInputs.ts";

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}

const SKILL_ID = "ledger-desk";
const QUERY = "按部门汇总报销表";
const CSV = `所属部门,报销人,报销金额,税额,发票金额,状态
研发,员工1,9001,100,9001,待审`;

async function main() {
  const staleSession = `step1-stale-${randomUUID()}`;
  dbRun(
    `INSERT INTO product_datasets (session_id, slot, title, columns_json, rows_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      staleSession,
      "expense-ledger",
      "旧流水误导入",
      JSON.stringify(["月份", "流入万元"]),
      JSON.stringify([
        ["2025-01", "1"],
        ["2025-02", "2"],
      ]),
      new Date().toISOString(),
    ],
  );
  const staleGate = await startProductRun({
    sessionId: staleSession,
    skillId: SKILL_ID,
    query: QUERY,
  });
  if (!staleGate.ok || staleGate.status !== "waiting_import") fail("stale: 应门闩");
  const staleImp = staleGate.parts.find((p) => p.kind === "import") as
    | { ready?: boolean; schemaIssues?: string[] }
    | undefined;
  if (staleImp?.schemaIssues?.length) fail("刚进门闩不得展示上次无效材料的 schema 红字");

  const sessionId = `step1-${randomUUID()}`;
  const gate = await startProductRun({ sessionId, skillId: SKILL_ID, query: QUERY });
  if (!gate.ok || gate.status !== "waiting_import") fail("gate 失败");
  const req = requirementsForSkill(SKILL_ID)[0]!;
  const parsed = parseCsvText(CSV, "别名表", req.slot);
  if ("error" in parsed) fail(parsed.error);
  saveServerDataset(sessionId, parsed);
  const cont = await continueProductRun(gate.processId, sessionId);
  if (!cont.ok) fail(`continue 失败: ${"error" in cont ? cont.error : ""}`);
  if (cont.status === "finish") {
    const steps = cont.parts.filter((p) => p.kind === "process");
    if (steps.length < 2) fail("continue 后应有 process 步骤");
  }
  console.log("OK  test-step1-import (ledger-desk)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
