/** 信贷多轮对话流程定义（搬运自 credit AIAssistant 各 agent flow 步骤） */

export type CreditFlowPaper =
  | "contract"
  | "credit"
  | "checklist"
  | "occupancy"
  | "collateral"
  | "flow"
  | "disbursement"
  | "none";

export type CreditFlowStepDef = {
  id: string;
  label: string;
  title: string;
  body: string;
  tone?: "info" | "bridge" | "success";
  hint?: string;
  paper?: CreditFlowPaper;
  paperQuery?: string;
  /** 自动推进，不在对话里单独占一条卡片（合并进度条展示） */
  transient?: boolean;
};

export type CreditFlowDef = {
  id: string;
  name: string;
  triggers: string[];
  steps: CreditFlowStepDef[];
};

export const CREDIT_FLOWS: CreditFlowDef[] = [
  {
    id: "preloan",
    name: "贷前调查",
    triggers: ["贷前调查", "尽调", "调查报告", "贷前", "万邦蔬菜", "贷前调研", "张老板"],
    steps: [
      {
        id: "task_reception",
        label: "任务受理",
        title: "📋 贷前调查任务",
        tone: "info",
        body: "已收到贷前调查任务。\n南阳宛城万邦蔬菜批发市场 · 张三 · 申请 30 万。\n接下来：实地勘查 → 客户访谈 → 数据核验 → 风险评估 → 报告生成。",
        hint: "回复「继续」进入实地勘查",
      },
      {
        id: "field_survey",
        label: "实地勘查",
        title: "📸 实地勘查",
        tone: "bridge",
        body: "请在右侧「办理面板」上传四类现场材料：营业执照、经营场所门头、库存现场、近期流水截图。\n四项均须选择本机真实文件后才可提交。",
        hint: "打开办理面板上传全部材料后点「提交照片」",
      },
      {
        id: "data_parsed",
        label: "照片解析",
        title: "🔍 照片解析完成",
        tone: "bridge",
        body: "营业执照与系统一致；经营年限 8 年匹配；经营面积 OCR 约 120㎡（系统未录入，已标黄）。\n库存状态：货架充足。",
        hint: "回复「数据真实，继续」",
      },
      {
        id: "interview",
        label: "客户访谈",
        title: "🎙️ 客户访谈",
        tone: "bridge",
        body: "访谈要点：经营情况、备货资金需求、还款来源。\n请在办理面板完成录音（至少 2 秒）并解析后再推进。",
        hint: "打开办理面板录音，或粘贴访谈摘要发送",
      },
      {
        id: "interview_result",
        label: "访谈解析",
        title: "📝 访谈解析结果",
        tone: "bridge",
        body: "经营年限 8 年 ✓ · 资金需求 30 万（旺季备货）✓ · 还款来源：货款回款 ✓ · 还款意愿强 ✓",
        hint: "回复「继续」进入客户签名",
      },
      {
        id: "client_sign",
        label: "客户签名",
        title: "✍️ 客户确认签名",
        tone: "bridge",
        body: "信息确认书已生成。请在右侧办理面板手写签名并确认，不可空点通过。",
        hint: "打开办理面板完成签名",
      },
      {
        id: "quota_check",
        label: "额度核查",
        title: "💳 额度核查",
        tone: "bridge",
        body: "征信无不良 · 无其他在贷 · 可用额度充足 · 反洗钱通过 · 黑名单未命中。",
        hint: "回复「继续」",
      },
      {
        id: "risk_score",
        label: "风险评分",
        title: "📊 风险评分与授信建议",
        tone: "bridge",
        body: "综合风险评分 92 · 低风险 · 建议准入。\n建议发放 30 万短期经营贷款，LPR+50BP，到期还本付息。",
        paper: "credit",
        paperQuery: "测算这笔授信额度",
        hint: "回复「生成调查报告」",
      },
      {
        id: "report_preview",
        label: "报告预览",
        title: "📄 贷前调查报告预览",
        tone: "bridge",
        body: "报告编号 XD2024031900X · 客户张三 · 经营主体万邦蔬菜批发 · 申请 30 万 · 结论：建议准入。",
        hint: "回复「提交审批」",
      },
      {
        id: "done",
        label: "提交完成",
        title: "✅ 贷前调查已提交",
        tone: "success",
        body: "贷前调查报告已提交审批，预计 1 个工作日。\n报告已归档，待审批放款。",
      },
    ],
  },
  {
    id: "contract",
    name: "合同审查",
    triggers: ["合同审查", "贷款合同", "合规审查", "合同风险", "审查合同", "借款合同"],
    steps: [
      {
        id: "contract_task",
        label: "待审合同",
        title: "📄 合同智能审查",
        tone: "info",
        body: "河南星图智造 · 流动资金贷款 · 申请 150 万。\n附件：信贷借款合同、借款凭证、用途承诺函。\n回复「开始审查」进入要素拉取。",
        hint: "回复「开始审查」",
      },
      {
        id: "contract_parsing",
        label: "拉取要素",
        title: "⏳ 合同数据拉取",
        tone: "bridge",
        transient: true,
        body: "连接信贷核心与影像系统，拉取合同要素并核对。",
        hint: "",
      },
      {
        id: "contract_risks",
        label: "风险项",
        title: "⚠️ 发现合规风险",
        tone: "bridge",
        body: "发现 2 处需处理：提前还款违约金表述模糊；评估报告超 180 天需重评。\n右侧办理面板已含合同预览，核对后点「进入条款修正」。",
        paper: "contract",
        paperQuery: "审查这份借款合同",
        hint: "点「进入条款修正」",
      },
      {
        id: "contract_revise",
        label: "修正回写",
        title: "🔧 修正结果",
        tone: "bridge",
        body: "已按审批口径对齐利率与金额，违约金条款已改为按剩余本金 1% 计收。",
        paper: "contract",
        paperQuery: "把年化利率改回审批的6.2%再审查",
        hint: "勾选核对后在办理面板点「确认修正并继续」",
      },
      {
        id: "contract_done",
        label: "提交审核",
        title: "✅ 合同已提交审核",
        tone: "success",
        body: "已成功提交审核，等待核心系统处理。报告已归档。",
      },
    ],
  },
  {
    id: "disburse",
    name: "智能放款校验",
    triggers: ["放款校验", "放款条件", "智能放款", "智能放款校验", "核对放款", "满足放款"],
    steps: [
      {
        id: "disburse_task",
        label: "待校验记录",
        title: "🏦 智能放款校验",
        tone: "info",
        body: "河南星图智造 · 150 万流动资金贷款 · 待校验。\n回复「开始校验」执行放款前置核查。",
        hint: "回复「开始校验」",
      },
      {
        id: "disburse_checking",
        label: "条件校验",
        title: "⚙️ 放款条件校验（5项）",
        tone: "bridge",
        body: "合同已签订 ✓ · 授信额度已激活 ✓ · 受托支付对象合规 ✓ · 贷款用途真实 ✓ · 账户状态正常 ✓",
        paper: "checklist",
        paperQuery: "核对这笔放款材料齐不齐",
        hint: "回复「继续」",
      },
      {
        id: "disburse_quota",
        label: "额度占用",
        title: "📊 额度占用核查",
        tone: "bridge",
        body: "单户已用额度正常 · 客群总额度充足 · 本笔放款后仍未超限。",
        paper: "occupancy",
        paperQuery: "查这户额度占用超没超",
        hint: "回复「确认放款」",
      },
      {
        id: "disburse_done",
        label: "放款建议",
        title: "✅ 建议放款",
        tone: "success",
        body: "全部通过。放款金额 150 万，到账工行郑州高新支行尾号 8821，T+0。",
        paper: "disbursement",
        paperQuery: "放款",
      },
    ],
  },
  {
    id: "risk_id",
    name: "贷后风险识别",
    triggers: ["贷后风险", "风险识别", "风险扫描", "贷后监控"],
    steps: [
      {
        id: "risk_id_task",
        label: "任务",
        title: "🔍 贷后风险识别",
        tone: "info",
        body: "已接入贷后监控队列，扫描该客户近期交易、舆情与司法信号。回复「开始扫描」。",
        hint: "回复「开始扫描」",
      },
      {
        id: "risk_id_thinking",
        label: "扫描中",
        title: "⏳ 风险扫描中",
        tone: "bridge",
        body: "正在比对黑名单… 正在拉取司法公开信息… 正在计算行为偏离度…",
        hint: "回复「继续」",
      },
      {
        id: "risk_id_result",
        label: "结果",
        title: "📊 扫描结果",
        tone: "success",
        body: "未发现重大负面信号；建议维持现有贷后频率，关注行业景气度。",
      },
    ],
  },
  {
    id: "admission",
    name: "客户准入核查",
    triggers: ["准入核查", "客户准入", "准入审查"],
    steps: [
      {
        id: "admission_task",
        label: "任务",
        title: "👤 客户准入智能核查",
        tone: "info",
        body: "新客准入：工商状态、征信、反洗钱、关联企业。回复「开始核查」。",
        hint: "回复「开始核查」",
      },
      {
        id: "admission_checking",
        label: "核查中",
        title: "⚙️ 准入项校验",
        tone: "bridge",
        body: "营业执照有效 ✓ · 征信无不良 ✓ · 反洗钱通过 ✓ · 关联企业无异常 ✓",
        hint: "回复「继续」",
      },
      {
        id: "admission_result",
        label: "结论",
        title: "✅ 准入通过",
        tone: "success",
        body: "建议准入，可进入贷前调查或授信流程。",
      },
    ],
  },
  {
    id: "quota_rt",
    name: "额度实时核查",
    triggers: ["额度核查", "额度实时", "实时核查额度"],
    steps: [
      {
        id: "quota_rt_task",
        label: "任务",
        title: "💳 额度实时核查",
        tone: "info",
        body: "查询核心额度池与本笔占用。回复「开始核查」。",
        hint: "回复「开始核查」",
      },
      {
        id: "quota_rt_checking",
        label: "核查",
        title: "⚙️ 额度项核对",
        tone: "bridge",
        body: "单户额度 ✓ · 客群池 ✓ · 在途放款 ✓",
        paper: "occupancy",
        paperQuery: "查这户额度占用超没超",
        hint: "回复「继续」",
      },
      {
        id: "quota_rt_result",
        label: "结论",
        title: "✅ 额度充足，可放款",
        tone: "success",
        body: "核查结论：额度充足，建议放款。",
      },
    ],
  },
  {
    id: "credit_calc",
    name: "授信额度测算",
    triggers: ["额度测算", "授信测算", "授信额度", "测算额度"],
    steps: [
      {
        id: "credit_calc_task",
        label: "任务",
        title: "🧮 授信额度测算",
        tone: "info",
        body: "将按现金流法、风险调整与政策上限三步测算。回复「开始测算」。",
        hint: "回复「开始测算」",
      },
      {
        id: "credit_calc_s1",
        label: "现金流",
        title: "1️⃣ 现金流测算法",
        tone: "bridge",
        body: "月均流水 × 稳定系数 × 偿债比例 → 现金流额度。",
        hint: "回复「继续」",
      },
      {
        id: "credit_calc_s2",
        label: "风险调整",
        title: "2️⃣ 风险调整",
        tone: "bridge",
        body: "信用系数 × 行业系数 × 年限系数 → 风险调整后额度。",
        hint: "回复「继续」",
      },
      {
        id: "credit_calc_s3",
        label: "政策上限",
        title: "3️⃣ 政策上限",
        tone: "bridge",
        body: "对比单户与产品政策上限，取较小值。",
        paper: "credit",
        paperQuery: "测算这笔授信额度",
        hint: "回复「继续」",
      },
      {
        id: "credit_calc_result",
        label: "报告",
        title: "📄 测算报告",
        tone: "success",
        body: "核定额度已生成，详见右侧测算报告。",
        paper: "credit",
        paperQuery: "测算这笔授信额度",
      },
    ],
  },
  {
    id: "postloan",
    name: "贷后检查",
    triggers: ["贷后检查", "检查任务", "现场检查", "贷后现场"],
    steps: [
      {
        id: "postloan_task",
        label: "任务",
        title: "📋 贷后检查任务",
        tone: "info",
        body: "现场检查：经营场所、库存、流水。回复「开始检查」。",
        hint: "回复「开始检查」",
      },
      {
        id: "postloan_photo",
        label: "影像",
        title: "📸 现场影像",
        tone: "bridge",
        body: "请上传或确认：门头、库存、流水截图。回复「影像已上传」。",
        hint: "回复「影像已上传」",
      },
      {
        id: "postloan_ai_parse",
        label: "AI解析",
        title: "🤖 影像解析",
        tone: "bridge",
        body: "经营正常，库存与申报一致，无异常收缩。",
        hint: "回复「继续」",
      },
      {
        id: "postloan_result",
        label: "结论",
        title: "✅ 检查完成",
        tone: "success",
        body: "贷后检查通过，下一检查日已写入任务台。",
      },
    ],
  },
  {
    id: "collateral",
    name: "押品重估",
    triggers: ["押品", "重估", "抵押物", "押品价值"],
    steps: [
      {
        id: "collateral_task_brief",
        label: "任务",
        title: "🏠 押品价值重估",
        tone: "info",
        body: "58 笔待重估，8 笔高风险预览。回复「启动重估」。",
        hint: "回复「启动重估」",
      },
      {
        id: "collateral_thinking",
        label: "估值中",
        title: "⏳ 系统处理中",
        tone: "bridge",
        body: "接入核心… 调用 AVM 模型… 同步市场行情… 测算 LTV…",
        hint: "回复「继续」",
      },
      {
        id: "collateral_batch_result",
        label: "批量结果",
        title: "📊 批量重估结果",
        tone: "bridge",
        body: "45 笔正常 · 5 笔预警 · 8 笔高风险。详见右侧押品列表。",
        paper: "collateral",
        paperQuery: "重估这批押品，标出跌幅过大的",
        hint: "回复「执行处置」",
      },
      {
        id: "collateral_execute",
        label: "处置执行",
        title: "⏳ 执行处置策略",
        tone: "bridge",
        body: "归档正常资产… 高风险移交风控… 生成现场核查待办…",
        hint: "回复「继续」",
      },
      {
        id: "collateral_done",
        label: "完成",
        title: "✅ 押品重估完成",
        tone: "success",
        body: "工单 RE20260220-058：45 笔归档，8 笔转风控，5 笔待核查。",
      },
    ],
  },
  {
    id: "collect",
    name: "催收智能助手",
    triggers: ["催收", "逾期", "外呼", "催款"],
    steps: [
      {
        id: "collect_task",
        label: "任务",
        title: "📞 催收任务",
        tone: "info",
        body: "逾期账户清单已加载。回复「查看策略」。",
        hint: "回复「查看策略」",
      },
      {
        id: "collect_strategy",
        label: "策略",
        title: "📋 催收策略",
        tone: "bridge",
        body: "M1：短信+外呼；M2：上门+律师函；本户建议：外呼+还款方案。",
        hint: "回复「开始外呼」",
      },
      {
        id: "collect_call",
        label: "外呼",
        title: "📞 外呼记录",
        tone: "bridge",
        body: "客户承诺 3 日内还息，部分本金分期。已记录跟进。",
        hint: "回复「继续」",
      },
      {
        id: "collect_done",
        label: "完成",
        title: "✅ 催收动作已登记",
        tone: "success",
        body: "跟进任务已写入 CRM，3 日后自动提醒。",
      },
    ],
  },
  {
    id: "perf",
    name: "业绩跟踪",
    triggers: ["业绩", "完成率", "任务进度", "业绩跟踪"],
    steps: [
      {
        id: "perf_task",
        label: "任务",
        title: "📈 业绩跟踪",
        tone: "info",
        body: "本月放款与营收指标。回复「看明细」。",
        hint: "回复「看明细」",
      },
      {
        id: "perf_breakdown",
        label: "拆解",
        title: "📊 指标拆解",
        tone: "bridge",
        body: "放款完成率 78% · 营收完成率 82% · 新客户 15 户。",
        hint: "回复「继续」",
      },
      {
        id: "perf_plan",
        label: "计划",
        title: "📝 改进计划",
        tone: "success",
        body: "建议加强普惠小微冲刺，下周重点跟进 3 笔在途大单。",
      },
    ],
  },
  {
    id: "industry",
    name: "行业分析",
    triggers: ["行业分析", "行业风险", "行业报告"],
    steps: [
      {
        id: "industry_task",
        label: "任务",
        title: "🏭 行业分析",
        tone: "info",
        body: "将拉取行业景气、政策与同业不良率。回复「开始分析」。",
        hint: "回复「开始分析」",
      },
      {
        id: "industry_thinking",
        label: "分析中",
        title: "⏳ 深度分析中",
        tone: "bridge",
        body: "采集统计局数据… 比对同业披露… 生成风险观点…",
        hint: "回复「继续」",
      },
      {
        id: "industry_result",
        label: "报告",
        title: "📄 行业简报",
        tone: "success",
        body: "行业景气中性偏暖，关注原材料价格波动对中小制造客户现金流的影响。",
      },
    ],
  },
  {
    id: "expense_flow",
    name: "报销流程推进",
    triggers: ["报销单现在走到哪", "走到哪", "审批走到哪", "流程走到哪", "市场部9600"],
    steps: [
      {
        id: "intake",
        label: "收单",
        title: "📥 收单",
        tone: "info",
        body: "已定位单据：部门、申请人、金额。回复「继续」核发票。",
        paper: "flow",
        paperQuery: "市场部9600报销单现在走到哪",
        hint: "回复「继续」",
      },
      {
        id: "invoice",
        label: "核票",
        title: "🧾 核发票",
        tone: "bridge",
        body: "票面与入账比对中…",
        hint: "回复「继续」",
      },
      {
        id: "reconcile",
        label: "对账",
        title: "⚖️ 对账",
        tone: "bridge",
        body: "差额与守卫规则核对…",
        hint: "回复「继续」",
      },
      {
        id: "route",
        label: "升级",
        title: "🔀 审批升级",
        tone: "bridge",
        body: "按金额判断部门负责人 / 总监线…",
        hint: "回复「继续」",
      },
      {
        id: "report",
        label: "落点",
        title: "📍 流程落点",
        tone: "success",
        body: "当前停点与下一处理人已写出。",
        paper: "flow",
        paperQuery: "市场部9600报销单现在走到哪",
      },
    ],
  },
];

export function matchCreditFlowId(query: string): string | null {
  const q = query.trim();
  if (!q) return null;
  let best: { id: string; len: number } | null = null;
  for (const flow of CREDIT_FLOWS) {
    const candidates = [flow.name, ...flow.triggers];
    for (const t of candidates) {
      if (!t) continue;
      if ((q.includes(t) || t.includes(q)) && (!best || t.length > best.len)) {
        best = { id: flow.id, len: t.length };
      }
    }
  }
  return best?.id ?? null;
}

export function matchCreditFlowSkillId(query: string): string | null {
  const id = matchCreditFlowId(query);
  return id ? `${id}-flow-desk` : null;
}

export function creditFlowById(id: string): CreditFlowDef | undefined {
  return CREDIT_FLOWS.find((f) => f.id === id);
}
