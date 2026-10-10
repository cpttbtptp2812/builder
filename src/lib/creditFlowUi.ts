/** 信贷流程步骤 → 可交互 UI（对齐 credit AIAssistant 的 flowBody / flowActions） */

export type FlowActionDef = {
  id: string;
  label: string;
  primary?: boolean;
  /** 点击后当作用户发送的文案 */
  sendAs: string;
};

export type CreditFlowUi =
  | { kind: "photo_grid"; slots: string[] }
  | { kind: "signature" }
  | { kind: "voice"; defaultText?: string }
  | { kind: "animated_checks"; items: { title: string; status: string }[]; autoAdvanceSendAs: string }
  | { kind: "thinking"; lines: string[]; autoAdvanceSendAs: string }
  | {
      kind: "form";
      fields: { id: string; label: string; placeholder?: string; defaultValue?: string }[];
      submitSendAs: string;
      submitLabel: string;
    }
  | {
      kind: "contract_edit";
      rows: { id: string; label: string; before: string; after: string }[];
      submitSendAs: string;
    }
  | {
      kind: "submission_success";
      ticket: string;
      title: string;
      lines: string[];
    };

export function creditFlowSkillId(flowId: string): string {
  return `${flowId}-flow-desk`;
}

export function flowIdFromSkillId(skillId: string): string | null {
  if (!skillId.endsWith("-flow-desk")) return null;
  const id = skillId.slice(0, -"-flow-desk".length);
  return id || null;
}

export function isCreditFlowSkillId(skillId: string): boolean {
  return skillId.endsWith("-flow-desk") && skillId !== "credit-flow-desk";
}

const CHECK_DISBURSE = [
  { title: "合同已签订", status: "通过" },
  { title: "授信额度已激活", status: "通过" },
  { title: "受托支付对象合规", status: "通过" },
  { title: "贷款用途真实", status: "通过" },
  { title: "账户状态正常", status: "通过" },
];

const CHECK_ADMISSION = [
  { title: "工商信息一致", status: "通过" },
  { title: "征信无不良", status: "通过" },
  { title: "反洗钱筛查", status: "通过" },
  { title: "关联企业排查", status: "通过" },
];

const CHECK_QUOTA = [
  { title: "单户已用额度", status: "未超限" },
  { title: "客群总额度", status: "充足" },
  { title: "本笔占用后", status: "仍合规" },
];

