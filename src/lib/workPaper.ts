/** 信贷那种文书和测算页：合同正文、问题卡、左右条目、公式块。 */

import type { AgentSkill } from "./agentSkills";
import { executeContract, contractPolicyFromSteps } from "./contractEngine";
import { executeData, dataRecipeFromSteps } from "./dataEngine";
import { executeFlow, flowPolicyFromSteps } from "./flowEngine";
import { executeImage, imagePolicyFromSteps } from "./imageEngine";
import {
  executeSheet,
  sheetRecipeFromQuery,
  sheetRecipeFromSteps,
  type SheetRecipe,
  type WorkGrid,
} from "./sheetEngine";
import { CREDIT_FLOWS } from "./creditFlowCatalog";

export type PaperTone = "bad" | "warn" | "hint" | "ok";

export type PaperIssue = {
  level: PaperTone;
  title: string;
  current: string;
  expected: string;
};

export type WorkPaper =
  | {
      kind: "contract";
      title: string;
      no: string;
      lender: string;
      borrower: string;
      amount: { value: string; expected: string; fill: string; tone: PaperTone };
      term: { value: string; expected: string; fill: string; tone: PaperTone };
      rate: { value: string; expected: string; fill: string; tone: PaperTone };
      repay: { value: string; expected: string; fill: string; tone: PaperTone };
      issues: PaperIssue[];
      voucher: { label: string; value: string }[];
      plan: { label: string; value: string }[];
    }
  | {
      kind: "credit";
      title: string;
      no: string;
      verdict: string;
      note: string;
      metrics: { label: string; value: string }[];
      formulas: { name: string; formula: string; expr: string }[];
      rows: { label: string; value: string; ok?: boolean }[];
    }
  | {
      kind: "ledger";
      title: string;
      grid: WorkGrid;
      recipe: SheetRecipe;
      deptTotals: { dept: string; amount: string }[];
      issues: PaperIssue[];
    }
  | {
      kind: "flow";
      title: string;
      halt: string;
      steps: { label: string; detail: string; state: "done" | "stop" | "wait" }[];
    }
  | {
      kind: "voucher";
      title: string;
      no: string;
      borrower: string;
      fields: { label: string; value: string; tone: PaperTone; note: string }[];
      issues: PaperIssue[];
    }
  | {
      kind: "checklist";
      title: string;
      verdict: string;
      ok: boolean;
      items: { label: string; detail: string; tone: PaperTone }[];
    }
  | {
      kind: "occupancy";
      title: string;
      verdict: string;
      note: string;
      rows: { label: string; value: string }[];
    }
  | {
      kind: "collateral";
      title: string;
      note: string;
      counts: { label: string; value: string; tone: PaperTone }[];
      rows: { name: string; type: string; from: string; to: string; drop: string; reason: string; tone: PaperTone }[];
      issues: PaperIssue[];
    }
  | {
      kind: "disbursement";
      title: string;
      company: string;
      product: string;
      amount: string;
      account: string;
      verdict: string;
      riskScore: number;
      checks: { label: string; detail: string; ok: boolean }[];
      planRows: { term: number; amount: string; date: string; principal: string; interest: string }[];
    };

export function disbursementPaper(): WorkPaper {
  return {
    kind: "disbursement",
    title: "放款指令与还款计划",
    company: "河南星图智造科技有限公司",
    product: "流动资金贷款 · 150万",
    amount: "人民币 150 万元整",
    account: "工商银行郑州高新支行 · 尾号 8821",
    verdict: "建议立即发起放款指令（T+0 到账）",
    riskScore: 96,
    checks: [
      { label: "合同签订", detail: "已签，主要条款已对齐审批", ok: true },
      { label: "授信额度", detail: "核定额度覆盖本次放款", ok: true },
      { label: "额度占用", detail: "单户与客群池均未超限", ok: true },
      { label: "放款材料", detail: "9 项前置条件已核对", ok: true },
      { label: "拦截规则", detail: "23 条放款前规则全部通过", ok: true },
    ],
    planRows: [
      { term: 1, amount: "¥16,236.11", date: "2026-02-21", principal: "¥12,236.11", interest: "¥4,000.00" },
      { term: 2, amount: "¥16,236.11", date: "2026-03-21", principal: "¥12,322.45", interest: "¥3,913.66" },
      { term: 3, amount: "¥16,236.11", date: "2026-04-21", principal: "¥12,409.52", interest: "¥3,826.59" },
      { term: 4, amount: "¥16,236.11", date: "2026-05-21", principal: "¥12,497.09", interest: "¥3,739.02" },
      { term: 5, amount: "¥16,236.11", date: "2026-06-21", principal: "¥12,585.29", interest: "¥3,650.82" },
      { term: 6, amount: "¥16,236.11", date: "2026-07-21", principal: "¥12,674.12", interest: "¥3,561.99" },
    ],
  };
}

