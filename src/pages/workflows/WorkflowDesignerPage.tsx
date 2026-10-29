import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Play,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Bot,
  BookOpen,
  Wrench,
  ShieldAlert,
  Sparkles,
  Terminal,
  Check,
  FileText,
  SlidersHorizontal,
  ArrowDown,
  Clock,
  UserCheck,
  RefreshCw,
  Eye,
  Activity,
  CheckSquare,
  ShieldCheck,
  Lock,
} from "lucide-react";
import {
  AgentItem,
  PipelineItem,
  PipelineStep,
  StepActionType,
  ToolItem,
  KnowledgeChunkItem,
} from "../../types/platform";
import {
  fetchAgentsApi,
  fetchKnowledgeChunksApi,
  fetchToolsApi,
  saveWorkflowApi,
  searchKnowledgeApi,
  runWorkflowApi,
  fetchWorkflowInstanceApi,
  commitWorkflowApprovalApi,
} from "../../services/api";
import { useToast } from "@/context/ToastContext";

interface WorkflowDesignerPageProps {
  workflow?: PipelineItem | null;
  agents: AgentItem[];
  onBack: () => void;
  onSave?: (saved: PipelineItem) => void;
  onSaveAndLaunch?: (saved: PipelineItem, prompt?: string) => void;
}

// 默认生产级 5 步流水线标准模板
const DEFAULT_STEPS: PipelineStep[] = [
  {
    id: "step-01",
    name: "输入语义解析与实体提取 (Input Extract)",
    type: "INPUT_EXTRACT",
    description: "从自然语言中提取目标企业、动用金额、合同编号等结构化参数，并自动脱敏敏感字段",
    config: {
      fields: "company_name, amount, contract_id, action_type",
      maskSensitive: true,
      outputFormat: "JSON",
    },
  },
  {
    id: "step-02",
    name: "RAG 制度合规与风险评级 (Policy Enforcement)",
    type: "RULE_CHECK",
    description: "检索企业内部《大额资金管理规范》与《生产变更准则》，结合规则引擎评定执行风险等级",
    config: {
      ruleExpr: "IF amount > 50000 THEN RISK_HIGH ELSE RISK_LOW",
      timeoutSeconds: 3,
    },
  },
  {
    id: "step-03",
    name: "人工安全审批",
    type: "HITL_APPROVAL",
    description: "遇到高危或超额操作时自动暂停，由管理员在界面确认同意后继续执行",
    config: {
      approverRole: "业务负责人 / 系统管理员",
      timeoutSeconds: 300,
    },
  },
  {
    id: "step-04",
    name: "调用系统工具",
    type: "HTTP_TOOL",
    description: "在 Java 21 虚拟线程隔离环境下调度底层校验与数据变更工具，执行真实校验与落库",
    config: {
      apiUrl: "/api/tools/execute",
      apiMethod: "POST",
      timeoutSeconds: 5,
    },
  },
  {
    id: "step-05",
    name: "终态大模型归纳与审计入库 (LLM Reduce & Audit)",
    type: "LLM_REDUCE",
    description: "大模型汇总长链执行数据，流式生成业务回执，并异步写入全链路 FinOps 审计追踪",
    config: {
      outputFormat: "STREAM_TEXT",
    },
  },
];

interface ExecutionLogItem {
  stepId: string;
  stepName: string;
  type: StepActionType;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "SUSPENDED" | "ERROR";
  durationMs?: number;
  inputPayload?: any;
  outputPayload?: any;
  message?: string;
}

