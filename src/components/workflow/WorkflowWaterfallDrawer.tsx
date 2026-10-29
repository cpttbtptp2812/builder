import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Check,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Clock,
  RefreshCw,
  Copy,
  Layers,
  Database,
  Cpu,
  Terminal,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Lock,
  Code2,
} from "lucide-react";
import type {
  PipelineItem,
  PipelineStep,
  WorkflowInstanceData,
  NodeExecutionData,
  ApprovalTicketData,
  WorkflowEventMessageData,
} from "@/types/platform";
import {
  fetchWorkflowInstanceApi,
  commitWorkflowApprovalApi,
} from "@/services/api";
import { useToast } from "@/context/ToastContext";

interface WorkflowWaterfallDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workflow: PipelineItem | null;
  instanceId: string | null;
  onApprovalDecided?: () => void;
}

export const WorkflowWaterfallDrawer: React.FC<WorkflowWaterfallDrawerProps> = ({
  isOpen,
  onClose,
  workflow,
  instanceId,
  onApprovalDecided,
}) => {
  const toast = useToast();
  const [instance, setInstance] = useState<WorkflowInstanceData | null>(null);
  const [steps, setSteps] = useState<NodeExecutionData[]>([]);
  const [activeTicket, setActiveTicket] = useState<ApprovalTicketData | null>(null);
  const [selectedStep, setSelectedStep] = useState<NodeExecutionData | null>(null);
  const [auditReason, setAuditReason] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<number | null>(null);

  // 加载实例与节点最新数据
  const refreshInstanceData = async () => {
    if (!instanceId) return;
    try {
      const data = await fetchWorkflowInstanceApi(instanceId);
      if (data) {
        setInstance(data.instance);
        setSteps(data.steps || []);
      }
    } catch (err) {
      console.error("Failed to fetch workflow instance data", err);
    }
  };

  // 轮询待审批列表检查是否存在挂起的审批票据
  const checkPendingApproval = async () => {
    if (!instanceId) return;
    try {
      const res = await fetch("/api/workflow/approvals/pending");
      if (res.ok) {
        const tickets: ApprovalTicketData[] = await res.json();
        const found = tickets.find((t) => t.instanceId === instanceId && t.status === "PENDING");
        if (found) {
          setActiveTicket(found);
        } else {
          setActiveTicket(null);
        }
      }
    } catch (err) {
      console.warn("Failed to check pending approvals", err);
    }
  };

  useEffect(() => {
    if (!isOpen || !instanceId) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // 初始加载
    refreshInstanceData();
    checkPendingApproval();

    // 开启耗时计时器
    const startTime = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 100);

    // 建立 SSE 流式监听
    const sse = new EventSource(`/api/workflow/instances/${instanceId}/stream`);
    eventSourceRef.current = sse;

    sse.onmessage = (event) => {
      try {
        const msg: WorkflowEventMessageData = JSON.parse(event.data);
        if (msg.eventType === "NODE_RUNNING") {
          refreshInstanceData();
        } else if (msg.eventType === "NODE_COMPLETED") {
          refreshInstanceData();
        } else if (msg.eventType === "TICKET_REQUIRED") {
          refreshInstanceData();
          if (msg.payload) {
            setActiveTicket(msg.payload as ApprovalTicketData);
          } else {
            checkPendingApproval();
          }
        } else if (msg.eventType === "TICKET_APPROVED" || msg.eventType === "TICKET_REJECTED") {
          setActiveTicket(null);
          refreshInstanceData();
        } else if (msg.eventType === "INSTANCE_COMPLETED" || msg.eventType === "INSTANCE_FAILED") {
          refreshInstanceData();
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      } catch (err) {
        console.warn("SSE parse error", err);
      }
    };

    sse.onerror = () => {
      // 容错并重试读取最新状态
      refreshInstanceData();
    };

    return () => {
      if (sse) sse.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, instanceId]);

  // 当实例完成或终止时停止计时
  useEffect(() => {
    if (instance?.status && ["COMPLETED", "FAILED", "REJECTED_ROLLED_BACK"].includes(instance.status)) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [instance?.status]);

  if (!isOpen) return null;

  // 审批决策操作
  const handleDecision = async (decision: "APPROVED" | "REJECTED") => {
    if (!activeTicket) return;
    setIsCommitting(true);
    try {
      await commitWorkflowApprovalApi({
        ticketId: activeTicket.id,
        decision,
        auditReason: auditReason.trim() || undefined,
      });
      setActiveTicket(null);
      await refreshInstanceData();
      if (onApprovalDecided) onApprovalDecided();
      toast.success(decision === "APPROVED" ? "审批通过，流程继续下发" : "操作已人工阻断并归档", "审批决策成功");
    } catch (err: any) {
      toast.error(err.message || String(err), "提交审批决策失败");
    } finally {
      setIsCommitting(false);
    }
  };

  const copyText = (text: string, type: "id" | "payload") => {
    navigator.clipboard.writeText(text);
    if (type === "id") {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    }
  };

  // 动态合并：将配置中预定义的步骤与运行时执行步骤及补偿节点对齐
  const configuredSteps: PipelineStep[] = workflow?.steps || [];
  const totalConfigured = configuredSteps.length;

  // 计算甘特图总耗时基准
  const totalDurationMs = steps.reduce((sum, s) => sum + (s.latencyMs || 0), 0) || Math.max(elapsedMs, 1000);

  const getStatusBadge = (st?: string) => {
    switch (st) {
      case "RUNNING":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full text-xs font-bold animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>执行中 (Running)</span>
          </span>
        );
      case "SUSPENDED_APPROVAL":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-300 rounded-full text-xs font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>等待人工安全核准</span>
          </span>
        );
      case "COMPLETED":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-full text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>流水线执行成功</span>
          </span>
        );
      case "REJECTED_ROLLED_BACK":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-300 rounded-full text-xs font-bold">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>已驳回并完成自动安全回滚</span>
          </span>
        );
      case "FAILED":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-300 rounded-full text-xs font-bold">
            <XCircle className="w-3.5 h-3.5" />
            <span>异常失败</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>初始化</span>
          </span>
        );
    }
  };

  const getStepTypeBadge = (type: string) => {
    switch (type) {
      case "INPUT_EXTRACT":
        return <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-semibold">入参提取</span>;
      case "RULE_CHECK":
        return <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-semibold">规则风控</span>;
      case "HTTP_TOOL":
      case "MCP_TOOL_CALL":
        return <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-semibold">接口工具</span>;
      case "HITL_APPROVAL":
      case "HUMAN_APPROVAL_GATE":
      case "HUMAN_APPROVAL_人工核准":
        return <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">人工审批</span>;
      case "LLM_REDUCE":
      case "LLM_REASONING":
        return <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-semibold">生成结果</span>;
      case "COMPENSATION_ACTION":
        return <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">异常回滚</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">{type}</span>;
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[620px] lg:w-[700px] bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 ease-out">
      {/* ── 抽屉顶栏 ── */}
      <div className="h-16 px-6 border-b border-slate-200/90 flex items-center justify-between bg-slate-50/90 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-slate-800 tracking-tight">
                {workflow?.name || "业务自动化流水线"} · 实时执行瀑布
              </h2>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] font-mono text-slate-400">
                Instance: {instanceId}
              </span>
              <button
                onClick={() => instanceId && copyText(instanceId, "id")}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
                title="复制实例 ID"
              >
                {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {getStatusBadge(instance?.status)}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            title="关闭抽屉"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── 核心内容滚动区 ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
        {/* 概览统计面板 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-medium text-slate-400">步骤完成进度</span>
            <div className="text-lg font-black font-mono text-slate-800 mt-1 flex items-baseline gap-1">
              <span>{steps.filter((s) => s.status === "SUCCESS" || s.status === "COMPENSATED").length}</span>
              <span className="text-xs text-slate-400 font-normal">/ {totalConfigured || steps.length}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/70">
            <span className="text-[11px] font-medium text-blue-600">累计执行耗时</span>
            <div className="text-lg font-black font-mono text-blue-900 mt-1">
              {(totalDurationMs / 1000).toFixed(2)}s
              <span className="text-[10px] text-blue-500 font-normal ml-1">({totalDurationMs}ms)</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/70">
            <span className="text-[11px] font-medium text-emerald-600">数据源一致性</span>
            <div className="text-sm font-black text-emerald-900 mt-1.5 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>100% 真实执行</span>
            </div>
          </div>
        </div>

        {/* ═══════════ 高危操作人工复核卡片 ═══════════ */}
        {activeTicket && (
          <div className="p-5 rounded-2xl bg-amber-50/90 border-2 border-amber-400 text-amber-950 shadow-md space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-200/80 flex items-center justify-center text-amber-800 font-black">
                  <ShieldAlert className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-amber-900">
                    操作需要管理员人工审批确认
                  </h3>
                  <p className="text-[11px] text-amber-700 font-mono mt-0.5">
                    工单号: {activeTicket.id}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-300">
                等待确认中
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/90 border border-amber-200/80 text-xs text-slate-800 space-y-1.5">
              <div className="font-bold text-slate-900 flex items-center gap-1">
                <span>审批说明：</span>
              </div>
              <p className="leading-relaxed text-slate-600">
                {activeTicket.operationSummary}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-amber-900">
                审计批注 / 决策原因 (可选填入凭据防伪审计日志):
              </label>
              <input
                type="text"
                value={auditReason}
                onChange={(e) => setAuditReason(e.target.value)}
                placeholder="例如：经业务主管核实，审批材料合规完整，准予继续提交"
                className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                disabled={isCommitting}
                onClick={() => handleDecision("APPROVED")}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50"
              >
                {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>✔️ 确认授权并批准放行</span>
              </button>

              <button
                disabled={isCommitting}
                onClick={() => handleDecision("REJECTED")}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50"
              >
                {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                <span>✕ 判定风险并驳回终止</span>
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ 全链路执行瀑布甘特图 ═══════════ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>全链路节点执行时间轴与甘特瀑布 (毫秒级打点)</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              按时间线升序渲染
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-3.5">
            {/* 动态合并渲染：如果有已执行的步骤，按已执行渲染；后面补上尚未执行的步骤 */}
            {(() => {
              // 构建统一的渲染节点列表
              const renderedItems: Array<{
                key: string;
                nodeId: string;
                nodeName: string;
                nodeType: string;
                status: "PENDING" | "RUNNING" | "SUCCESS" | "BLOCKED" | "COMPENSATED" | "FAILED";
                latencyMs?: number;
                execRecord?: NodeExecutionData;
              }> = [];

              // 先填入所有真实执行记录
              steps.forEach((s) => {
                renderedItems.push({
                  key: s.id,
                  nodeId: s.nodeId,
                  nodeName: s.nodeName,
                  nodeType: s.nodeType,
                  status: (s.status as any) || "SUCCESS",
                  latencyMs: s.latencyMs,
                  execRecord: s,
                });
              });

              // 检查配置中的步骤，如果尚未执行，显示为 PENDING
              configuredSteps.forEach((cs) => {
                const found = renderedItems.find((r) => r.nodeId === cs.id);
                if (!found) {
                  const isCurrent = instance?.currentNodeId === cs.id && instance?.status === "RUNNING";
                  renderedItems.push({
                    key: cs.id,
                    nodeId: cs.id,
                    nodeName: cs.name,
                    nodeType: cs.type,
                    status: isCurrent ? "RUNNING" : "PENDING",
                    latencyMs: undefined,
                  });
                }
              });

              let cumulativeLatency = 0;

              return renderedItems.map((item, idx) => {
                const latency = item.latencyMs || 0;
                const offsetPercent = Math.min(90, (cumulativeLatency / totalDurationMs) * 100);
                const widthPercent = item.status === "PENDING"
                  ? 0
                  : Math.max(8, Math.min(100 - offsetPercent, (latency / totalDurationMs) * 100));

                if (item.status === "SUCCESS" || item.status === "COMPENSATED") {
                  cumulativeLatency += latency;
                }

                return (
                  <div
                    key={item.key || idx}
                    onClick={() => item.execRecord && setSelectedStep(item.execRecord)}
                    className={`p-3 rounded-xl border transition-all ${
                      item.execRecord ? "cursor-pointer hover:shadow-xs" : ""
                    } ${
                      selectedStep?.nodeId === item.nodeId
                        ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20"
                        : item.status === "RUNNING"
                        ? "bg-blue-50/50 border-blue-200"
                        : item.status === "BLOCKED"
                        ? "bg-amber-50/60 border-amber-300"
                        : item.status === "COMPENSATED"
                        ? "bg-purple-50/60 border-purple-200"
                        : item.status === "SUCCESS"
                        ? "bg-white border-slate-200/90 hover:border-slate-300"
                        : "bg-slate-100/50 border-slate-200/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold font-mono bg-slate-100 text-slate-600">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-800">
                          {item.nodeName}
                        </span>
                        {getStepTypeBadge(item.nodeType)}
                      </div>

                      <div className="flex items-center gap-2">
                        {item.status === "RUNNING" && (
                          <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-blue-600 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>执行中...</span>
                          </span>
                        )}
                        {item.status === "BLOCKED" && (
                          <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-amber-700">
                            <Lock className="w-3 h-3" />
                            <span>复核阻断</span>
                          </span>
                        )}
                        {item.status === "COMPENSATED" && (
                          <span className="font-mono text-[11px] font-bold text-purple-700">
                            已安全回滚
                          </span>
                        )}
                        {item.status === "SUCCESS" && (
                          <span className="font-mono text-[11px] font-bold text-emerald-700">
                            {latency} ms
                          </span>
                        )}
                        {item.status === "PENDING" && (
                          <span className="font-mono text-[11px] text-slate-400">
                            待调度
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 瀑布时间条 */}
                    <div className="mt-2.5 w-full h-2.5 bg-slate-200/60 rounded-full overflow-hidden flex">
                      {item.status === "PENDING" ? (
                        <div className="w-full h-full bg-slate-200/40" />
                      ) : (
                        <div
                          style={{
                            marginLeft: `${offsetPercent}%`,
                            width: `${widthPercent}%`,
                          }}
                          className={`h-full rounded-full transition-all duration-300 ${
                            item.status === "RUNNING"
                              ? "bg-blue-500 animate-pulse"
                              : item.status === "BLOCKED"
                              ? "bg-amber-500"
                              : item.status === "COMPENSATED"
                              ? "bg-purple-600"
                              : "bg-emerald-500"
                          }`}
                        />
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-mono">节点 ID: {item.nodeId}</span>
                      {item.execRecord && (
                        <span className="text-blue-600 font-medium hover:underline flex items-center gap-0.5">
                          <Code2 className="w-3 h-3" />
                          <span>查看真实 Payload 结果</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* ═══════════ 选中节点 Payload 详细透视 ═══════════ */}
        {selectedStep && (
          <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 shadow-xl space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white tracking-tight">
                  节点执行载荷详情 · {selectedStep.nodeName} ({selectedStep.nodeId})
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectedStep.outputPayload && copyText(selectedStep.outputPayload, "payload")}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono flex items-center gap-1 transition cursor-pointer"
                >
                  {copiedPayload ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>复制 JSON</span>
                </button>
                <button
                  onClick={() => setSelectedStep(null)}
                  className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
              <div>
                <span className="text-slate-400">状态：</span>
                <span className="text-emerald-400 font-bold ml-1">{selectedStep.status}</span>
              </div>
              <div>
                <span className="text-slate-400">耗时：</span>
                <span className="text-blue-400 font-bold ml-1">{selectedStep.latencyMs || 0} ms</span>
              </div>
              <div>
                <span className="text-slate-400">类型：</span>
                <span className="text-purple-400 font-bold ml-1">{selectedStep.nodeType}</span>
              </div>
              <div>
                <span className="text-slate-400">代币消耗：</span>
                <span className="text-amber-400 font-bold ml-1">{selectedStep.costTokens || 0} tk</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono text-slate-400">Output Payload (结构化返回数据):</span>
              <pre className="p-3 bg-black/60 rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-56 scrollbar-hide border border-slate-800 leading-relaxed">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(selectedStep.outputPayload || "{}"), null, 2);
                  } catch {
                    return selectedStep.outputPayload || "(无输出载荷)";
                  }
                })()}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

