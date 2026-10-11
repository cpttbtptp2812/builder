/** Trace 门闩态：取材料有证据、写答复 pending → 非 4/4 完成撒谎 */
import {
  applyProductRunGateJournal,
  applyProductRunProcessJournal,
  createFlowJournal,
  flowJournalStats,
  isProductGateJournal,
} from "../src/lib/turnFlowJournal.ts";

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}

const journal = createFlowJournal("按部门汇总报销");
const gated = applyProductRunGateJournal(journal, [
  { label: "报销明细表", ready: true, materialTitle: "我的报销", rowCount: 3, slot: "expense-ledger" },
]);

if (!isProductGateJournal(gated)) fail("应识别为 product gate journal");
const stats = flowJournalStats(gated);
if (stats.doneSteps !== 3) fail(`门闩态 doneSteps 应为 3，得 ${stats.doneSteps}`);
if (stats.evidenceCount < 1) fail("取材料应有证据");
const fetch = gated.find((n) => n.id === "fetch");
if (!fetch?.evidence.some((e) => /我的报销/.test(e.excerpt ?? ""))) fail("取材料应含材料名");

console.log("OK  trace gate journal 3/4 + fetch evidence");

const proc = applyProductRunProcessJournal(
  createFlowJournal("汇总报销"),
  [{ label: "读表", detail: "共 2 行", ok: true }],
  "含税合计 2300",
  "finish",
);
const fetchEv = proc.find((n) => n.id === "fetch")?.evidence ?? [];
if (!fetchEv.some((e) => /读表/.test(e.title))) fail("process 应收进 fetch evidence");
if (proc.find((n) => n.id === "write")?.status !== "done") fail("finish 应写答复 done");

console.log("OK  trace process journal fetch + write");
console.log("\nTrace gate journal check passed.");
