/** Excel 导入后走真实办事，步骤事件里带权限和超时，单元格能按原位置找回。 */
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";

process.env.DATABASE_PATH = path.join(os.tmpdir(), `ownagent-xlsx-run-${randomUUID()}.sqlite`);

const { saveDatasetCells } = await import("../server/productDataStore.ts");
const { continueProductRun, saveServerDataset, startProductRun } = await import("../server/productRun.ts");
const { listEvents, listRuns } = await import("../server/runEventStore.ts");
const { xlsxBufferToTable } = await import("../src/lib/workbookImport.ts");

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}

const book = new ExcelJS.Workbook();
const sheet = book.addWorksheet("十月");
sheet.addRow(["部门", "申请人", "金额", "税额", "发票额", "状态", "费用类型"]);
sheet.addRow(["研发", "经办甲", 1739, 226, 1739, "待审", "差旅"]);
const table = await xlsxBufferToTable(new Uint8Array(await book.xlsx.writeBuffer()), "十月实表.xlsx");
if ("error" in table) fail(table.error);

const sessionId = `xlsx-${randomUUID()}`;
saveServerDataset(sessionId, {
  slot: "expense-ledger",
  title: table.title,
  columns: table.csv.split("\n")[0]!.split(","),
  rows: table.csv.split("\n").slice(1).filter(Boolean).map((line) => line.split(",")),
});
saveDatasetCells(sessionId, "expense-ledger", table.cells);
const cells = (await import("../server/productDataStore.ts")).listDatasetCells(sessionId, "expense-ledger");
const hit = cells.find((cell) => cell.value === "1739");
if (!hit || hit.cell !== "C2" || hit.sheet !== "十月") fail(`1739 应在十月!C2，得到 ${hit?.sheet} ${hit?.cell}`);

const started = await startProductRun({ sessionId, skillId: "ledger-desk", query: "核对这张表" });
if (!started.ok || started.status !== "waiting_import") fail(`导入后新开仍应先停在门闩，得到 ${started.ok ? started.status : started.error}`);
const fin = await continueProductRun(started.processId, sessionId);
if (!fin.ok || fin.status !== "finish") fail(`办理没有完成：${fin.ok ? fin.status : fin.error}`);
if (!/1739/.test(JSON.stringify(fin))) fail("办结里没有这次 Excel 的金额");

const run = listRuns([sessionId])[0];
if (!run) fail("没有留下这次办理的运行记录");
const events = listEvents(run.runId);
const done = events.filter((event) => event.type === "node.completed");
if (!done.length) fail("没有步骤完成事件");
const withGate = done.filter((event) => {
  const gateway = (event.payload as { gateway?: { capability?: string; timeoutMs?: number; allowed?: boolean } }).gateway;
  return gateway?.allowed === true && gateway.capability && (gateway.timeoutMs ?? 0) > 0;
});
if (withGate.length !== done.length) fail(`完成的步骤应都记下权限和超时，${withGate.length}/${done.length}`);
console.log(`ok workbook-run steps=${done.length} cell=${hit.cell}`);
