/** 文书「一键修正」→ 写回用户数据槽 CSV，供 product-run rerun */

import { gridToCsv } from "./productDataStore";
import { requirementsForSkill } from "./productSkillInputs";
import type { ProductDataSlot } from "./productDataStore";
import type { WorkPaper } from "./workPaper";

export function primaryDataSlotForSkill(skillId: string): ProductDataSlot | null {
  const req = requirementsForSkill(skillId)[0];
  return req?.slot ?? null;
}

/** 对账明细：按 issue 补发票额（源表 6 列，与导入模板一致） */
export function ledgerSourceCsvPatch(paper: Extract<WorkPaper, { kind: "ledger" }>): string {
  const cols = ["部门", "申请人", "金额", "税额", "发票额", "状态"];
  const badPeople = new Set<string>();
  for (const issue of paper.issues) {
    if (issue.level !== "bad") continue;
    const person = issue.title.split("·")[0]?.trim();
    if (person) badPeople.add(person);
  }

  const rows = paper.grid.rows.map((row) => {
    const dept = row[0] ?? "";
    const person = row[1] ?? "";
    const amount = row[2] ?? "";
    const tax = row[3] ?? "";
    let invoice = row[5] ?? "";
    let status = "待审";
    if (badPeople.has(person) && (!invoice || invoice === "空")) {
      invoice = amount;
      status = "待审";
    } else if (invoice && invoice !== "空") {
      status = "待审";
    }
    return [dept, person, amount, tax, invoice === "空" ? "" : invoice, status];
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
): { slot: ProductDataSlot; csv: string } | null {
  const slot = primaryDataSlotForSkill(skillId);
  if (!slot) return null;
  if (paper.kind === "ledger" && slot === "expense-ledger") {
    return { slot, csv: ledgerSourceCsvPatch(paper) };
  }
  if (paper.kind === "contract" && slot === "contract-clauses") {
    const csv = contractClausesCsvPatch(paper);
    return csv ? { slot, csv } : null;
  }
  return null;
}
