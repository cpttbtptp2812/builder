/** 客服工单分派与时效质检：材料列、模板、步骤名（纯声明，引擎见 ticketDeskProgram.ts） */

import type { ColumnSpec } from "./materialColumns";
import type { DeskMeta } from "./deskProgramMeta";

export const TICKET_DESK_ID = "ticket-desk";

export const TICKET_COLUMNS: ColumnSpec[] = [
  { canon: "工单号", required: true, patterns: [/^工单(编号|号|id)?$/i, /单号/, /^ticket/i, /^编号$/, /^id$/i], hint: "未能识别「工单号」列（可叫：工单编号、单号、ticket id）" },
  { canon: "客户", required: true, patterns: [/^客户(名称|姓名|名|账号|编号|id)?$/i, /^用户(名|账号|id)?$/i, /^会员(账号|号|id)?$/i, /^customer/i], hint: "未能识别「客户」列（可叫：客户名称、用户账号）" },
  { canon: "创建时间", required: true, patterns: [/创建|提交时间|报单时间|进线时间|受理时间|^时间$|created|open(ed)?.?at/i], hint: "未能识别「创建时间」列（可叫：提交时间、进线时间）" },
  { canon: "首次响应时间", patterns: [/首次响应|首响|首次回复|首回|first.?resp/i] },
  { canon: "解决时间", patterns: [/解决时间|关闭时间|完结时间|结单时间|resolved|closed.?at/i] },
  { canon: "渠道", patterns: [/渠道|来源|进线方式|channel|source/i] },
  { canon: "客户等级", patterns: [/等级|级别|会员类型|客户类型|vip|tier|level/i] },
  { canon: "标题", patterns: [/标题|主题|摘要|subject|title/i] },
  { canon: "内容", patterns: [/内容|描述|详情|问题说明|description|content|body/i] },
  { canon: "状态", patterns: [/状态|status/i] },
  { canon: "处理人", patterns: [/处理人|受理人|负责人|跟进人|assignee|owner/i] },
];

export const AGENT_COLUMNS: ColumnSpec[] = [
  { canon: "坐席", required: true, patterns: [/坐席(名|姓名|名称)?$/, /^姓名$/, /^客服(名|姓名|人员|名称)?$/, /^员工(姓名)?$/, /^agent/i], hint: "未能识别「坐席」列（可叫：客服、姓名）" },
  { canon: "技能组", required: true, patterns: [/技能组|技能|组别|班组|队列|^组$|group|queue|skill/i], hint: "未能识别「技能组」列（可叫：组别、队列，多个组用 | 分隔）" },
  { canon: "在岗", patterns: [/在岗|在线|上班|当班|在职状态|^状态$|on.?duty|online/i] },
  { canon: "当前待办", patterns: [/待办|在手|未结|当前工单|backlog|open/i] },
  { canon: "上限", patterns: [/上限|容量|最大|最多|capacity|cap|max/i] },
];

export const TICKET_TEMPLATE = [
  "工单号,客户,创建时间,首次响应时间,解决时间,渠道,客户等级,标题,内容,状态",
  "T0001,客户编号001,2026-10-12 09:05,2026-10-12 09:20,,在线,普通,退款还没到账,上周申请的退款至今未到账,处理中",
  "T0002,客户编号002,2026-10-12 10:40,,,电话,VIP,无法登录,改密码后一直提示账号锁定,待处理",
  "T0003,客户编号003,2026-10-12 14:10,2026-10-12 14:30,2026-10-12 16:00,邮件,普通,发票抬头开错,需要重开发票,已解决",
].join("\n");

export const AGENT_TEMPLATE = [
  "坐席,技能组,在岗,当前待办,上限",
  "坐席01,账务组|综合组,是,3,8",
  "坐席02,账号组|技术组,是,2,8",
  "坐席03,物流组,否,0,8",
].join("\n");

function rejectNotTickets(headers: string[]): string | null {
  if (!headers.some((h) => /标题|主题|摘要|内容|描述|详情|问题|subject|title|description|content/i.test(h))) {
    return "表里没有「标题」或「内容」类列，无法判断工单问题类型。请导入含工单标题或问题描述的工单导出表。";
  }
  if (headers.some((h) => /^(班次|岗位技能)$/.test(h))) {
    return "表结构像排班材料，不是工单表。";
  }
  return null;
}

export const TICKET_DESK_META: DeskMeta = {
  skillId: TICKET_DESK_ID,
  label: "客服工单分派与时效质检",
  guardCode: "TICKET_GUARD",
  domainWords: /工单|坐席|客服|派单|分派|首响|时效质检|SLA/i,
  requirements: [
    {
      slot: "service-tickets",
      label: "工单表",
      hint: "从客服系统导出的工单明细，至少要有工单号、客户、创建时间、标题或内容；有首次响应/解决时间才能算时效。",
      templateCsv: TICKET_TEMPLATE,
      filename: "工单表-导入模板.csv",
    },
    {
      slot: "service-agents",
      label: "坐席表",
      hint: "当班坐席名单：坐席、技能组、是否在岗、手上待办数、接单上限；一人会多个组时用 | 隔开。",
      templateCsv: AGENT_TEMPLATE,
      filename: "坐席表-导入模板.csv",
    },
  ],
  columns: {
    "service-tickets": { specs: TICKET_COLUMNS, emptyMessage: "没有有效工单行，请至少填写一张工单", reject: rejectNotTickets },
    "service-agents": { specs: AGENT_COLUMNS, emptyMessage: "没有有效坐席行，请至少填写一名坐席" },
  },
  tools: [
    { name: "__ticket_intake__", label: "读入工单" },
    { name: "__ticket_agents__", label: "读入坐席" },
    { name: "__ticket_validate__", label: "检查工单数据" },
    { name: "__ticket_calendar__", label: "设定工作日历" },
    { name: "__ticket_classify__", label: "问题分类" },
    { name: "__ticket_priority__", label: "定优先级" },
    { name: "__ticket_dedupe__", label: "合并重复工单" },
    { name: "__ticket_sla__", label: "计算时效" },
    { name: "__ticket_risk__", label: "预警临期" },
    { name: "__ticket_assign__", label: "分派坐席" },
    { name: "__ticket_escalate__", label: "升级处理" },
    { name: "__ticket_quality__", label: "时效质检" },
    { name: "__ticket_capacity_guard__", label: "分派保底检查" },
    { name: "__ticket_deliver_detail__", label: "出工单处理明细" },
    { name: "__ticket_deliver_assign__", label: "出分派表" },
    { name: "__ticket_deliver_escalation__", label: "出升级清单" },
    { name: "__ticket_deliver_quality__", label: "出时效达标统计" },
    { name: "__ticket_deliver_merge__", label: "出重复合并表" },
    { name: "__ticket_report__", label: "汇总结论" },
  ],
};
