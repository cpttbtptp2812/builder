/**
 * ledger-desk：仅用「下载模板」正文 → 导入 → continue，必须能跑通。
 */
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(os.tmpdir(), `ownagent-tpl-rt-${randomUUID()}.sqlite`);

import { parseCsvText } from "../src/lib/productDataStore.ts";
import { allDeskTemplateRequirements } from "../src/lib/productSkillInputs.ts";
import { continueProductRun, saveServerDataset, startProductRun } from "../server/productRun.ts";

const QUERIES: Record<string, string> = {
  "ledger-desk": "按部门汇总报销表",
};

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}

async function main() {
  for (const { skillId, req } of allDeskTemplateRequirements()) {
    const parsed = parseCsvText(req.templateCsv, req.filename, req.slot);
    if ("error" in parsed) fail(`${skillId} 模板不可解析: ${parsed.error}`);

    const sessionId = `tpl-rt-${skillId}-${randomUUID()}`;
    const gate = await startProductRun({ sessionId, skillId, query: QUERIES[skillId] ?? "试跑" });
    if (!gate.ok || gate.status !== "waiting_import") fail(`${skillId} 应门闩`);

    saveServerDataset(sessionId, {
      slot: parsed.slot,
      title: req.filename.replace(/\.csv$/i, ""),
      columns: parsed.columns,
      rows: parsed.rows,
    });

    const cont = await continueProductRun(gate.processId, sessionId);
    if (!cont.ok) fail(`${skillId} 模板导入后应能 continue: ${"error" in cont ? cont.error : ""}`);
    console.log(`OK  template roundtrip  ${skillId}`);
  }
  console.log("\nAll desk template roundtrips passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
