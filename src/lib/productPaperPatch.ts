/** 文书「一键修正」→ 写回用户数据槽 CSV，供 product-run rerun */

import { gridToCsv } from "./productDataStore";
import { requirementsForSkill } from "./productSkillInputs";
import type { ProductDataSlot } from "./productDataStore";
import type { WorkPaper } from "./workPaper";

export type LedgerInvoiceOverride = Record<number, string>;

export function primaryDataSlotForSkill(skillId: string): ProductDataSlot | null {
  const req = requirementsForSkill(skillId)[0];
  return req?.slot ?? null;
}

function stripMoney(s: string): string {
  return s.replace(/,/g, "").trim();
}

/** 对账明细 grid → 源 CSV（6 列导入格式） */
export function ledgerSourceCsvPatch(
  paper: Extract<WorkPaper, { kind: "ledger" }>,
  invoiceOverrides: LedgerInvoiceOverride = {},
): string {
  const cols = ["部门", "申请人", "金额", "税额", "发票额", "状态"];
  const badByPerson = new Map<string, { issue?: (typeof paper.issues)[0]; judge: string }>();
  for (const issue of paper.issues) {
    if (issue.level !== "bad") continue;
    const person = issue.title.split("·")[0]?.trim();
    if (person) badByPerson.set(person, { issue, judge: "" });
  }

  const rows = paper.grid.rows.map((row, index) => {
    const dept = row[0] ?? "";
    const person = row[1] ?? "";
    const amount = stripMoney(row[2] ?? "");
    const tax = stripMoney(row[3] ?? "");
    const judge = String(row[7] ?? "");
    let invoiceRaw = invoiceOverrides[index] ?? row[5] ?? "";
    if (invoiceRaw === "空" || invoiceRaw === "—") invoiceRaw = "";

    const meta = badByPerson.get(person);
    const blocked =
      meta ||
      judge.includes("拦截") ||
      (invoiceOverrides[index] != null && invoiceOverrides[index] !== "");

    if (blocked) {
      const manual = invoiceOverrides[index]?.trim();
      if (manual) {
        invoiceRaw = stripMoney(manual);
      } else if (meta?.issue) {
        const cur = meta.issue.current;
        if (cur.includes("发票 空") || cur.includes("缺票") || !invoiceRaw) {
          invoiceRaw = amount;
        } else if (cur.includes("差额") || judge.includes("差额")) {
          invoiceRaw = amount;
        }
      } else if (judge.includes("差额") || judge.includes("缺票") || !invoiceRaw) {
        invoiceRaw = amount;
      }
    }

    return [dept, person, amount, tax, invoiceRaw, "待审"];
  });

  return gridToCsv(cols, rows);
}

/** 合同条款：按 issue 把合同原文向「应为」靠拢（简化：金额类 issue 改合同列） */
export function contractClausesCsvPatch(paper: Extract<WorkPaper, { kind: "contract" }>): string | null {
  if (!paper.issues.length) return null;
  const cols = ["条款号", "名称", "合同原文", "审批模板", "类型"];
  const rows: string[][] = paper.issues.map((issue, i) => {
    const title = issue.title;
    const current = issue.current;
    const expected = issue.expected.replace(/^应为[：:]\s*/, "");
    return [String(i + 1), title, expected || current, expected, "amount"];
  });
  if (!rows.length) return null;
  return gridToCsv(cols, rows);
}

export function csvPatchForPaperRerun(
  paper: WorkPaper,
  skillId: string,
  opts?: { invoiceOverrides?: LedgerInvoiceOverride },
): { slot: ProductDataSlot; csv: string } | null {
  const slot = primaryDataSlotForSkill(skillId);
  if (!slot) return null;
  if (paper.kind === "ledger" && slot === "expense-ledger") {
    return { slot, csv: ledgerSourceCsvPatch(paper, opts?.invoiceOverrides ?? {}) };
  }
  if (paper.kind === "contract" && slot === "contract-clauses") {
    const csv = contractClausesCsvPatch(paper);
    return csv ? { slot, csv } : null;
  }
  return null;
}
