import { ledgerSourceCsvPatch } from "../src/lib/productPaperPatch.ts";
import type { WorkPaper } from "../src/lib/workPaper.ts";

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}

const paper: Extract<WorkPaper, { kind: "ledger" }> = {
  kind: "ledger",
  title: "测试",
  grid: {
    columns: ["部门", "申请人", "金额", "税额", "入账", "发票额", "差额", "对账", "升级队列"],
    rows: [
      ["市场", "经办D", "800", "104", "800", "750", "50", "拦截 差额 50", "—"],
      ["研发", "经办G", "1200", "156", "1200", "空", "—", "拦截 缺票", "—"],
    ],
  },
  recipe: {
    tax: "include",
    tolerance: 0,
    missing: "block",
    groupBy: "部门",
    escalation: { leadAt: 5000, directorAt: 10000, financeReviewAt: 8000 },
  },
  deptTotals: [],
  issues: [
    {
      level: "bad",
      title: "经办D · 拦截 差额 50",
      current: "金额 800，发票 750，差额 50",
      expected: "差额回到容差内",
    },
    {
      level: "bad",
      title: "经办G · 拦截 缺票",
      current: "金额 1200，发票 空，差额 —",
      expected: "补齐发票后再入账",
    },
  ],
};

const csv = ledgerSourceCsvPatch(paper);
if (!csv.includes("800,104,800")) fail("差额行应把发票改成 800");
if (!csv.includes("1200,156,1200")) fail("缺票行应把发票改成 1200");

const manual = ledgerSourceCsvPatch(paper, { 0: "800" });
if (!manual.includes("800,104,800")) fail("手改发票应写回");

console.log("OK  test-product-paper-patch");