function toneOf(level: string): PaperTone {
  if (level === "高" || level.startsWith("拦截")) return "bad";
  if (level === "中" || level.startsWith("警告")) return "warn";
  if (level === "低") return "hint";
  return "ok";
}

export function paperDrawerTitle(paper: WorkPaper): string {
  switch (paper.kind) {
    case "contract":
      return "合同预览";
    case "credit":
      return "测算报告详情";
    case "ledger":
      return "报销对账明细";
    case "checklist":
      return "放款前置条件";
    case "occupancy":
      return "额度占用情况";
    case "collateral":
      return "押品重估详情";
    case "flow":
      return "流程落点";
    case "voucher":
      return "借款凭证";
    case "disbursement":
      return "放款计划与指令";
    default:
      return "处理详情";
  }
}

export function paperBrief(paper: WorkPaper): { tag: string; title: string; subtitle: string; issues: number } {
  const issues =
    "issues" in paper && paper.issues?.length
      ? paper.issues.length
      : paper.kind === "checklist"
        ? paper.items.filter((item) => item.tone !== "ok").length
        : 0;
  switch (paper.kind) {
    case "contract":
      return { tag: "合同", title: paper.title, subtitle: paper.borrower, issues };
    case "credit":
      return { tag: "额度", title: paper.title, subtitle: paper.verdict, issues: 0 };
    case "ledger":
      return {
        tag: "表格",
        title: "报销对账工作台",
        subtitle: paper.title.length > 52 ? `${paper.title.slice(0, 52)}…` : paper.title,
        issues,
      };
    case "checklist":
      return { tag: "放款", title: paper.title, subtitle: paper.verdict, issues };
    case "occupancy":
      return { tag: "额度", title: paper.title, subtitle: paper.note.slice(0, 52), issues: 0 };
    case "collateral":
      return { tag: "押品", title: paper.title, subtitle: paper.note, issues };
    case "flow":
      return { tag: "流程", title: paper.title, subtitle: paper.halt.slice(0, 52), issues: 0 };
    case "voucher":
      return { tag: "影像", title: paper.title, subtitle: paper.borrower, issues };
    case "disbursement":
      return { tag: "放款", title: paper.title, subtitle: paper.verdict, issues: 0 };
    default:
      return { tag: "详情", title: "处理结果", subtitle: "", issues: 0 };
  }
}

/** Hub 预制：只进多轮 *-flow-desk，不进单步 desk / 知识库 */
export const SHOWCASE_PROMPTS: { label: string; text: string }[] = CREDIT_FLOWS.map((f) => ({
  label: f.name,
  text: f.name,
}));

const COLLATERAL = [
  { name: "新乡华源化工有限公司", type: "工业厂房", from: "500万", to: "390万", drop: "-22%", reason: "涉诉冻结", tone: "bad" as const },
  { name: "开封金明区王某", type: "住宅", from: "200万", to: "164万", drop: "-18%", reason: "区域房价下行", tone: "bad" as const },
  { name: "平顶山煤业配套服务公司", type: "商业办公", from: "120万", to: "102万", drop: "-15%", reason: "空置率上升", tone: "warn" as const },
];

function collateralPaper(): WorkPaper {
  return {
    kind: "collateral",
    title: "押品价值重估",
    note: "共 58 笔待重估，8 笔跌值。下面是高风险预览。",
    counts: [
      { label: "正常资产", value: "45 笔", tone: "ok" },
      { label: "预警资产", value: "5 笔", tone: "warn" },
      { label: "高风险资产", value: "8 笔", tone: "bad" },
    ],
    rows: COLLATERAL,
    issues: COLLATERAL.filter((row) => row.tone === "bad").map((row) => ({
      level: row.tone,
      title: `${row.name} · ${row.reason}`,
      current: `${row.from} → ${row.to}（${row.drop}）`,
      expected: "移交风控复核，必要时冻结额度",
    })),
  };
}

function occupancyPaper(recipe: NonNullable<ReturnType<typeof dataRecipeFromSteps>>): WorkPaper {
  const ran = executeData(recipe);
  return {
    kind: "occupancy",
    title: "额度占用情况",
    verdict: "未超出",
    note: `客群额度池 1.2 亿元，已用 8600 万元。本申请 ${ran.finalAmount} 万元，单户核查未超限。`,
    rows: [
      { label: "客群", value: "普惠小微企业" },
      { label: "总额度池", value: "1.2 亿元" },
      { label: "已用额度", value: "8600 万元" },
      { label: "本申请", value: `${ran.finalAmount} 万元` },
    ],
  };
}