export const WorkflowDesignerPage: React.FC<WorkflowDesignerPageProps> = ({
  workflow,
  agents: propAgents,
  onBack,
  onSave,
  onSaveAndLaunch,
}) => {
  const toast = useToast();
  // 1. 流水线基本元数据（完全隔离，不篡改全局资产）
  const [pipelineTitle, setPipelineTitle] = useState(
    workflow?.name || "资金审核与高危变更审批流程"
  );
  const [pipelineDescription, setPipelineDescription] = useState(
    workflow?.description ||
      "先解析输入内容，比对公司规章制度，遇到大额或高危操作自动暂停由管理员审批，审批通过后执行并记录日志。"
  );
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    workflow?.agentId || propAgents?.[0]?.id || ""
  );
  const [selectedCategory, setSelectedCategory] = useState<string>(
    workflow?.category || "企业核心业务"
  );

  // 2. 流水线阶段节点列表 (Pipeline DAG Nodes)
  const [steps, setSteps] = useState<PipelineStep[]>(() => {
    if (workflow?.steps && workflow.steps.length > 0) {
      return workflow.steps;
    }
    return DEFAULT_STEPS;
  });

  // 3. 展开配置的节点 ID
  const [expandedStepId, setExpandedStepId] = useState<string | null>("step-01");

  // 4. 底层依赖资产（仅作只读选项映射，绝不调用 saveAgentApi/toggleToolApi 篡改）
  const [agentsList, setAgentsList] = useState<AgentItem[]>(propAgents || []);
  const [toolsList, setToolsList] = useState<ToolItem[]>([]);
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeChunkItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // 5. 实时推演测试态状态
  const [testPayload, setTestPayload] = useState(
    workflow?.promptTemplate || ""
  );
  const [isExecutingPipeline, setIsExecutingPipeline] = useState(false);
  const [activeRunningStepIndex, setActiveRunningStepIndex] = useState<number>(-1);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogItem[]>([]);
  const [suspendedTicket, setSuspendedTicket] = useState<{
    ticketId: string;
    amount: number;
    company: string;
    reason: string;
    approver: string;
  } | null>(null);
  const [finalStreamOutput, setFinalStreamOutput] = useState<string>("");
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [showIoTraceModal, setShowIoTraceModal] = useState<ExecutionLogItem | null>(null);

  // 初始化拉取底层资产
  useEffect(() => {
    const loadAssets = async () => {
      try {
        const [fetchedAgents, fetchedTools, fetchedKb] = await Promise.all([
          fetchAgentsApi(),
          fetchToolsApi(),
          fetchKnowledgeChunksApi(),
        ]);
        if (fetchedAgents.length > 0) {
          setAgentsList(fetchedAgents);
          if (!selectedAgentId) setSelectedAgentId(fetchedAgents[0].id);
        }
        if (fetchedTools) setToolsList(fetchedTools);
        if (fetchedKb) setKnowledgeList(fetchedKb);
      } catch (e) {
        console.warn("加载资产失败", e);
      }
    };
    loadAssets();
  }, []);

  // 节点操作：添加/删除/上下移动
  const handleToggleStepExpand = (id: string) => {
    setExpandedStepId((prev) => (prev === id ? null : id));
  };

  const handleUpdateStepConfig = (stepId: string, partialConfig: Partial<PipelineStep["config"]>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, config: { ...s.config, ...partialConfig } } : s))
    );
  };

  const handleUpdateStepTitle = (stepId: string, name: string) => {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, name } : s)));
  };

  const handleDeleteStep = (stepId: string) => {
    if (steps.length <= 2) {
      toast.warning("流水线至少需保留 2 个阶段节点以确保长链执行完整性！");
      return;
    }
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
  };

  const handleMoveStep = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    const nextSteps = [...steps];
    const [moved] = nextSteps.splice(index, 1);
    nextSteps.splice(targetIndex, 0, moved);
    setSteps(nextSteps);
  };

  const handleAddDefaultStep = (type: StepActionType) => {
    const newId = `step-0${steps.length + 1}-${Date.now().toString().slice(-4)}`;
    let name = "自定义处理节点";
    let desc = "执行自定义长链处理逻辑";
    if (type === "RULE_CHECK") {
      name = "动态制度检索与合规网关";
      desc = "比对知识库企业规约，判断是否放行";
    } else if (type === "HTTP_TOOL") {
      name = "微服务外部接口调用";
      desc = "调度指定注册工具执行物理动作";
    } else if (type === "HITL_APPROVAL") {
      name = "人工审批确认";
      desc = "检测到高危或超额时自动暂停，人工确认后放行";
    }
    const newStep: PipelineStep = {
      id: newId,
      name,
      type,
      description: desc,
      config: { timeoutSeconds: 5, outputFormat: "JSON" },
    };
    setSteps([...steps, newStep]);
    setExpandedStepId(newId);
  };

  // 保存流水线定义（独立持久化，无全局状态副作用）
  const handleSavePipeline = async () => {
    setIsSaving(true);
    const item: PipelineItem = {
      id: workflow?.id || `wf-${Date.now()}`,
      name: pipelineTitle,
      category: selectedCategory,
      badge: "生产级流水线",
      icon: "ShieldAlert",
      description: pipelineDescription,
      tags: ["自动编排", "人工审批", "状态流转", "操作审计"],
      promptTemplate: testPayload,
      version: "v2.5",
      enabled: true,
      agentId: selectedAgentId,
      stepCount: steps.length,
      updatedAt: "刚刚",
      topologyJson: JSON.stringify(steps),
      steps,
    };

    try {
      await saveWorkflowApi(item);
      if (onSave) onSave(item);
      setSaveSuccessNotice(true);
      toast.success("流水线配置已成功持久化至数据库！", "保存成功");
      setTimeout(() => setSaveSuccessNotice(false), 2500);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "请检查后端网络连接", "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  // 带入对话工作台实测
  const handleLaunchToChat = async () => {
    const item: PipelineItem = {
      id: workflow?.id || `wf-${Date.now()}`,
      name: pipelineTitle,
      category: selectedCategory,
      badge: "生产级流水线",
      icon: "ShieldAlert",
      description: pipelineDescription,
      tags: ["自动编排", "人工审批", "状态流转", "操作审计"],
      promptTemplate: testPayload,
      version: "v2.5",
      enabled: true,
      agentId: selectedAgentId,
      stepCount: steps.length,
      updatedAt: "刚刚",
      topologyJson: JSON.stringify(steps),
      steps,
    };
    if (onSaveAndLaunch) {
      onSaveAndLaunch(item, testPayload);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // 核心：真实 Java 21 虚拟线程全链路流水线推演引擎 (零假定时器、零虚假数据)
  // ────────────────────────────────────────────────────────────────
  const syncInstanceLogs = async (instanceId: string) => {
    try {
      const detail = await fetchWorkflowInstanceApi(instanceId);
      const inst = detail.instance;
      const backendSteps = detail.steps || [];

      const logs: ExecutionLogItem[] = backendSteps.map((s) => {
        let parsedOutput: any = s.outputPayload;
        try {
          if (typeof s.outputPayload === "string" && s.outputPayload.startsWith("{")) {
            parsedOutput = JSON.parse(s.outputPayload);
          }
        } catch {}

        return {
          stepId: s.nodeId,
          stepName: s.nodeName || s.nodeId,
          type: (s.nodeType as StepActionType) || "GENERIC_STEP",
          status: s.status === "BLOCKED" ? "SUSPENDED" : (s.status as any),
          durationMs: s.latencyMs || 0,
          outputPayload: parsedOutput,
          message:
            s.status === "SUCCESS"
              ? `节点真实执行完成 (物理耗时: ${s.latencyMs || 0}ms)`
              : s.status === "BLOCKED"
              ? "【安全门禁生效】流水线已安全挂起，等待责任人人工复核"
              : s.status === "COMPENSATED"
              ? "【操作回滚】已执行逆向补偿，重置状态"
              : `执行状态: ${s.status}`,
        };
      });

      setExecutionLogs(logs);

      // 若实例挂起，拉取待审批工单
      if (inst.status === "SUSPENDED_APPROVAL" || inst.status === "SUSPENDED") {
        try {
          const pendingRes = await fetch("/api/workflow/approvals/pending");
          if (pendingRes.ok) {
            const pendingTickets = await pendingRes.json();
            const myTicket = pendingTickets.find((t: any) => t.instanceId === instanceId);
            if (myTicket) {
              setSuspendedTicket({
                ticketId: myTicket.id,
                amount: myTicket.amount,
                company: myTicket.target,
                reason: myTicket.operationSummary || "触发前置业务安全拦截规则，等待负责人人工核准",
                approver: "业务主管 / 安全责任人",
              });
            }
          }
        } catch {}
        setIsExecutingPipeline(false);
        return "SUSPENDED";
      }

      if (inst.status === "COMPLETED") {
        setIsExecutingPipeline(false);
        setActiveRunningStepIndex(-1);

        const reduceStep = backendSteps.find((s) => s.nodeType === "LLM_REDUCE");
        if (reduceStep && reduceStep.outputPayload) {
          try {
            const parsed = JSON.parse(reduceStep.outputPayload);
            if (parsed.summary) {
              setFinalStreamOutput(parsed.summary);
            }
          } catch {
            setFinalStreamOutput(String(reduceStep.outputPayload));
          }
        }
        return "COMPLETED";
      }

      if (inst.status === "FAILED" || inst.status === "REJECTED_ROLLED_BACK") {
        setIsExecutingPipeline(false);
        setActiveRunningStepIndex(-1);
        return "TERMINATED";
      }

      return "RUNNING";
    } catch (e) {
      console.warn("同步流水线执行状态异常", e);
      return "ERROR";
    }
  };

  const runPipelineExecution = async () => {
    setIsExecutingPipeline(true);
    setExecutionLogs([]);
    setSuspendedTicket(null);
    setFinalStreamOutput("");
    setActiveRunningStepIndex(0);

    try {
      // 1. 同步保存当前流水线拓扑至后端数据库
      const item: PipelineItem = {
        id: workflow?.id || `wf-${Date.now()}`,
        name: pipelineTitle,
        category: selectedCategory,
        badge: "生产级流水线",
        icon: "ShieldAlert",
        description: pipelineDescription,
        tags: ["自动编排", "人工审批", "状态流转", "操作审计"],
        promptTemplate: testPayload,
        version: "v2.5",
        enabled: true,
        agentId: selectedAgentId,
        stepCount: steps.length,
        updatedAt: "刚刚",
        topologyJson: JSON.stringify(steps),
        steps,
      };
      await saveWorkflowApi(item);

      // 2. 真实触发后端 Java 21 虚拟线程工作流引擎
      const runRes = await runWorkflowApi({
        workflowId: item.id,
        inputParams: testPayload,
        triggeredBy: "designer_console",
      });

      const instanceId = runRes.instanceId;
      setActiveInstanceId(instanceId);

      // 3. 轮询监控真实后端执行节点
      let rounds = 0;
      const timer = setInterval(async () => {
        rounds++;
        const state = await syncInstanceLogs(instanceId);
        if (state !== "RUNNING" || rounds > 120) {
          clearInterval(timer);
        }
      }, 500);

    } catch (err: any) {
      console.error("执行流水线推演失败", err);
      toast.error(err.message || "请检查后端服务是否正常运行", "启动后端工作流失败");
      setIsExecutingPipeline(false);
      setActiveRunningStepIndex(-1);
    }
  };

  // 审批人点击：批准通过
  const handleApproveSuspendedTicket = async () => {
    if (!suspendedTicket || !activeInstanceId) return;
    setIsExecutingPipeline(true);
    try {
      await commitWorkflowApprovalApi({
        ticketId: suspendedTicket.ticketId,
        decision: "APPROVED",
        operatorId: "admin",
        auditReason: "已核对相关凭据，管理员审批通过放行",
      });
      setSuspendedTicket(null);

      let rounds = 0;
      const timer = setInterval(async () => {
        rounds++;
        const state = await syncInstanceLogs(activeInstanceId);
        if (state !== "RUNNING" || rounds > 120) {
          clearInterval(timer);
        }
      }, 500);
    } catch (err: any) {
      toast.error(err.message || "服务异常", "提交核准失败");
      setIsExecutingPipeline(false);
    }
  };

  // 审批人点击：拒绝执行
  const handleRejectSuspendedTicket = async () => {
    if (!suspendedTicket || !activeInstanceId) return;
    setIsExecutingPipeline(true);
    try {
      await commitWorkflowApprovalApi({
        ticketId: suspendedTicket.ticketId,
        decision: "REJECTED",
        operatorId: "admin",
        auditReason: "人工审核判定存在超限风险，执行安全阻断",
      });
      setSuspendedTicket(null);

      await syncInstanceLogs(activeInstanceId);
      setIsExecutingPipeline(false);
      setActiveRunningStepIndex(-1);
      setFinalStreamOutput(
        `> 🛑 **流水线已安全终止**\n> 管理员已人工拒绝此操作，未产生脏数据。`
      );
    } catch (err: any) {
      toast.error(err.message || "服务异常", "提交否决失败");
      setIsExecutingPipeline(false);
    }
  };

  const currentAgent = agentsList.find((a) => a.id === selectedAgentId);

  return (
    <div className="flex flex-col h-full w-full bg-[#FAFBFC] overflow-hidden">
      {/* ────────────────── 顶部控制台导航栏 ────────────────── */}
      <header className="h-14 px-6 border-b border-slate-200/80 bg-white/95 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回流水线</span>
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={pipelineTitle}
              onChange={(e) => setPipelineTitle(e.target.value)}
              className="font-bold text-sm text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 outline-none px-1 py-0.5 transition w-80 truncate"
              title="点击修改流水线名称"
            />
            <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
              DAG Pipeline v2.5
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {saveSuccessNotice && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              已持久化至流水线定义库
            </span>
          )}

          <button
            onClick={handleSavePipeline}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <Save className="w-3.5 h-3.5 text-slate-400" />
            <span>{isSaving ? "保存中..." : "保存流水线配置"}</span>
          </button>

          <button
            onClick={handleLaunchToChat}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm shadow-blue-500/20"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>带入工作台实测</span>
          </button>
        </div>
      </header>

      {/* ────────────────── 核心双栏架构：左侧编排画布 + 右侧推演运行台 ────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ════════════ 左侧：流水线阶段节点编排轴 (Sequential Pipeline DAG) ════════════ */}
        <div className="flex-1 overflow-y-auto px-8 py-6 border-r border-slate-200/80 bg-[#FAFBFC]">
          <div className="max-w-3xl mx-auto space-y-5">
            {/* 顶栏：流水线全局参数摘要 */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                  流水线执行总览与基座配置
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">承办智能体：</span>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 outline-none focus:border-blue-600 cursor-pointer font-medium"
                  >
                    {agentsList.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.name} ({ag.model})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <textarea
                rows={2}
                value={pipelineDescription}
                onChange={(e) => setPipelineDescription(e.target.value)}
                placeholder="说明该流水线的核心业务目标与边界防线..."
                className="w-full text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:bg-white focus:border-blue-600 transition resize-none leading-relaxed"
              />
            </div>

            {/* 核心流水线节点链 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Execution Pipeline DAG
                  </span>
                  <span className="text-[10px] bg-slate-200/60 text-slate-600 px-2 py-0.2 rounded-full font-bold">
                    共 {steps.length} 个顺序阶段
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAddDefaultStep("RULE_CHECK")}
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/60 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>添加校验节点</span>
                  </button>
                  <button
                    onClick={() => handleAddDefaultStep("HTTP_TOOL")}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>添加工具节点</span>
                  </button>
                </div>
              </div>

              {/* 节点垂直链路 */}
              <div className="space-y-3 relative">
                {steps.map((step, index) => {
                  const isExpanded = expandedStepId === step.id;
                  const isFirst = index === 0;
                  const isLast = index === steps.length - 1;

                  return (
                    <div key={step.id} className="relative group">
                      {/* 连线装饰 */}
                      {!isLast && (
                        <div className="absolute left-6 top-14 bottom-[-14px] w-0.5 bg-slate-200 group-hover:bg-blue-300 transition-colors z-0" />
                      )}

                      <div
                        className={`relative z-10 bg-white border rounded-2xl shadow-2xs transition-all ${
                          isExpanded
                            ? "border-blue-500 ring-2 ring-blue-500/10"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {/* 节点头部 */}
                        <div className="p-4 flex items-center justify-between">
                          <div
                            onClick={() => handleToggleStepExpand(step.id)}
                            className="flex items-center gap-3.5 cursor-pointer flex-1"
                          >
                            {/* 阶段序号与类型图标 */}
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                step.type === "INPUT_EXTRACT"
                                  ? "bg-purple-50 text-purple-600"
                                  : step.type === "RULE_CHECK"
                                  ? "bg-emerald-50 text-emerald-600"
                                  : step.type === "HITL_APPROVAL"
                                  ? "bg-rose-50 text-rose-600"
                                  : step.type === "HTTP_TOOL"
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-blue-50 text-blue-600"
                              }`}
                            >
                              0{index + 1}
                            </div>

                            <div className="flex-1 pr-2">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-slate-900">{step.name}</h4>
                                <span className="text-[10px] font-mono px-2 py-0.2 rounded font-semibold bg-slate-100 text-slate-600">
                                  {step.type}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                {step.description}
                              </p>
                            </div>
                          </div>

                          {/* 操作操作条 */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleMoveStep(index, "up")}
                              disabled={isFirst}
                              title="上移此阶段"
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveStep(index, "down")}
                              disabled={isLast}
                              title="下移此阶段"
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteStep(step.id)}
                              title="删除此阶段"
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer ml-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleStepExpand(step.id)}
                              className="ml-1 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* 展开：节点独立参数编排台（仅修改当前流水线 config） */}
                        {isExpanded && (
                          <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3 rounded-b-2xl">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                阶段显示名称：
                              </label>
                              <input
                                type="text"
                                value={step.name}
                                onChange={(e) => handleUpdateStepTitle(step.id, e.target.value)}
                                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 outline-none focus:border-blue-600"
                              />
                            </div>

                            {/* 各节点专有配置项 */}
                            {step.type === "INPUT_EXTRACT" && (
                              <div className="grid grid-cols-2 gap-3 pt-1">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    提取实体定义（逗号分隔）：
                                  </label>
                                  <input
                                    type="text"
                                    value={step.config.fields || ""}
                                    onChange={(e) =>
                                      handleUpdateStepConfig(step.id, { fields: e.target.value })
                                    }
                                    placeholder="company_name, amount, contract_id"
                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 outline-none focus:border-blue-600 font-mono"
                                  />
                                </div>
                                <div className="flex items-center gap-2 pt-5">
                                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={step.config.maskSensitive !== false}
                                      onChange={(e) =>
                                        handleUpdateStepConfig(step.id, {
                                          maskSensitive: e.target.checked,
                                        })
                                      }
                                      className="accent-blue-600 rounded cursor-pointer"
                                    />
                                    <span>自动对卡号/账号执行 PII 脱敏</span>
                                  </label>
                                </div>
                              </div>
                            )}

                            {step.type === "RULE_CHECK" && (
                              <div className="space-y-2 pt-1">
                                <label className="block text-[11px] font-bold text-slate-700">
                                  规则判定表达式（阈值条件）：
                                </label>
                                <input
                                  type="text"
                                  value={step.config.ruleExpr || ""}
                                  onChange={(e) =>
                                    handleUpdateStepConfig(step.id, { ruleExpr: e.target.value })
                                  }
                                  placeholder="IF amount > 50000 THEN RISK_HIGH"
                                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 outline-none focus:border-emerald-600 font-mono"
                                />
                                <span className="text-[11px] text-slate-400 block">
                                  * 运行时将自动并发调用底座 RAG 知识库检索企业制度作为依据。
                                </span>
                              </div>
                            )}

                            {step.type === "HITL_APPROVAL" && (
                              <div className="grid grid-cols-2 gap-3 pt-1">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    指定签发审批官角色：
                                  </label>
                                  <input
                                    type="text"
                                    value={step.config.approverRole || ""}
                                    onChange={(e) =>
                                      handleUpdateStepConfig(step.id, {
                                        approverRole: e.target.value,
                                      })
                                    }
                                    placeholder="财务总监 / 合规审计官"
                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 outline-none focus:border-rose-600"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    挂起等待超时限制（秒）：
                                  </label>
                                  <input
                                    type="number"
                                    value={step.config.timeoutSeconds || 300}
                                    onChange={(e) =>
                                      handleUpdateStepConfig(step.id, {
                                        timeoutSeconds: parseInt(e.target.value) || 300,
                                      })
                                    }
                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 outline-none focus:border-rose-600 font-mono"
                                  />
                                </div>
                              </div>
                            )}

                            {step.type === "HTTP_TOOL" && (
                              <div className="space-y-2 pt-1">
                                <label className="block text-[11px] font-bold text-slate-700">
                                  调度执行的底层受控工具：
                                </label>
                                <select
                                  value={step.config.apiUrl || "/api/tools/execute"}
                                  onChange={(e) =>
                                    handleUpdateStepConfig(step.id, { apiUrl: e.target.value })
                                  }
                                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 outline-none focus:border-amber-600 cursor-pointer"
                                >
                                  <option value="/api/tools/execute">
                                    银行账户与转账核验接口
                                  </option>
                                  <option value="/api/tools/db_query">
                                    数据库只读查询接口
                                  </option>
                                  <option value="/api/tools/credit_check">
                                    企业统一信用代码核验接口
                                  </option>
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ════════════ 右侧：生产级流水线实时推演台 (Live Pipeline Runner) ════════════ */}
        <div className="w-[480px] border-l border-slate-200/80 bg-white flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
              <h3 className="text-xs font-bold text-slate-900">流水线实时推演工作台</h3>
            </div>
            <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-200">
              Live Runner
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* 快速用例输入预设 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700">测试输入内容：</label>
                {workflow?.promptTemplate && (
                  <button
                    type="button"
                    onClick={() => setTestPayload(workflow.promptTemplate)}
                    className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                  >
                    填入默认指令
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                placeholder="输入待推演的真实业务指令..."
                className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:bg-white focus:border-blue-600 transition resize-none leading-relaxed"
              />
              <button
                onClick={() => runPipelineExecution(0)}
                disabled={isExecutingPipeline}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm shadow-blue-500/20 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isExecutingPipeline ? "正在按顺序执行..." : "运行测试流程"}</span>
              </button>
            </div>

            {/* 人工审批卡片 */}
            {suspendedTicket && (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl shadow-sm space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    操作需要管理员人工审批确认
                  </span>
                  <span className="text-[10px] font-mono bg-rose-200 text-rose-800 px-2 py-0.5 rounded font-bold">
                    WAITING_APPROVAL
                  </span>
                </div>
                <div className="p-3 bg-white/90 border border-rose-200 rounded-xl text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>工单编号：</span>
                    <span className="font-mono font-bold text-slate-900">{suspendedTicket.ticketId}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>划拨金额：</span>
                    <span className="font-bold text-rose-600">
                      ¥{suspendedTicket.amount.toLocaleString()} 元 (超 5 万红线)
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>收款单位：</span>
                    <span className="font-semibold text-slate-900">{suspendedTicket.company}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>待审签角色：</span>
                    <span className="font-bold text-indigo-700">{suspendedTicket.approver}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleApproveSuspendedTicket}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>批准放行并恢复</span>
                  </button>
                  <button
                    onClick={handleRejectSuspendedTicket}
                    className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>拒绝并终止写操作</span>
                  </button>
                </div>
              </div>
            )}

            {/* 分步执行轨迹追踪列表 (Timeline Execution Logs) */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                执行步骤记录
              </span>

              {executionLogs.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                  点击上方启动按钮，查看长链节点如何一步步流转、判定与挂起
                </div>
              ) : (
                <div className="space-y-2">
                  {executionLogs.map((log, idx) => (
                    <div
                      key={log.stepId}
                      className={`p-3 rounded-xl border text-xs transition-all ${
                        log.status === "RUNNING"
                          ? "bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/10"
                          : log.status === "SUSPENDED"
                          ? "bg-rose-50/60 border-rose-300"
                          : log.status === "SUCCESS"
                          ? "bg-slate-50 border-slate-200"
                          : "bg-rose-50 border-rose-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400">
                            0{idx + 1}
                          </span>
                          <span className="font-bold text-slate-900">{log.stepName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {log.durationMs !== undefined && (
                            <span className="text-[10px] font-mono text-slate-400">
                              {log.durationMs}ms
                            </span>
                          )}
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              log.status === "SUCCESS"
                                ? "bg-emerald-100 text-emerald-800"
                                : log.status === "RUNNING"
                                ? "bg-blue-100 text-blue-800 animate-pulse"
                                : log.status === "SUSPENDED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {log.status}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
                        {log.message || "执行中..."}
                      </p>

                      {/* 查看当前节点流转 Payload 按钮 */}
                      {log.outputPayload && (
                        <button
                          onClick={() => setShowIoTraceModal(log)}
                          className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md transition cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>查看节点 IO Payload</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 终态大模型回执输出 */}
            {finalStreamOutput && (
              <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl shadow-sm text-xs space-y-2 border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-blue-400" />
                    终态业务回执单 (LLM Reduce Output)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">AUDIT_LOG_PERSISTED</span>
                </div>
                <div className="whitespace-pre-wrap leading-relaxed font-sans text-slate-300">
                  {finalStreamOutput}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ────────────────── 节点 IO Trace 弹窗抽屉 ────────────────── */}
      {showIoTraceModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-900">
                  节点上下文数据流 (Payload Inspector) - {showIoTraceModal.stepName}
                </h4>
              </div>
              <button
                onClick={() => setShowIoTraceModal(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                关闭
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                  输入上下文 (Input Context)
                </span>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed">
                  {JSON.stringify(showIoTraceModal.inputPayload, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                  节点产出 (Output Payload)
                </span>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed">
                  {JSON.stringify(showIoTraceModal.outputPayload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowDesignerPage;
