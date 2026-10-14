/** 「只看某部门」必须只用该部门的行算合计；对不上就停下，不能退回整张表。 */
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(os.tmpdir(), `ownagent-dept-${randomUUID()}.sqlite`);

const { saveServerDataset } = await import("../server/productRun.ts");
const { buildSheetProgramState, sheetProgramRecipeFromArgs } = await import("../src/lib/sheetDeskProgram.ts");

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}
function expect(cond: unknown, msg: string): void {
  if (!cond) fail(msg);
}

const sessionId = `dept-${randomUUID()}`;
saveServerDataset(sessionId, {
  slot: "expense-ledger",
  title: "部门筛选",
  columns: ["部门", "申请人", "金额", "税额", "发票额", "状态", "费用类型"],
  rows: [
    ["研发", "经办甲", "1500", "195", "1500", "待审", "差旅"],
    ["财务", "经办乙", "320", "42", "320", "已审", "培训"],
    ["市场", "经办丙", "2400", "312", "2400", "待审", "活动"],
  ],
});

const recipe = sheetProgramRecipeFromArgs({ tax: "include", tolerance: 0, missing: "block", groupBy: "部门" });
const opts = { productWorkbench: true as const, sessionId, dataSlot: "expense-ledger" as const };

const finance = buildSheetProgramState("只看财务部门报销对账结果", recipe, opts);
expect(finance.schemaOk, finance.summary);
expect(finance.table.rows.length === 1, `只看财务应剩 1 行，得到 ${finance.table.rows.length}`);
expect(finance.summary.includes("只看财务") && finance.summary.includes("320") && finance.summary.includes("1 行"), finance.summary);
expect(finance.detailGrid.rows.every((row) => row[0] === "财务"), "明细里还混着别的部门");

const all = buildSheetProgramState("核对这张报销表", recipe, opts);
expect(all.table.rows.length === 3 && all.summary.includes("4220"), `没说只看时应是整张表 4220，得到 ${all.summary}`);

const missing = buildSheetProgramState("只看人事部门报销对账结果", recipe, opts);
expect(!missing.schemaOk && missing.summary.includes("没有「人事」") && missing.summary.includes("研发"), missing.summary);
expect(missing.table.rows.length === 3, "对不上部门时不应改掉原表行数再假装算完");
console.log("ok sheet-dept-scope");