function checklistPaper(policy: NonNullable<ReturnType<typeof contractPolicyFromSteps>>): WorkPaper {
  const ran = executeContract(policy);
  const row = (name: string) => ran.grid.rows.find((item) => item[0]?.includes(name));
  const line = (name: string, label: string) => {
    const item = row(name);
    return {
      label,
      detail: `当前 ${item?.[1] ?? ""}，应为 ${item?.[2] ?? ""}`,
      tone: toneOf(item?.[3] ?? ""),
    };
  };
  const items = [
    { label: "授信审批已通过", detail: "审批编号 XD2024031500X", tone: "ok" as const },
    line("借款金额", "借款金额与审批一致"),
    line("借款期限", "借款期限与模板一致"),
    line("年化利率", "利率在审批容差内"),
    line("还款方式", "还款方式符合产品"),
    line("评估报告", "评估报告在有效期内"),
    { label: "用途承诺函已签署", detail: "采购原材料、设备款、周转备用", tone: "ok" as const },
    { label: "收款账户已核实", detail: "尾号 1234，户名与借款人一致", tone: "ok" as const },
    { label: "无在途司法冻结", detail: "未命中", tone: "ok" as const },
  ];
  const blocked = items.filter((item) => item.tone === "bad").length;
  return {
    kind: "checklist",
    title: "放款前置条件",
    verdict: blocked ? `${blocked} 项不通过，先改再放款` : "材料齐，可以放款",
    ok: blocked === 0,
    items,
  };
}

export function showcaseStepName(query: string, stepId: string, fallback: string): string {
  const table: Record<string, Record<string, string>> = {
    collateral: {
      parse: "读入押品估值",
      price: "对照原值算跌幅",
      check: "按跌幅和 LTV 标风险",
      report: "列出要移交的押品",
    },
    occupancy: {
      load: "取客群额度池",
      formula: "加上本申请",
      adjust: "核对单户上限",
      report: "写出是否超限",
    },
    checklist: {
      read: "读放款前置清单",
      diff: "逐项对审批",
      risk: "标出不通过的项",
      report: "给出放款意见",
    },
    sheet: {
      parse: "读入报销明细",
      price: "按配方汇总入账",
      check: "逐行对发票容差",
      report: "写出部门合计",
    },
  };
  const key = /押品/.test(query)
    ? "collateral"
    : /额度占用/.test(query)
      ? "occupancy"
      : /放款材料/.test(query)
        ? "checklist"
        : /报销|表格|汇总|发票|不含税|容差/.test(query)
          ? "sheet"
          : "";
  return (key && table[key]?.[stepId]) || fallback;
}

