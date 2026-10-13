/** 客户运行面仅列已经接入 product-run、可用真实材料办结的技能。 */
export const HUB_CHAT_PROMPTS: { label: string; text: string; hint?: string }[] = [
  {
    label: "报销对账",
    text: "报销表按部门汇总，缺票直接拦截",
    hint: "导入报销明细后汇总、对票并出表",
  },
  {
    label: "客服工单",
    text: "把这批工单分派一下，看看哪些快超时了",
    hint: "导入工单与坐席表后分派、质检并出表",
  },
  {
    label: "门店排班",
    text: "按员工表和班次需求排一下下周的班",
    hint: "导入员工与班次需求后排班、查缺口并算成本",
  },
];

/** 对外说明用：当前正式开放的能力。 */
export const HUB_CAPABILITY_BLURBS: { id: string; title: string; outcome: string }[] = [
  {
    id: "ledger-desk",
    title: "智能报销对账",
    outcome: "认列与类型 → 按部门含税/去税汇总 → 容差对发票；引擎锁数后由已配置 LLM 写办结说明",
  },
  {
    id: "ticket-desk",
    title: "客服工单分派与时效质检",
    outcome: "关键词分类 → 定优先级 → 合并重复单 → 按工作日历算首响/解决时效 → 按负载派坐席 → 升级与达标统计",
  },
  {
    id: "shift-desk",
    title: "门店排班",
    outcome: "按技能/可上班时间/请假筛人 → 最难排的班先排 → 调换补缺 → 复核休息/工时/连续天数 → 工时与人工成本",
  },
];

