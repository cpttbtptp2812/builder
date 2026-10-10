import fs from "node:fs";
import path from "node:path";

/** 与 src/lib/creditFlowCatalog.ts 各 flow.triggers 对齐，并覆盖 Hub 预制句 */
const flows = [
  ["preloan", "贷前调查（多轮）", ["贷前调查", "尽调", "调查报告", "贷前", "万邦蔬菜", "贷前调研", "张老板"]],
  [
    "contract",
    "合同审查（多轮）",
    ["合同审查", "贷款合同", "合规审查", "合同风险", "审查合同", "借款合同", "审查这份借款合同", "审查借款合同"],
  ],
  [
    "disburse",
    "智能放款校验（多轮）",
    [
      "放款校验",
      "放款条件",
      "智能放款",
      "智能放款校验",
      "核对放款",
      "满足放款",
      "核对这笔放款材料",
      "核对这笔放款材料齐不齐",
    ],
  ],
  ["risk_id", "贷后风险识别（多轮）", ["贷后风险", "风险识别", "风险扫描", "贷后监控"]],
  ["admission", "客户准入（多轮）", ["准入核查", "客户准入", "准入审查"]],
  [
    "quota_rt",
    "额度实时核查（多轮）",
    ["额度核查", "额度实时", "实时核查额度", "查这户额度占用", "查这户额度占用超没超"],
  ],
  [
    "credit_calc",
    "授信额度测算（多轮）",
    ["额度测算", "授信测算", "授信额度", "测算额度", "测算这笔授信额度", "测算授信额度"],
  ],
  ["postloan", "贷后现场检查（多轮）", ["贷后检查", "检查任务", "现场检查", "贷后现场"]],
  ["collateral", "押品重估（多轮）", ["押品", "重估", "抵押物", "押品价值", "重估这批押品", "押品重估"]],
  ["collect", "催收外呼（多轮）", ["催收", "逾期", "外呼", "催款"]],
  ["perf", "业绩跟踪（多轮）", ["业绩", "完成率", "任务进度", "业绩跟踪"]],
  ["industry", "行业分析（多轮）", ["行业分析", "行业风险", "行业报告"]],
  [
    "expense_flow",
    "报销审批流程（多轮）",
    ["报销单现在走到哪", "走到哪", "审批走到哪", "流程走到哪", "市场部9600", "市场部9600报销单现在走到哪", "报销流程"],
  ],
];

for (const [id, desc, triggers] of flows) {
  const dir = path.join("src/skills", `${id}-flow-desk`);
  fs.mkdirSync(dir, { recursive: true });
  const body = `---
name: ${id}-flow-desk
description: ${desc} — 对话内上传、表单、校验、逐步推进
triggers:
${triggers.map((t) => `  - ${t}`).join("\n")}
steps:
  - id: turn
    label: 推进一步
    tool: __credit_flow_turn__
    args:
      query: "{{query}}"
      flowId: ${id}
      flowState: "{{creditFlowState}}"
---
`;
  fs.writeFileSync(path.join(dir, "SKILL.md"), body);
}
console.log("generated", flows.length);
