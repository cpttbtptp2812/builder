/** OwnAgent Hub：预制问句对齐「能交付」的复杂处理能力（影像 / 表格 / 测算 / 合同 / 多轮流程） */

import { CREDIT_FLOW_DESK_IDS } from "./agentSkills";

/** Hub 对话区预制 — 5 大 Desk + 1 条行业多轮样板（勿堆 trace / 发版向入口） */
export const HUB_CHAT_PROMPTS: { label: string; text: string; hint?: string }[] = [
  {
    label: "凭证影像",
    text: "借款凭证影像识别，置信度低于 0.7 的字段不要",
    hint: "image-desk · 切块 · OCR · 字段取舍",
  },
  {
    label: "报销对账",
    text: "报销表按部门汇总，缺票直接拦截",
    hint: "ledger-desk · 引擎算数 · 模型写说明",
  },
  {
    label: "改表规则",
    text: "不含税入账，容差调到 500，缺票先警告",
    hint: "ledger-desk · 同一张表换配方 → 不同结论",
  },
  {
    label: "额度测算",
    text: "测算授信额度，近 6 个月月均流入 85 万",
    hint: "data-desk · 稳定系数 · 政策上限",
  },
  {
    label: "合同条款",
    text: "审查这份借款合同",
    hint: "contract-desk · 逐条对照 · 风险标",
  },
  {
    label: "合同办理",
    text: "合同审查",
    hint: "contract-flow-desk · 多轮文书 · 可改数",
  },
];

/** 多轮 Flow Desk 正式示范（其余信贷 flow-desk 为 optional 样板包） */
export const FEATURED_MULTI_TURN_SKILL_ID = "contract-flow-desk";

export const CREDIT_SAMPLE_FLOW_DESK_IDS = CREDIT_FLOW_DESK_IDS.filter(
  (id) => id !== FEATURED_MULTI_TURN_SKILL_ID,
);

export function isCreditSamplePackSkill(skillId: string): boolean {
  return (CREDIT_SAMPLE_FLOW_DESK_IDS as readonly string[]).includes(skillId);
}

export function isFeaturedMultiTurnSkill(skillId: string): boolean {
  return skillId === FEATURED_MULTI_TURN_SKILL_ID;
}

/** 对外说明用：Hub 上一点就能看到的「重能力」清单（非营销文案） */
export const HUB_CAPABILITY_BLURBS: { id: string; title: string; outcome: string }[] = [
  {
    id: "image-desk",
    title: "影像识表",
    outcome: "凭证切块 → 逐块 OCR → 按置信度决定字段采不采用，低置信印章等直接弃用并标问题",
  },
  {
    id: "ledger-desk",
    title: "智能报销对账",
    outcome: "认列与类型 → 按部门含税/去税汇总 → 容差对发票；引擎锁数后由已配置 LLM 写办结说明",
  },
  {
    id: "data-desk",
    title: "额度测算",
    outcome: "流水与稳定系数 → 公式与信用/行业/年限调整 → 政策上限裁剪，参数一改额度就变",
  },
  {
    id: "contract-desk",
    title: "合同审查",
    outcome: "抽金额期限利率 → 对照审批模板 → 条款高中低风险 → 要改的条款清单",
  },
  {
    id: "contract-flow-desk",
    title: "复杂办理",
    outcome: "多轮信贷办理：阶段条、检查点、文书可编辑、统一办理抽屉，适合长流程复杂场景",
  },
];

