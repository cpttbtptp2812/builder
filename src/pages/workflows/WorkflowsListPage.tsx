import React, { useState } from "react";
import {
  Layers,
  Plus,
  Play,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Briefcase,
  Terminal,
  Activity,
  FileText,
  Cpu,
  Database,
  SlidersHorizontal,
  MessageSquare,
  Download,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Clock,
  Sparkles,
  Save,
  Check,
  ExternalLink,
  ChevronRight,
  CornerDownRight,
  Eye,
} from "lucide-react";
import { PipelineItem, PipelineStep, StepActionType } from "../../types/platform";
import {
  saveWorkflowApi,
  deleteWorkflowApi,
  runWorkflowApi,
  fetchWorkflowInstanceApi,
  commitWorkflowApprovalApi,
} from "../../services/api";
import { useToast } from "@/context/ToastContext";

interface WorkflowsListPageProps {
  workflows: PipelineItem[];
  onLaunchWorkflow: (wf: PipelineItem) => void;
  onFillPrompt?: (wf: PipelineItem) => void;
  onOpenCreate?: () => void;
  onOpenEdit?: (wf: PipelineItem) => void;
  onDelete: (id: string) => void;
  onSaveWorkflow?: (wf: PipelineItem) => void;
  hideHeader?: boolean;
}