export function paperForSkill(skill: Pick<AgentSkill, "id" | "steps">, query: string): WorkPaper | null {
  const sheet = sheetRecipeFromSteps(skill.steps);
  if (sheet) {
    if (/押品/.test(query)) return collateralPaper();
    const recipe = sheetRecipeFromQuery(query, sheet);
    const ran = executeSheet(query, recipe);
    const issues: PaperIssue[] = [];
    const deptMap = new Map<string, number>();
    for (const row of ran.grid.rows) {
      const [dept, person, amount, , booked, invoice, gap, judge] = row;
      const tone = judge?.startsWith("拦截") ? "bad" as const : judge?.startsWith("警告") ? "warn" as const : "ok" as const;
      deptMap.set(dept!, (deptMap.get(dept!) ?? 0) + (Number.parseFloat(booked!) || 0));
      if (tone !== "ok") {
        issues.push({
          level: tone,
          title: `${person} · ${judge}`,
          current: `金额 ${amount}，发票 ${invoice}，差额 ${gap}`,
          expected: tone === "bad" && invoice === "空" ? "补齐发票后再入账" : "差额回到容差内",
        });
      }
    }
    return {
      kind: "ledger",
      title: ran.summary,
      grid: ran.grid,
      recipe: ran.recipe,
      deptTotals: [...deptMap.entries()].map(([dept, sum]) => ({
        dept,
        amount: Number.isInteger(sum) ? String(sum) : sum.toFixed(2),
      })),
      issues,
    };
  }

  const data = dataRecipeFromSteps(skill.steps);
  if (data) {
    if (/额度占用/.test(query)) return occupancyPaper(data);
    const ran = executeData(data);
    const cell = (name: string) => ran.grid.rows.find((row) => row[0] === name);
    const cash = cell("现金流测算");
    const adjusted = cell("风险调整");
    const finalRow = cell("核定额度");
    return {
      kind: "credit",
      title: "单户授信额度测算报告",
      no: "ED202603-10-001",
      verdict: `核定 ${finalRow?.[3] ?? ""} 万元`,
      note: ran.summary,
      metrics: [
        { label: "授信额度", value: `${finalRow?.[3] ?? ""} 万元` },
        { label: "现金流", value: `${cash?.[3] ?? ""} 万元` },
        { label: "风险调整", value: `${adjusted?.[3] ?? ""} 万元` },
        { label: "政策上限", value: `${data.policyCap} 万元` },
      ],
      formulas: [
        { name: "1. 现金流测算法", formula: "月均流水 × 稳定系数 × 偿债比例", expr: cash?.[2] ? `${cash[2]} = ${cash[3]}万` : "" },
        { name: "2. 风险调整", formula: "现金流 × 信用系数 × 行业系数 × 年限系数", expr: adjusted?.[2] ? `${adjusted[2]} = ${adjusted[3]}万` : "" },
      ],
      rows: [
        { label: "月均流水", value: `${data.monthly} 万元`, ok: true },
        { label: "稳定系数", value: String(data.stability) },
        { label: "偿债比例", value: String(data.debtRatio) },
        { label: "信用系数", value: String(data.credit), ok: data.credit >= 1 },
        { label: "行业系数", value: String(data.industry) },
        { label: "年限系数", value: String(data.years) },
        { label: "是否触及上限", value: (adjusted && Number(adjusted[3]) > data.policyCap) ? "卡住" : "未触及", ok: true },
      ],
    };
  }

  const contract = contractPolicyFromSteps(skill.steps);
  if (contract) {
    if (/放款材料/.test(query)) return checklistPaper(contract);
    const ran = executeContract(contract);
    const row = (name: string) => ran.grid.rows.find((item) => item[0]?.includes(name));
    const amount = row("借款金额");
    const term = row("借款期限");
    const rate = row("年化利率");
    const repay = row("还款方式");
    const issues: PaperIssue[] = ran.grid.rows
      .filter((item) => item[3] !== "通过")
      .map((item) => ({
        level: toneOf(item[3] ?? ""),
        title: item[0] ?? "",
        current: item[1] ?? "",
        expected: `${item[2] ?? ""}。${item[4] ?? ""}`,
      }));
    return {
      kind: "contract",
      title: "信贷借款合同",
      no: "2026-XF-00123",
      lender: "本行信贷中心",
      borrower: "星图智造",
      amount: { value: amount?.[1] ?? "", expected: amount?.[2] ?? "", fill: "50万", tone: toneOf(amount?.[3] ?? "") },
      term: { value: term?.[1] ?? "", expected: term?.[2] ?? "", fill: "36个月", tone: toneOf(term?.[3] ?? "") },
      rate: { value: rate?.[1] ?? "", expected: rate?.[2] ?? "", fill: "6.2%", tone: toneOf(rate?.[3] ?? "") },
      repay: { value: repay?.[1] ?? "", expected: repay?.[2] ?? "", fill: "等额本息", tone: toneOf(repay?.[3] ?? "") },
      issues,
      voucher: [
        { label: "借款人", value: "星图智造" },
        { label: "借款金额", value: amount?.[1] ?? "" },
        { label: "借款期限", value: term?.[1] ?? "" },
        { label: "借款利率", value: rate?.[1] ?? "" },
        { label: "放款账户", value: "6222 **** **** 1234" },
      ],
      plan: [
        { label: "采购原材料", value: "150,000.00 元" },
        { label: "设备款", value: "100,000.00 元" },
        { label: "周转备用", value: "50,000.00 元" },
      ],
    };
  }

  const flow = flowPolicyFromSteps(skill.steps);
  if (flow) {
    const ran = executeFlow(query, flow);
    let stopped = false;
    const steps = ran.phases.slice(0, 4).map((phase) => {
      const stop = !stopped && (phase.detail.includes("停在") || phase.detail.includes("拦截"));
      if (stop) stopped = true;
      return {
        label: phase.label,
        detail: phase.detail,
        state: stop ? "stop" as const : stopped ? "wait" as const : "done" as const,
      };
    });
    return { kind: "flow", title: ran.halt ? `停在${ran.halt}` : "流程走完", halt: ran.summary, steps };
  }

  const image = imagePolicyFromSteps(skill.steps);
  if (image) {
    const ran = executeImage(image);
    const fields = ran.grid.rows.map((row) => {
      const accept = row[5] === "采用";
      const confidence = Number(row[3]);
      const tone: PaperTone = accept ? "ok" : confidence < 0.6 ? "bad" : "warn";
      return { label: `${row[0]} · ${row[4]}`, value: row[2] ?? "", tone, note: `置信度 ${row[3]}` };
    });
    const issues: PaperIssue[] = ran.grid.rows
      .filter((row) => row[5] !== "采用")
      .map((row) => ({
        level: Number(row[3]) < 0.6 ? "bad" as const : "warn" as const,
        title: `${row[0]}未采用`,
        current: `${row[2]}（${row[3]}）`,
        expected: `置信度达到 ${image.minConfidence.toFixed(2)} 才写入`,
      }));
    return {
      kind: "voucher",
      title: "借款凭证",
      no: "PZ-2026-00123",
      borrower: "星图智造",
      fields,
      issues,
    };
  }

  return null;
}
