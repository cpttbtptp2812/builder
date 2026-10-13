/** 门店排班：材料列、模板、步骤名（纯声明，引擎见 shiftDeskProgram.ts） */

import type { ColumnSpec } from "./materialColumns";
import type { DeskMeta } from "./deskProgramMeta";

export const SHIFT_DESK_ID = "shift-desk";

export const STAFF_COLUMNS: ColumnSpec[] = [
  { canon: "员工", required: true, patterns: [/^员工(姓名|名|名称)?$/, /^姓名$/, /^店员(姓名)?$/, /^人员$/, /^name$/i], hint: "未能识别「员工」列（可叫：姓名、店员）" },
  { canon: "岗位技能", required: true, patterns: [/岗位技能|技能|可做岗位|会做|岗位|skill|role/i], hint: "未能识别「岗位技能」列（多个岗位用 | 分隔）" },
  { canon: "用工类型", patterns: [/用工|合同类型|雇佣|全兼职|^类型$|employment|type/i] },
  { canon: "周工时上限", patterns: [/周工时|工时上限|每周.*(小时|工时)|max.?hours|weekly/i] },
  { canon: "可上班星期", patterns: [/可上班|可排班?|星期|周几|工作日|出勤日|available.?days/i] },
  { canon: "最早", patterns: [/最早|开始可|可上班时间起|earliest/i] },
  { canon: "最晚", patterns: [/最晚|结束可|可上班时间止|latest/i] },
  { canon: "时薪", patterns: [/时薪|小时工资|每小时|单价|rate|wage/i] },
  { canon: "不可用日期", patterns: [/不可用|请假|休假|不能上|例休|unavailable|leave/i] },
];

export const DEMAND_COLUMNS: ColumnSpec[] = [
  { canon: "日期", required: true, patterns: [/日期|^日$|date|day/i], hint: "未能识别「日期」列" },
  { canon: "班次", patterns: [/班次|班别|班名|shift/i] },
  { canon: "开始", required: true, patterns: [/开始|上班时间|起始|^起$|start|from/i], hint: "未能识别「开始」时间列（如 07:00）" },
  { canon: "结束", required: true, patterns: [/结束|下班时间|截止|^止$|end|^to$/i], hint: "未能识别「结束」时间列（如 15:00）" },
  { canon: "岗位", required: true, patterns: [/岗位|技能|职位|工种|role|position/i], hint: "未能识别「岗位」列" },
  { canon: "人数", required: true, patterns: [/人数|需求|需要|数量|headcount|count|num|qty/i], hint: "未能识别「人数」列" },
];

export const STAFF_TEMPLATE = [
  "员工,岗位技能,用工类型,周工时上限,可上班星期,最早,最晚,时薪,不可用日期",
  "店员01,收银|理货|值班长,全职,40,周一至周五,07:00,22:00,26,",
  "店员02,收银,兼职,24,周六|周日,09:00,21:00,22,",
  "店员03,理货|咖啡,全职,40,周二至周六,07:00,22:00,27,2026-10-21",
].join("\n");

export const DEMAND_TEMPLATE = [
  "日期,班次,开始,结束,岗位,人数",
  "2026-10-19,早班,07:00,15:00,收银,1",
  "2026-10-19,晚班,14:00,22:00,收银,1",
  "2026-10-20,早班,07:00,15:00,理货,1",
  "2026-10-24,午高峰,11:00,15:00,收银,1",
].join("\n");

export const SHIFT_DESK_META: DeskMeta = {
  skillId: SHIFT_DESK_ID,
  label: "门店排班",
  guardCode: "SHIFT_GUARD",
  domainWords: /排班|班次|班表|门店|店员|轮班|值班表|工时上限/,
  requirements: [
    {
      slot: "staff-roster",
      label: "员工表",
      hint: "每人一行：员工、岗位技能、用工类型、周工时上限、可上班星期、最早/最晚、时薪、请假日期；会多个岗位时用 | 隔开。",
      templateCsv: STAFF_TEMPLATE,
      filename: "员工表-导入模板.csv",
    },
    {
      slot: "shift-demand",
      label: "班次需求表",
      hint: "要排的班：日期、班次、开始、结束、岗位、人数；跨夜班的结束直接写次日时间，例如 22:00 到 06:00。",
      templateCsv: DEMAND_TEMPLATE,
      filename: "班次需求-导入模板.csv",
    },
  ],
  columns: {
    "staff-roster": {
      specs: STAFF_COLUMNS,
      emptyMessage: "没有有效员工行，请至少填写一名员工",
      reject: (headers) => (headers.some((h) => /^(人数|需求人数|班次)$/.test(h)) ? "表结构像班次需求，不是员工表。" : null),
    },
    "shift-demand": {
      specs: DEMAND_COLUMNS,
      emptyMessage: "没有有效班次行，请至少填写一个班次",
      reject: (headers) => (headers.some((h) => /^(时薪|周工时上限|岗位技能)$/.test(h)) ? "表结构像员工表，不是班次需求。" : null),
    },
  },
  tools: [
    { name: "__shift_staff__", label: "读入员工" },
    { name: "__shift_demand__", label: "读入班次需求" },
    { name: "__shift_roles__", label: "统一岗位名" },
    { name: "__shift_validate__", label: "检查排班数据" },
    { name: "__shift_rules__", label: "设定用工规则" },
    { name: "__shift_eligibility__", label: "筛可上人选" },
    { name: "__shift_assign__", label: "初排" },
    { name: "__shift_repair__", label: "调换补缺" },
    { name: "__shift_verify__", label: "复核规则" },
    { name: "__shift_hours__", label: "核算工时与成本" },
    { name: "__shift_gaps__", label: "分析缺口" },
    { name: "__shift_coverage_guard__", label: "覆盖率检查" },
    { name: "__shift_keyholder__", label: "开闭店检查" },
    { name: "__shift_fairness__", label: "均衡检查" },
    { name: "__shift_deliver_roster__", label: "出排班表" },
    { name: "__shift_deliver_person__", label: "出个人工时表" },
    { name: "__shift_deliver_gaps__", label: "出缺口清单" },
    { name: "__shift_deliver_matrix__", label: "出人员日历" },
    { name: "__shift_report__", label: "汇总结论" },
  ],
};