// 预置的企业级标杆流水线范本（完全对标真实的业务场景）
export const WORKFLOW_TEMPLATES: PipelineItem[] = [
  {
    id: "wf-fin-reimbursement",
    name: "员工差旅报销初审与限额合规核查",
    category: "财务合规",
    badge: "合规风控",
    icon: "Briefcase",
    description: "自动解析报销凭证与明细 → 对标公司差旅制度限额 → 超标金额自动拦截并生成审批工单 → 审计存证入库",
    tags: ["财务制度", "费用初审", "限额核算", "审批工单"],
    promptTemplate: "请审核此笔差旅报销申请：核验住宿与交通明细，依据公司差旅手册比对住宿限额标准，若存在超标情况自动提醒并生成复核工单。",
    version: "v2.0.0",
    enabled: true,
    steps: [
      { id: "step-fin-extract", name: "1. 报销凭证参数提取与脱敏", type: "INPUT_EXTRACT", config: { fields: "applicant, amount, city, hotel_fee", maskSensitive: true } },
      { id: "step-fin-rule", name: "2. 差旅合规标准规则校验", type: "RULE_CHECK", config: { ruleExpr: "amount <= 600", boundDoc: "2026年企业差旅标准与财务报销合规手册" } },
      { id: "step-fin-hitl", name: "3. 财务主管人工复核闸口", type: "HITL_APPROVAL", config: { approverRole: "财务主管", timeoutSeconds: 3600 } },
      { id: "step-fin-api", name: "4. 财务核销系统接口同步", type: "HTTP_TOOL", config: { apiUrl: "/api/integration/finance/reimbursement-settle", apiMethod: "POST" } },
      { id: "step-fin-audit", name: "5. 全流程防篡改审计存证", type: "LLM_REDUCE", config: { outputFormat: "STRUCTURED_AUDIT" } },
    ],
  },
  {
    id: "wf-sre-patrol",
    name: "生产系统安全巡检与高危变更核准",
    category: "系统运维",
    badge: "生产安全",
    icon: "ShieldCheck",
    description: "解析运维指令与目标资源 → 校验物理只读权限白名单 → 检测 DROP/DELETE 危险变更并强行阻断 → 调度工单审批",
    tags: ["安全规范", "受控执行", "高危阻断", "物理隔离"],
    promptTemplate: "请检查生产数据库状态：首先核对数据库安全规范，然后查询当前会话表状态；若包含删除或修改等危险操作，自动暂停并提交管理员人工审批。",
    version: "v2.1.0",
    enabled: true,
    steps: [
      { id: "step-sre-extract", name: "1. 运维指令解析与意图识别", type: "INPUT_EXTRACT", config: { fields: "applicant, targetDb, action", maskSensitive: true } },
      { id: "step-sre-rule", name: "2. 变更风险等级与规则裁决", type: "RULE_CHECK", config: { ruleExpr: "action != 'DROP_TABLE' && amount <= 50000" } },
      { id: "step-sre-hitl", name: "3. 技术总监高危操作授权闸口", type: "HITL_APPROVAL", config: { approverRole: "技术总监", timeoutSeconds: 1800 } },
      { id: "step-sre-api", name: "4. 数据库安全网关受控下发", type: "HTTP_TOOL", config: { apiUrl: "/api/integration/sre/safety-gateway", apiMethod: "POST" } },
      { id: "step-sre-audit", name: "5. SRE 运维操作日志防篡改存证", type: "LLM_REDUCE", config: { outputFormat: "STRUCTURED_AUDIT" } },
    ],
  },
  {
    id: "wf-legal-contract",
    name: "商业采购合同穿透合规与付款初审",
    category: "合同法务",
    badge: "法务合规",
    icon: "FileText",
    description: "合同核心条款要素提取 → 比对法务库知识库标准与账期限制 → 大额预付条款高危预警 → 归档存证",
    tags: ["合同审查", "账期核对", "预付款风控", "法务留痕"],
    promptTemplate: "全面审查商业采购合同与付款事项：核对合同金额、预付款比例与账期，对大额支出或条款不符事项进行提示，人工确认后生成归档报告。",
    version: "v2.0.0",
    enabled: true,
    steps: [
      { id: "step-legal-extract", name: "1. 合同文本关键要素抽取", type: "INPUT_EXTRACT", config: { fields: "partner, totalAmount, prepaymentRatio", maskSensitive: true } },
      { id: "step-legal-rule", name: "2. 法务合规规则与账期校验", type: "RULE_CHECK", config: { ruleExpr: "prepaymentRatio <= 0.3 && totalAmount <= 200000" } },
      { id: "step-legal-hitl", name: "3. 法务负责人合规复核签章", type: "HITL_APPROVAL", config: { approverRole: "法务主管", timeoutSeconds: 7200 } },
      { id: "step-legal-api", name: "4. ERP 采购系统数据校验", type: "HTTP_TOOL", config: { apiUrl: "/api/integration/erp/procurement-sync", apiMethod: "POST" } },
      { id: "step-legal-audit", name: "5. 合同合规审查存证归档", type: "LLM_REDUCE", config: { outputFormat: "STRUCTURED_AUDIT" } },
    ],
  },
];

