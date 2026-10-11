/**
 * 材料解析：别名表头、非模板列名、流水误导入报销槽等。
 */
import { requirementsForSkill } from "../src/lib/productSkillInputs.ts";
import {
  decodeUploadCsvText,
  parseCsvText,
  parseCsvUploadBuffer,
} from "../src/lib/productDataStore.ts";
import { normalizeMaterialDataset } from "../src/lib/materialNormalize.ts";

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}

function main() {
  const aliasExpense = parseCsvText(
    `所属部门,报销人,报销金额,税金,发票金额,当前状态
研发,员工A,1001,130,1001,待审
研发,员工B,2002,260,2002,待审`,
    "公司导出",
    "expense-ledger",
  );
  if ("error" in aliasExpense) fail(`别名报销表应解析成功: ${aliasExpense.error}`);
  if (!aliasExpense.rows[0]?.[2]?.includes("1001")) fail("金额列应保留用户数字 1001");

  const norm = normalizeMaterialDataset({
    slot: "expense-ledger",
    title: "t",
    columns: ["月份", "流入万元"],
    rows: [
      ["2025-01", "1"],
      ["2025-02", "2"],
    ],
    updatedAt: "",
  });
  if (norm.ok) fail("流水表导入报销槽应拒绝并提示改办额度");

  const cash = parseCsvText(
    `期间,本行流入
2025-01,88
2025-02,91
2025-03,90`,
    "流水",
    "cashflow-monthly",
  );
  if ("error" in cash) fail(`别名流水应解析: ${cash.error}`);
  if (cash.columns[0] !== "月份" || cash.columns[1] !== "流入万元") fail("流水应规范到标准列名");

  const changed = parseCsvText(
    `部门,申请人,金额,税额,发票额,状态
部1,甲,50001,6500,50001,待审`,
    "a",
    "expense-ledger",
  );
  const changed2 = parseCsvText(
    `部门,申请人,金额,税额,发票额,状态
部1,甲,50002,6500,50002,待审`,
    "b",
    "expense-ledger",
  );
  if ("error" in changed || "error" in changed2) fail("标准表应可解析");
  if (JSON.stringify(changed.rows) === JSON.stringify(changed2.rows)) fail("改金额后解析结果必须不同");

  const tpl = requirementsForSkill("sheet-desk")[0]!.templateCsv.replace("研发,经办A,1500,", "研发,经办A,1400,");
  const edited = parseCsvText(tpl, "报销明细-导入模板.csv", "expense-ledger");
  if ("error" in edited) fail(`模板只改金额 1500→1400 应可导入: ${edited.error}`);
  if (!edited.rows.some((r) => r[2] === "1400")) fail("改后金额 1400 应出现在解析结果");

  const quotedOneCol = `"部门,申请人,金额,税额,发票额,状态,费用类型"\n"研发,经办A,1400,195,1400,待审,差旅"\n`;
  const unwrapped = parseCsvText(quotedOneCol, "excel-one-col", "expense-ledger");
  if ("error" in unwrapped) fail(`Excel 单列引号 CSV 应可展开: ${unwrapped.error}`);

  const utf8Line = `部门,申请人,金额,税额,发票额,状态\n研发,经办A,1400,195,1400,待审\n`;
  const utf8Buf = new TextEncoder().encode(utf8Line);
  if (!/1400/.test(decodeUploadCsvText(utf8Buf.buffer))) fail("UTF-8 解码应保留 1400");
  const fromBuf = parseCsvUploadBuffer(utf8Buf.buffer, "buf", "expense-ledger");
  if ("error" in fromBuf) fail(`ArrayBuffer 导入应成功: ${fromBuf.error}`);

  console.log("OK  material alias normalize + wrong-shape guard + numeric fidelity");
  console.log("\nAll material normalize checks passed.");
}

main();
