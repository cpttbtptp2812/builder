/**
 * 每个办事技能：仅用「下载模板」正文 → 导入全部材料 → continue，必须能办结。
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
  "ticket-desk": "把这批工单分派一下",
  "shift-desk": "按员工表和班次需求排一下班",
};

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}

async function main() {
  const bySkill = new Map<string, ReturnType<typeof allDeskTemplateRequirements>>();
  for (const item of allDeskTemplateRequirements()) {
    bySkill.set(item.skillId, [...(bySkill.get(item.skillId) ?? []), item]);
  }
  for (const [skillId, reqs] of bySkill) {
    const sessionId = `tpl-rt-${skillId}-${randomUUID()}`;
    const gate = await startProductRun({ sessionId, skillId, query: QUERIES[skillId] ?? "试跑" });
    if (!gate.ok || gate.status !== "waiting_import") fail(`${skillId} 应门闩`);

    for (const { req } of reqs) {
      const parsed = parseCsvText(req.templateCsv, req.filename, req.slot);
      if ("error" in parsed) fail(`${skillId} 模板不可解析: ${parsed.error}`);
      saveServerDataset(sessionId, {
        slot: parsed.slot,
        title: req.filename.replace(/\.csv$/i, ""),
        columns: parsed.columns,
        rows: parsed.rows,
      });
    }

    const cont = await continueProductRun(gate.processId, sessionId);
    if (!cont.ok) fail(`${skillId} 模板导入后应能 continue: ${"error" in cont ? cont.error : ""}`);
    if (cont.status !== "finish") fail(`${skillId} 模板导入后应办结，得 ${cont.status}: ${cont.message.slice(0, 200)}`);
    console.log(`OK  template roundtrip  ${skillId}（${reqs.length} 份材料）`);
  }
  console.log("\nAll desk template roundtrips passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