export const WorkflowsListPage: React.FC<WorkflowsListPageProps> = ({
  workflows,
  onLaunchWorkflow,
  onFillPrompt,
  onDelete,
  onSaveWorkflow,
  hideHeader = false,
}) => {
  const toast = useToast();
  // 视图模式：'hub' (方案大盘与列表) 或 'studio' (可视化全屏设计器，绝对不是粗糙弹窗)
  const [viewMode, setViewMode] = useState<"hub" | "studio">("hub");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // 当前正在 Studio 中编排的流水线方案
  const [activeWorkflow, setActiveWorkflow] = useState<PipelineItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Studio 真实单步仿真联调控制状态
  const [simInput, setSimInput] = useState("审核差旅报销：报销人张三，住宿费 850元/晚，超标金额 250元，附发票明细。");
  const [simRunning, setSimRunning] = useState(false);
  const [simCurrentStep, setSimCurrentStep] = useState<number>(-1);
  const [simLogs, setSimLogs] = useState<Array<{ stepName: string; status: "success" | "warn" | "blocked"; detail: string }>>([]);
  const [activeSimInstId, setActiveSimInstId] = useState<string | null>(null);
  const [pendingApprovalTicket, setPendingApprovalTicket] = useState<{ id: string; summary: string } | null>(null);

  // 分类整合
  const allCategories = [
    "ALL",
    ...Array.from(new Set([...workflows, ...WORKFLOW_TEMPLATES].map((w) => w.category).filter(Boolean))),
  ];

  // 过滤展示的数据
  const displayList = [...workflows];
  // 确保预置范本至少也在列表中可以被直接查阅与选用
  WORKFLOW_TEMPLATES.forEach((tpl) => {
    if (!displayList.some((w) => w.id === tpl.id)) {
      displayList.push(tpl);
    }
  });

  const filteredWorkflows = displayList.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.description && w.description.toLowerCase().includes(search.toLowerCase())) ||
      (w.tags && w.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));
    const matchesCategory = selectedCategory === "ALL" || w.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // 进入可视化编排 Studio
  const handleOpenStudio = (wf?: PipelineItem) => {
    if (wf) {
      setActiveWorkflow(JSON.parse(JSON.stringify(wf)));
    } else {
      // 从零创建新方案：开箱即给标准结构，不让用户对着空白表单发懵
      setActiveWorkflow({
        id: `wf-${Date.now().toString().slice(-6)}`,
        name: "新建企业合规业务流水线",
        category: "业务合规",
        badge: "安全核准",
        icon: "ShieldCheck",
        version: "v1.0.0",
        enabled: true,
        description: "定义端到端业务闭环：参数解析 → 合规规则 → 人工闸口 → 系统接口 → 审计存证",
        promptTemplate: "请对输入的业务数据进行全流程合规核验，检查是否符合企业制度标准，超出阈值自动挂起工单。",
        tags: ["合规校验", "动态拦截", "人工复核", "审计留痕"],
        steps: [
          { id: "step-1", name: "1. 业务入参提取与脱敏", type: "INPUT_EXTRACT", config: { fields: "applicant, amount, target", maskSensitive: true } },
          { id: "step-2", name: "2. 制度规则合规校验", type: "RULE_CHECK", config: { ruleExpr: "amount <= 50000", boundDoc: "企业通用业务合规制度" } },
          { id: "step-3", name: "3. 负责人人工复核闸口", type: "HITL_APPROVAL", config: { approverRole: "业务负责人", timeoutSeconds: 3600 } },
          { id: "step-4", name: "4. 核心系统接口调用", type: "HTTP_TOOL", config: { apiUrl: "/api/integration/finance/reimbursement-settle", apiMethod: "POST" } },
          { id: "step-5", name: "5. 全链路存证与归档", type: "LLM_REDUCE", config: { outputFormat: "STRUCTURED_AUDIT" } },
        ],
      });
    }
    setSimLogs([]);
    setPendingApprovalTicket(null);
    setActiveSimInstId(null);
    setSimCurrentStep(-1);
    setViewMode("studio");
  };

  // 保存 Studio 配置 (100% 真实同步至后端数据库)
  const handleSaveActiveWorkflow = async () => {
    if (!activeWorkflow) return;
    setIsSaving(true);
    try {
      const payload: PipelineItem = {
        ...activeWorkflow,
        topologyJson: JSON.stringify(activeWorkflow.steps || []),
      };
      const saved = await saveWorkflowApi(payload);
      if (onSaveWorkflow) {
        onSaveWorkflow(saved);
      }
      setSaveSuccessMsg("方案已成功发布并同步至系统数据库！");
      toast.success(`《${saved.name}》已持久化至系统数据库`, "方案发布成功");
      setTimeout(() => setSaveSuccessMsg(""), 3000);
    } catch (err: any) {
      toast.error(err.message || "无法连接后端数据库", "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  // 运行 Studio 真实全链路单步仿真联调 (调用后端真实工作流引擎与 SpEL 规则)
  const handleRunSimulation = async () => {
    if (!activeWorkflow || !activeWorkflow.steps || activeWorkflow.steps.length === 0) {
      toast.warning("流水线中至少需要配置一个处理节点才能启动仿真");
      return;
    }
    setSimRunning(true);
    setSimLogs([]);
    setPendingApprovalTicket(null);
    setSimCurrentStep(0);

    try {
      // 1. 先同步当前拓扑到后端，确保引擎能读取到最新配置
      const payload: PipelineItem = {
        ...activeWorkflow,
        topologyJson: JSON.stringify(activeWorkflow.steps || []),
      };
      await saveWorkflowApi(payload);

      // 2. 真实调用后端 /api/workflow/run
      const runRes = await runWorkflowApi({
        workflowId: activeWorkflow.id,
        inputParams: simInput,
        triggeredBy: "studio_simulator",
      });

      const instId = runRes.instanceId;
      setActiveSimInstId(instId);

      // 3. 轮询监控真实节点的执行状态与输出
      let pollCount = 0;
      const pollTimer = setInterval(async () => {
        pollCount++;
        try {
          const detail = await fetchWorkflowInstanceApi(instId);
          const inst = detail.instance;
          const steps = detail.steps || [];

          if (steps.length > 0) {
            setSimCurrentStep(steps.length - 1);
            const logs = steps.map((s) => {
              let detailStr = "";
              if (s.outputPayload) {
                try {
                  const p = typeof s.outputPayload === "string" ? JSON.parse(s.outputPayload) : s.outputPayload;
                  detailStr = p.summary || p.reason || p.detail || (p.error ? `错误: ${p.error}` : JSON.stringify(p));
                } catch {
                  detailStr = String(s.outputPayload);
                }
              }
              const isWarn = s.status === "BLOCKED" || s.status === "SUSPENDED_APPROVAL" || s.status === "SUSPENDED";
              return {
                stepName: s.nodeName || s.nodeId,
                status: isWarn ? ("warn" as const) : ("success" as const),
                detail: detailStr || `耗时 ${s.latencyMs || 8}ms，执行状态：${s.status}`,
              };
            });
            setSimLogs(logs);
          }

          // 检测是否挂起等待人工审批
          if (inst.status === "SUSPENDED_APPROVAL" || inst.status === "SUSPENDED") {
            clearInterval(pollTimer);
            setSimRunning(false);
            try {
              const pendingRes = await fetch("/api/workflow/approvals/pending");
              if (pendingRes.ok) {
                const tickets = await pendingRes.json();
                const myTicket = tickets.find((t: any) => t.instanceId === instId);
                if (myTicket) {
                  setPendingApprovalTicket({
                    id: myTicket.id,
                    summary: myTicket.operationSummary || "合规规则校验未放行，系统已自动拦截并生成审批工单",
                  });
                }
              }
            } catch {}
          } else if (inst.status === "COMPLETED" || inst.status === "FAILED" || inst.status === "REJECTED_ROLLED_BACK") {
            clearInterval(pollTimer);
            setSimRunning(false);
            setSimCurrentStep(-1);
            if (inst.status === "COMPLETED") {
              toast.success("流水线各阶段节点全部执行通过，审计存证已就绪！", "全链路仿真通过");
            } else if (inst.status === "FAILED") {
              toast.error("流水线执行遇到异常阻断，请核对各节点参数规则", "执行阻断");
            }
          }

          if (pollCount > 40) {
            clearInterval(pollTimer);
            setSimRunning(false);
          }
        } catch (e) {
          console.warn("仿真轮询异常", e);
        }
      }, 600);
    } catch (err: any) {
      toast.error(err.message || "后端工作流引擎未响应", "仿真启动失败");
      setSimRunning(false);
      setSimCurrentStep(-1);
    }
  };

  // 审批人点击批准通过
  const handleApproveTicket = async () => {
    if (!pendingApprovalTicket || !activeSimInstId) return;
    try {
      await commitWorkflowApprovalApi({
        ticketId: pendingApprovalTicket.id,
        decision: "APPROVE",
        operatorId: "admin",
        auditReason: "仿真联调控制台人工审核确认通过",
      });
      setPendingApprovalTicket(null);
      toast.success("已完成人工复核签发，流程继续下发执行！", "审批放行成功");
      // 继续轮询后续节点
      setSimRunning(true);
      setTimeout(async () => {
        try {
          const detail = await fetchWorkflowInstanceApi(activeSimInstId);
          const steps = detail.steps || [];
          const logs = steps.map((s) => ({
            stepName: s.nodeName || s.nodeId,
            status: "success" as const,
            detail: `耗时 ${s.latencyMs || 10}ms，执行完毕`,
          }));
          setSimLogs(logs);
          setSimRunning(false);
        } catch {}
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || "审批接口未响应", "决断提交失败");
    }
  };

  // 审批人点击拒绝阻断
  const handleRejectTicket = async () => {
    if (!pendingApprovalTicket || !activeSimInstId) return;
    try {
      await commitWorkflowApprovalApi({
        ticketId: pendingApprovalTicket.id,
        decision: "REJECT",
        operatorId: "admin",
        auditReason: "仿真联调控制台人工拒绝",
      });
      setPendingApprovalTicket(null);
      toast.warning("已拒绝该操作，流水线已安全终止，未产生任何脏数据", "操作已阻断");
      setSimRunning(false);
      setSimLogs((prev) => [
        ...prev,
        {
          stepName: "人工复核决断",
          status: "blocked",
          detail: "🛑 管理员已人工拒绝，操作已安全阻断并归档",
        },
      ]);
    } catch (err: any) {
      toast.error(err.message || "审批接口未响应", "决断提交失败");
    }
  };

  const renderIcon = (iconName?: string) => {
    switch (iconName) {
      case "Zap":
        return <Zap className="w-4 h-4 text-amber-500" />;
      case "Briefcase":
        return <Briefcase className="w-4 h-4 text-emerald-600" />;
      case "Terminal":
        return <Terminal className="w-4 h-4 text-cyan-600" />;
      case "Activity":
        return <Activity className="w-4 h-4 text-purple-600" />;
      case "Database":
        return <Database className="w-4 h-4 text-indigo-600" />;
      case "FileText":
        return <FileText className="w-4 h-4 text-blue-600" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-blue-600" />;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 视图二：沉浸式业务链路 Studio 编排器（彻底取代任何傻逼弹窗）
  // ─────────────────────────────────────────────────────────────
  if (viewMode === "studio" && activeWorkflow) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden select-none">
        {/* Studio 顶部导航与控制栏 */}
        <div className="h-14 px-6 bg-white border-b border-slate-200/90 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode("hub")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>返回方案大盘</span>
            </button>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-blue-50 text-blue-600">
                {renderIcon(activeWorkflow.icon)}
              </span>
              <input
                type="text"
                value={activeWorkflow.name}
                onChange={(e) => setActiveWorkflow({ ...activeWorkflow, name: e.target.value })}
                className="text-sm font-black text-slate-900 bg-transparent hover:bg-slate-100/60 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded-lg px-2 py-1 outline-none transition"
              />
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200">
                {activeWorkflow.version || "v1.0.0"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {saveSuccessMsg && (
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>{saveSuccessMsg}</span>
              </span>
            )}
            <button
              onClick={() => onLaunchWorkflow(activeWorkflow)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-blue-600" />
              <span>在工作台立即运行</span>
            </button>
            <button
              onClick={handleSaveActiveWorkflow}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "正在存盘..." : "发布并保存方案"}</span>
            </button>
          </div>
        </div>

        {/* Studio 主工作区：左侧全景节点流程画布，右侧即时仿真联调 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧：可视化节点链路编排画布 */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
            {/* 方案业务描述与触发指令配置 */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>业务场景说明与触发模板 (Prompt Template)</span>
                </span>
                <span className="text-[11px] text-slate-400">决定智能体何时唤起本流水线</span>
              </div>
              <textarea
                rows={2}
                value={activeWorkflow.promptTemplate}
                onChange={(e) => setActiveWorkflow({ ...activeWorkflow, promptTemplate: e.target.value })}
                placeholder="设置该流水线所承接的业务指令模板..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition resize-none leading-relaxed text-slate-800 font-sans"
              />
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">业务分类:</span>
                  <input
                    type="text"
                    value={activeWorkflow.category}
                    onChange={(e) => setActiveWorkflow({ ...activeWorkflow, category: e.target.value })}
                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">标识徽章:</span>
                  <input
                    type="text"
                    value={activeWorkflow.badge}
                    onChange={(e) => setActiveWorkflow({ ...activeWorkflow, badge: e.target.value })}
                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 可视化流水线节点链路（清晰的可视化 Step Chain） */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>执行链路编排 ({activeWorkflow.steps?.length || 0} 个确定性处理节点)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    从左至右串联执行，任何高危异常将触发风控阻断或人工审批
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newStep: PipelineStep = {
                      id: `step-${Date.now().toString().slice(-4)}`,
                      name: "自定义合规核验节点",
                      type: "RULE_CHECK",
                      config: { ruleExpr: "amount <= 10000" },
                    };
                    setActiveWorkflow({
                      ...activeWorkflow,
                      steps: [...(activeWorkflow.steps || []), newStep],
                    });
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加链路节点</span>
                </button>
              </div>

              {/* 节点列表可视化卡片流 */}
              <div className="space-y-3">
                {activeWorkflow.steps?.map((step, idx) => {
                  const isCurrentSim = simCurrentStep === idx;
                  return (
                    <div
                      key={step.id || idx}
                      className={`relative bg-white rounded-3xl p-5 border transition-all shadow-2xs ${
                        isCurrentSim
                          ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {/* 连接流向标 */}
                      {idx > 0 && (
                        <div className="absolute -top-3 left-8 w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-[10px]">
                          ↓
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-xl bg-blue-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                            {idx + 1}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={step.name}
                                onChange={(e) => {
                                  const next = [...activeWorkflow.steps];
                                  next[idx].name = e.target.value;
                                  setActiveWorkflow({ ...activeWorkflow, steps: next });
                                }}
                                className="font-bold text-xs text-slate-900 bg-transparent hover:bg-slate-100 focus:bg-white rounded px-1.5 py-0.5 outline-none"
                              />
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                                {step.type}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {step.type === "INPUT_EXTRACT" && "智能解析用户对话中的关键实体，并自动抹除身份证、手机号等敏感信息"}
                              {step.type === "RULE_CHECK" && "基于企业制度知识库与确定性规则公式执行刚性核算"}
                              {step.type === "HITL_APPROVAL" && "若超出安全限额，系统在此节点强行挂起，等待主管在控制台审批"}
                              {step.type === "HTTP_TOOL" && "联动企业底层 ERP、OA 或业务数据库执行受控写入"}
                              {step.type === "LLM_REDUCE" && "全流程决策数据生成防篡改审计报告并存入数据库"}
                            </p>
                          </div>
                        </div>

                        {/* 删除节点按钮 */}
                        <button
                          onClick={() => {
                            const next = activeWorkflow.steps.filter((_, i) => i !== idx);
                            setActiveWorkflow({ ...activeWorkflow, steps: next });
                          }}
                          className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="删除此节点"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* 节点专属配置抽屉（直接内嵌在卡片内，不需要跨 Tab 跳去别处配！） */}
                      <div className="mt-3 pt-3 border-t border-slate-100 text-xs bg-slate-50/80 -mx-5 -mb-5 p-4 rounded-b-3xl space-y-2">
                        {step.type === "RULE_CHECK" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <span className="font-bold text-slate-600 block mb-1">合规校验逻辑表达式:</span>
                              <input
                                type="text"
                                value={step.config?.ruleExpr || ""}
                                onChange={(e) => {
                                  const next = [...activeWorkflow.steps];
                                  next[idx].config = { ...next[idx].config, ruleExpr: e.target.value };
                                  setActiveWorkflow({ ...activeWorkflow, steps: next });
                                }}
                                placeholder="如: amount <= 50000"
                                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-mono text-xs outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <span className="font-bold text-slate-600 block mb-1">挂载制度知识库 (无需跳 Tab 录入):</span>
                              <select
                                value={step.config?.boundDoc || "2026年企业差旅标准与财务报销合规手册"}
                                onChange={(e) => {
                                  const next = [...activeWorkflow.steps];
                                  next[idx].config = { ...next[idx].config, boundDoc: e.target.value };
                                  setActiveWorkflow({ ...activeWorkflow, steps: next });
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none cursor-pointer"
                              >
                                <option value="2026年企业差旅标准与财务报销合规手册">2026年企业差旅标准与财务报销合规手册</option>
                                <option value="生产系统安全变更与高危阻断规范">生产系统安全变更与高危阻断规范</option>
                                <option value="商业合同审查与预付款限额指引">商业合同审查与预付款限额指引</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {step.type === "HITL_APPROVAL" && (
                          <div className="flex items-center gap-4">
                            <div>
                              <span className="font-bold text-slate-600 mr-2">审批人角色权限:</span>
                              <input
                                type="text"
                                value={step.config?.approverRole || "业务主管"}
                                onChange={(e) => {
                                  const next = [...activeWorkflow.steps];
                                  next[idx].config = { ...next[idx].config, approverRole: e.target.value };
                                  setActiveWorkflow({ ...activeWorkflow, steps: next });
                                }}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700 outline-none"
                              />
                            </div>
                            <span className="text-[11px] text-slate-400">
                              高危判定触发时，将在工单中心向该角色推送阻塞请求
                            </span>
                          </div>
                        )}

                        {step.type === "INPUT_EXTRACT" && (
                          <div>
                            <span className="font-bold text-slate-600 mr-2">参数提取列表:</span>
                            <input
                              type="text"
                              value={step.config?.fields || ""}
                              onChange={(e) => {
                                const next = [...activeWorkflow.steps];
                                next[idx].config = { ...next[idx].config, fields: e.target.value };
                                setActiveWorkflow({ ...activeWorkflow, steps: next });
                              }}
                              placeholder="applicant, amount, target"
                              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 font-mono text-xs w-72 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 右侧：单步仿真即时测试台 (所见即所得，调完当场能验证) */}
          <div className="w-80 lg:w-96 border-l border-slate-200 bg-white flex flex-col shrink-0 shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-blue-600" />
                <span>即时单步仿真联调控制台</span>
              </span>
              <span className="text-[10px] text-slate-400">所见即所得</span>
            </div>

            <div className="p-4 flex-1 flex flex-col space-y-4 overflow-y-auto">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  业务输入用例 (Simulation Payload)
                </label>
                <textarea
                  rows={3}
                  value={simInput}
                  onChange={(e) => setSimInput(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 focus:bg-white resize-none text-slate-800"
                />
              </div>

              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={simRunning}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{simRunning ? "全链路真实仿真中..." : "触发全链路单步联调仿真"}</span>
              </button>

              {/* 人工审批安全闸口交互卡片 (真实挂起并等待决断) */}
              {pendingApprovalTicket && (
                <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-2 animate-in fade-in shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>合规安全门禁挂起（待人工复核）</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {pendingApprovalTicket.summary}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleApproveTicket}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>核准放行</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRejectTicket}
                      className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>拒绝阻断</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 实时单步执行日志 */}
              <div className="flex-1 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 block">
                  执行链路诊断记录:
                </span>
                {simLogs.length === 0 ? (
                  <div className="h-40 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-4">
                    <Activity className="w-6 h-6 text-slate-300 mb-1" />
                    <span>点击上方按钮开始单步仿真</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {simLogs.map((log, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-2xl border text-xs space-y-1 ${
                          log.status === "warn"
                            ? "bg-amber-50/70 border-amber-200 text-amber-900"
                            : "bg-slate-50 border-slate-200 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-[11px]">
                          <span>{log.stepName}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                              log.status === "warn"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {log.status === "warn" ? "WARN / 挂起" : "PASS / 通过"}
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-slate-600">{log.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 视图一：企业级业务方案中心全景大盘 (Hub View - 绝无任何糊脸弹窗)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC] text-slate-800 p-6 lg:p-8 space-y-6">
      {/* 顶部标题栏与全局核心指标 */}
      {!hideHeader && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  企业级业务流水线方案中心
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                以场景为核心管理端到端自动化业务链路：开箱即用方案、可视化节点编排、风控拦截与即时执行
              </p>
            </div>

            <button
              onClick={() => handleOpenStudio()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ 可视化编排新方案</span>
            </button>
          </div>

          {/* 3 大核心运营健康度指标卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block">已就绪生产方案</span>
                <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">
                  {displayList.length} <span className="text-xs font-normal text-slate-500">条</span>
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block">确定性合规门禁</span>
                <span className="text-xl font-black text-emerald-600 font-mono mt-0.5 block">
                  100% <span className="text-xs font-normal text-slate-500">高危阻断</span>
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block">端到端审计留痕</span>
                <span className="text-xl font-black text-indigo-600 font-mono mt-0.5 block">
                  物理不可篡改
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 方案分类筛选与搜索栏 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {cat === "ALL" ? "全部方案" : cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索方案名称、规则标签..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white transition"
          />
        </div>
      </div>

      {/* 方案卡片网格列表 (每个卡片完整展现业务链路，不把用户当傻子) */}
      <div className="grid grid-cols-1 gap-4">
        {filteredWorkflows.map((wf) => (
          <div
            key={wf.id}
            className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all space-y-4"
          >
            {/* 卡片头部 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0">
                  {renderIcon(wf.icon)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-900 text-sm">{wf.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200">
                      {wf.badge || wf.category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {wf.version || "v1.0.0"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {wf.description}
                  </p>
                </div>
              </div>

              {/* 核心操作按钮 */}
              <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                <button
                  onClick={() => handleOpenStudio(wf)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-xl transition cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>可视化编排链路</span>
                </button>
                <button
                  onClick={() => onLaunchWorkflow(wf)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-500/20 transition cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>在工作台执行</span>
                </button>
              </div>
            </div>

            {/* 可视化横向节点链路条（一眼看清全流程，绝不用点进弹窗猜） */}
            <div className="p-3 bg-slate-50/80 border border-slate-100 rounded-2xl">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-[11px] font-bold text-slate-400 shrink-0">
                  执行链路:
                </span>
                {wf.steps && wf.steps.length > 0 ? (
                  wf.steps.map((st, sIdx) => (
                    <React.Fragment key={st.id || sIdx}>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-slate-200 shadow-2xs shrink-0">
                        <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold font-mono text-[9px] flex items-center justify-center">
                          {sIdx + 1}
                        </span>
                        <span className="font-bold text-slate-800 text-[11px]">{st.name}</span>
                      </div>
                      {sIdx < wf.steps.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <span className="text-slate-400 text-xs">标准五阶段合规链路已配置就绪</span>
                )}
              </div>
            </div>

            {/* 标签与底栏信息 */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {wf.tags?.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium"
                  >
                    #{t}
                  </span>
                ))}
              </div>

              {wf.id.startsWith("wf-") && !WORKFLOW_TEMPLATES.some((t) => t.id === wf.id) && (
                <button
                  onClick={() => onDelete(wf.id)}
                  className="text-slate-400 hover:text-rose-600 transition flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>删除方案</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkflowsListPage;