/** 按 flowId + stepId 决定本步是否嵌入交互区 */
export function uiForFlowStep(flowId: string, stepId: string): { ui: CreditFlowUi | null; actions: FlowActionDef[] } {
  const primary = (id: string, label: string, sendAs: string): FlowActionDef => ({
    id,
    label,
    sendAs,
    primary: true,
  });
  const secondary = (id: string, label: string, sendAs: string): FlowActionDef => ({
    id,
    label,
    sendAs,
  });

  if (stepId === "field_survey" || stepId === "postloan_photo") {
    return {
      ui: {
        kind: "photo_grid",
        slots: ["营业执照", "经营场所门头", "库存/货架现场", "近期流水截图"],
      },
      actions: [primary("submit_photos", "提交照片", "照片已全部上传，提交")],
    };
  }
  if (stepId === "client_sign") {
    return {
      ui: { kind: "signature" },
      actions: [primary("signed", "客户已签名确认", "客户已签名确认")],
    };
  }
  if (stepId === "interview") {
    return {
      ui: { kind: "voice", defaultText: "经营稳定，旺季需备货 30 万，还款靠货款回款。" },
      actions: [primary("voice_done", "使用录音解析结果", "继续")],
    };
  }
  if (stepId === "data_parsed") {
    return {
      ui: null,
      actions: [
        primary("data_ok", "数据真实，继续", "数据真实，继续"),
        secondary("data_warn", "有异议但继续", "数据有异议，但继续"),
      ],
    };
  }
  if (stepId === "disburse_checking") {
    return {
      ui: { kind: "animated_checks", items: CHECK_DISBURSE, autoAdvanceSendAs: "继续" },
      actions: [],
    };
  }
  if (stepId === "admission_checking") {
    return {
      ui: { kind: "animated_checks", items: CHECK_ADMISSION, autoAdvanceSendAs: "继续" },
      actions: [],
    };
  }
  if (stepId === "quota_rt_checking") {
    return {
      ui: { kind: "animated_checks", items: CHECK_QUOTA, autoAdvanceSendAs: "继续" },
      actions: [],
    };
  }
  if (stepId === "risk_id_thinking" || stepId === "collateral_thinking" || stepId === "industry_thinking") {
    return {
      ui: {
        kind: "thinking",
        lines: ["拉取交易流水", "比对舆情信号", "司法与关联图谱", "生成风险摘要"],
        autoAdvanceSendAs: "继续",
      },
      actions: [],
    };
  }
  if (stepId === "contract_risks") {
    return {
      ui: null,
      actions: [primary("to_revise", "进入条款修正", "修正问题")],
    };
  }
  if (stepId === "contract_revise") {
    return {
      ui: {
        kind: "contract_edit",
        rows: [
          { id: "rate", label: "年化利率", before: "6.8%", after: "6.2%" },
          { id: "fee", label: "提前还款违约金", before: "表述模糊", after: "剩余本金 1%" },
        ],
        submitSendAs: "已按审批口径修正，继续",
      },
      actions: [primary("revise", "确认修正并提交审核", "已按审批口径修正，继续")],
    };
  }
  if (stepId === "contract_done") {
    return {
      ui: {
        kind: "submission_success",
        ticket: `HT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-8842`,
        title: "合同已提交核心审核",
        lines: ["影像与修订版本已归档", "预计 1 个工作日内返回审核结果", "可在信贷核心「待审合同」队列跟踪"],
      },
      actions: [
        primary("done_ok", "知道了，关闭面板", "继续"),
        secondary("again", "再审查一笔", "合同审查"),
      ],
    };
  }
  if (stepId === "credit_calc_s2") {
    return {
      ui: {
        kind: "form",
        fields: [
          { id: "monthly", label: "月均流水（万元）", defaultValue: "420" },
          { id: "stability", label: "稳定系数", defaultValue: "0.85" },
        ],
        submitSendAs: "参数已确认，继续测算",
        submitLabel: "确认参数并测算",
      },
      actions: [],
    };
  }
  if (stepId === "collect_call") {
    return {
      ui: {
        kind: "form",
        fields: [
          { id: "result", label: "外呼结果", placeholder: "客户承诺周五前还款 50%" },
        ],
        submitSendAs: "已记录外呼结果",
        submitLabel: "保存外呼记录",
      },
      actions: [],
    };
  }

  // 各流程常见「开始」步
  const startActions: Record<string, FlowActionDef[]> = {
    preloan: [primary("start", "开始勘查", "开始")],
    contract: [primary("start", "开始审查", "开始审查")],
    disburse: [primary("start", "开始校验", "开始校验")],
    risk_id: [primary("start", "开始扫描", "开始扫描")],
    admission: [primary("start", "开始准入核查", "开始")],
    quota_rt: [primary("start", "开始额度核查", "开始")],
    credit_calc: [primary("start", "开始测算", "开始测算")],
    postloan: [primary("start", "开始检查", "开始")],
    collateral: [primary("start", "开始重估", "开始")],
    collect: [primary("start", "制定催收策略", "开始")],
    perf: [primary("start", "查看业绩拆解", "开始")],
    industry: [primary("start", "开始行业分析", "开始")],
    expense_flow: [primary("start", "开始报销流程", "继续")],
  };
  if (stepId.endsWith("_task") || stepId === "task_reception" || stepId === "contract_task" || stepId === "intake") {
    return { ui: null, actions: startActions[flowId] ?? [primary("go", "继续", "继续")] };
  }

  return {
    ui: null,
    actions: [primary("next", "继续", "继续")],
  };
}
