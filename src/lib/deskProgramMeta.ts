/**
 * 办事程序注册表（声明部分）：新增一种业务技能只在这里登记一次，
 * 材料槽、列名识别、下载模板、工具注册、步骤名、客户技能列表都从这里取。
 * 引擎实现见 deskPrograms.ts（这里不能 import 引擎，避免循环依赖）。
 */

import type { ColumnSpec } from "./materialColumns";
import type { ProductDataSlot } from "./productDataStore";
import type { SkillDataRequirement } from "./productSkillInputs";
import { TICKET_DESK_META } from "./ticketDeskMeta";
import { SHIFT_DESK_META } from "./shiftDeskMeta";

export type DeskSlotColumns = {
  specs: ColumnSpec[];
  emptyMessage: string;
  reject?: (headers: string[]) => string | null;
};

export type DeskMeta = {
  skillId: string;
  label: string;
  guardCode: string;
  /** 本业务独有的说法；命中时不让「汇总/拦截」之类通用词把问句判给报销对账 */
  domainWords: RegExp;
  requirements: SkillDataRequirement[];
  columns: Partial<Record<ProductDataSlot, DeskSlotColumns>>;
  tools: { name: string; label: string }[];
};

export const DESK_METAS: DeskMeta[] = [TICKET_DESK_META, SHIFT_DESK_META];

export function deskMetaFor(skillId: string): DeskMeta | undefined {
  return DESK_METAS.find((m) => m.skillId === skillId);
}

export function deskColumnsForSlot(slot: ProductDataSlot): DeskSlotColumns | undefined {
  for (const meta of DESK_METAS) {
    const hit = meta.columns[slot];
    if (hit) return hit;
  }
  return undefined;
}

export function deskToolLabel(tool: string): string | undefined {
  for (const meta of DESK_METAS) {
    const hit = meta.tools.find((t) => t.name === tool);
    if (hit) return hit.label;
  }
  return undefined;
}

export function matchesOtherDeskDomain(query: string): boolean {
  return DESK_METAS.some((m) => m.domainWords.test(query));
}

export function isDeskGuardCode(code: string | undefined): boolean {
  return !!code && DESK_METAS.some((m) => m.guardCode === code);
}
