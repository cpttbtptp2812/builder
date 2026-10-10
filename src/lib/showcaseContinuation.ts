/** Hub 展示技能：追问应留在同一业务流（对账/改数/重算），不要掉进制度 FAQ。 */

import { isCustomerSkill } from "./agentSkills";

export function isSheetOperationQuery(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (/制度|手册|规定是什么|可以吗\?*$|能不能报销$|需要什么材料$/.test(q) && !/对账|汇总|补齐|容差/.test(q)) {
    return false;
  }
  return (
    /对账|发票额|按\d+|补齐|容差|不含税|含税入账|汇总|差额|重算|再对|入账|拦截|明细表|报销表/.test(q) ||
    (/报销/.test(q) && /发票|汇总|部门|金额|赵琪|李明|王旭|周宁|陈可/.test(q))
  );
}

export function isSheetContinuationQuery(query: string): boolean {
  return isSheetOperationQuery(query);
}

export function isContinuationForSkill(query: string, skillId: string): boolean {
  const q = query.trim();
  if (!q) return false;
  switch (skillId) {
    case "sheet-desk":
      return isSheetContinuationQuery(q);
    case "contract-desk":
      return /改|修正|对齐|按审批|利率|期限|金额|还款|合同/.test(q);
    case "data-desk":
      return /系数|流水|上限|重算|额度|调整|测算|占用/.test(q);
    case "flow-desk":
      return /走到|流程|哪一步|推进|卡在哪|审批/.test(q);
    case "image-desk":
      return /凭证|影像|识别|字段|OCR/.test(q);
    default:
      return false;
  }
}

type MsgLike = { role: string; route?: { skillId?: string } | null; workPaper?: { kind?: string } | null };

/** 从线程推断本轮应钉住的展示技能 */
export function resolveShowcasePin(messages: MsgLike[], query: string): string | undefined {
  if (isSheetOperationQuery(query)) return "sheet-desk";

  const last = [...messages]
    .reverse()
    .find(
      (m) =>
        m.role === "assistant" &&
        m.route?.skillId &&
        isCustomerSkill(m.route.skillId) &&
        isContinuationForSkill(query, m.route.skillId),
    );
  if (last?.route?.skillId) return last.route.skillId;

  const lastPaper = [...messages].reverse().find((m) => m.role === "assistant" && m.workPaper?.kind);
  if (lastPaper?.workPaper?.kind === "ledger" && isSheetContinuationQuery(query)) return "sheet-desk";
  if (lastPaper?.workPaper?.kind === "contract" && isContinuationForSkill(query, "contract-desk")) return "contract-desk";
  if (lastPaper?.workPaper?.kind === "credit" && isContinuationForSkill(query, "data-desk")) return "data-desk";
  if (lastPaper?.workPaper?.kind === "flow" && isContinuationForSkill(query, "flow-desk")) return "flow-desk";

  return undefined;
}
