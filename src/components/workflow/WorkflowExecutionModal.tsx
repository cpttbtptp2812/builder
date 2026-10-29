import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Play,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Database,
  Terminal,
  Zap,
  RotateCcw,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { PipelineItem } from "../../types/platform";
import {
  runWorkflowApi,
  fetchWorkflowInstanceApi,
  commitWorkflowApprovalApi,
} from "../../services/api";
import { useToast } from "@/context/ToastContext";

interface WorkflowExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflow: PipelineItem | null;
  onSwitchToChat?: (prompt: string) => void;
}

interface StepLog {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "BLOCKED" | "FAILED" | "COMPENSATED";
  latencyMs?: number;
  costTokens?: number;
  outputPayload?: any;
}

export const WorkflowExecutionModal: React.FC<WorkflowExecutionModalProps> = ({
  isOpen,
  onClose,
  workflow,
  onSwitchToChat,
}) => {
  const toast = useToast();
  const [testPayload, setTestPayload] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [stepLogs, setStepLogs] = useState<StepLog[]>([]);
  const [instanceStatus, setInstanceStatus] = useState<string>("IDLE");
  const [pendingTicket, setPendingTicket] = useState<{
    id: string;
    operationSummary?: string;
    riskScore?: number;
    policyLevel?: string;
  } | null>(null);
  const [merkleRoot, setMerkleRoot] = useState<string | null>(null);
  const [finalSummary, setFinalSummary] = useState<string | null>(null);
  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    if (workflow) {
      setTestPayload(
        workflow.promptTemplate || ""
      );
      setStepLogs([]);
      setInstanceId(null);
      setInstanceStatus("IDLE");
      setPendingTicket(null);
      setMerkleRoot(null);
      setFinalSummary(null);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [workflow, isOpen]);

  if (!isOpen || !workflow) return null;

  const startPipelineRun = async () => {
    setIsExecuting(true);
    setStepLogs([]);
    setPendingTicket(null);
    setMerkleRoot(null);
    setFinalSummary(null);
    setInstanceStatus("RUNNING");

    try {
      const res = await runWorkflowApi({
        workflowId: workflow.id,
        inputParams: testPayload,
        triggeredBy: "workbench_waterfall_runner",
      });

      const newInstId = res.instanceId;
      setInstanceId(newInstId);

      // 启动真实轮询拉取节点执行瀑布流
      pollInstance(newInstId);
    } catch (err: any) {
      toast.error(err.message || String(err), "启动流水线失败");
      setIsExecuting(false);
      setInstanceStatus("FAILED");
    }
  };

  const pollInstance = (id: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const detail = await fetchWorkflowInstanceApi(id);
        const inst = detail.instance;
        const steps = detail.steps || [];

        const logs: StepLog[] = steps.map((s) => {
          let parsedOutput: any = s.outputPayload;
          try {
            if (typeof s.outputPayload === "string" && s.outputPayload.startsWith("{")) {
              parsedOutput = JSON.parse(s.outputPayload);
            }
          } catch {}
          return {
            nodeId: s.nodeId,
            nodeName: s.nodeName || s.nodeId,
            nodeType: s.nodeType,
            status: s.status as any,
            latencyMs: s.latencyMs,
            costTokens: s.costTokens,
            outputPayload: parsedOutput,
          };
        });

        setStepLogs(logs);
        setInstanceStatus(inst.status);

        // 检测是否挂起等待人工审批
        if (inst.status === "SUSPENDED_APPROVAL" || inst.status === "SUSPENDED") {
          setIsExecuting(false);
          try {
            const pendingRes = await fetch("/api/workflow/approvals/pending");
            if (pendingRes.ok) {
              const tickets = await pendingRes.json();
              const myTicket = tickets.find((t: any) => t.instanceId === id);
              if (myTicket) {
                setPendingTicket({
                  id: myTicket.id,
                  operationSummary: myTicket.operationSummary,
                  riskScore: myTicket.riskScore,
                  policyLevel: myTicket.policyLevel,
                });
              }
            }
          } catch {}
        } else if (inst.status === "COMPLETED") {
          setIsExecuting(false);
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;

          // 提取最终汇总与存证哈希
          const lastStep = steps[steps.length - 1];
          if (lastStep?.outputPayload) {
            try {
              const p = JSON.parse(lastStep.outputPayload);
              if (p.merkleRoot) setMerkleRoot(p.merkleRoot);
              if (p.summary) setFinalSummary(p.summary);
            } catch {}
          }
        } else if (inst.status === "FAILED" || inst.status === "REJECTED_ROLLED_BACK") {
          setIsExecuting(false);
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      } catch (e) {
        console.warn("轮询异常", e);
      }
    }, 600);
  };

  const handleDecision = async (decision: "APPROVE" | "REJECT") => {
    if (!pendingTicket) return;
    try {
      await commitWorkflowApprovalApi({
        ticketId: pendingTicket.id,
        decision,
        operatorId: "admin",
        auditReason: decision === "APPROVE" ? "人工审核通过，准予继续执行" : "规则未通过，操作已阻断",
      });
      setPendingTicket(null);
      setIsExecuting(true);
      // 继续轮询
      if (instanceId) {
        pollInstance(instanceId);
      }
    } catch (err: any) {
      toast.error(err.message, "提交审批决断失败");
    }
  };

  const totalDurationMs = stepLogs.reduce((acc, cur) => acc + (cur.latencyMs || 0), 0);

  // 状态中文映射
  const getStatusDisplay = (st: string) => {
    switch (st) {
      case "IDLE":
        return { text: "待启动", color: "bg-slate-100 text-slate-700" };
      case "RUNNING":
        return { text: "流水线执行中", color: "bg-blue-100 text-blue-800 animate-pulse" };
      case "SUSPENDED_APPROVAL":
      case "SUSPENDED":
        return { text: "已拦截 · 等待人工复核", color: "bg-rose-100 text-rose-800 font-bold animate-pulse" };
      case "COMPLETED":
        return { text: "全流程合规执行完毕", color: "bg-emerald-100 text-emerald-800 font-bold" };
      case "REJECTED_ROLLED_BACK":
        return { text: "人工驳回 · 已安全回滚", color: "bg-amber-100 text-amber-800 font-bold" };
      case "FAILED":
        return { text: "执行异常", color: "bg-rose-100 text-rose-800" };
      default:
        return { text: st, color: "bg-slate-100 text-slate-700" };
    }
  };

  const statusDisplay = getStatusDisplay(instanceStatus);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* 顶部标题栏 */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  {workflow.name}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  {workflow.version || "v2.0"}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  端到端受控执行
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                {workflow.description}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 核心内容区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-hide">
          {/* 指令参数输入区 */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-blue-600" />
                <span>输入测试内容：</span>
              </span>
              {workflow.promptTemplate && (
                <button
                  type="button"
                  onClick={() => setTestPayload(workflow.promptTemplate)}
                  className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                >
                  填入默认指令
                </button>
              )}
            </div>

            <textarea
              rows={2}
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              disabled={isExecuting}
              className="w-full text-xs bg-white border border-slate-200 rounded-xl p-3 text-slate-800 outline-none focus:border-blue-500 transition leading-relaxed resize-none font-sans"
            />

            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                <span>运行状态:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusDisplay.color}`}>
                  {statusDisplay.text}
                </span>
                {instanceId && <span className="text-slate-400 font-mono">(ID: {instanceId})</span>}
              </div>

              <div className="flex items-center gap-2">
                {onSwitchToChat && (
                  <button
                    onClick={() => {
                      onSwitchToChat(testPayload);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                    title="在工作台通过多轮自然语言对话来驱动"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    <span>转入工作台对话</span>
                  </button>
                )}

                <button
                  onClick={startPipelineRun}
                  disabled={isExecuting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isExecuting ? "流水线正在调度..." : "启动流水线真实推演"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 高危操作专职人工复核卡片 */}
          {pendingTicket && (
            <div className="p-4.5 bg-rose-50 border border-rose-300 rounded-2xl shadow-sm space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5 text-rose-600 animate-pulse" />
                  <span>【触发高危操作拦截】流水线已暂停 · 等待负责人人工复核</span>
                </div>
                <span className="font-mono text-xs font-bold bg-rose-200 text-rose-900 px-2.5 py-0.5 rounded-full">
                  工单: {pendingTicket.id}
                </span>
              </div>

              <div className="p-3 bg-white/90 border border-rose-200 rounded-xl text-xs space-y-1.5 text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">拦截事项:</span>
                  <span className="font-semibold text-rose-700">{pendingTicket.operationSummary || "指令涉及高危写操作或预算超限"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">安全级别:</span>
                  <span className="font-semibold text-rose-600">{pendingTicket.policyLevel || "P1_HIGH"} (风险系数: {pendingTicket.riskScore || 0.08})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">签批授权人:</span>
                  <span className="font-semibold text-slate-900">部门主管 / 安全合规责任人</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={() => handleDecision("REJECT")}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>❌ 驳回操作并自动安全回滚</span>
                </button>
                <button
                  onClick={() => handleDecision("APPROVE")}
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>✅ 确认核准并继续执行后续步骤</span>
                </button>
              </div>
            </div>
          )}

          {/* 瀑布流执行节点甘特明细 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>流水线执行节点瀑布流 (Pipeline Execution Steps)</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500">
                物理实测耗时: <strong className="text-blue-700">{totalDurationMs}ms</strong>
              </span>
            </div>

            {stepLogs.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs space-y-1">
                <p>点击上方「启动流水线真实推演」按钮开始执行</p>
                <p className="text-[11px] text-slate-400">系统将调用后端真实调度引擎，严格按业务步骤推进与核验</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {stepLogs.map((step, idx) => {
                  const isSuccess = step.status === "SUCCESS";
                  const isBlocked = step.status === "BLOCKED";
                  const isCompensated = step.status === "COMPENSATED";
                  const isFailed = step.status === "FAILED";

                  return (
                    <div
                      key={step.nodeId || idx}
                      className={`p-3.5 rounded-2xl border transition-all text-xs space-y-2 ${
                        isSuccess
                          ? "bg-white border-emerald-200 shadow-2xs"
                          : isBlocked
                          ? "bg-rose-50/70 border-rose-300 shadow-sm"
                          : isCompensated
                          ? "bg-amber-50/70 border-amber-300"
                          : isFailed
                          ? "bg-rose-50 border-rose-200"
                          : "bg-blue-50/50 border-blue-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono text-white ${
                            isSuccess
                              ? "bg-emerald-500"
                              : isBlocked
                              ? "bg-rose-500 animate-pulse"
                              : isCompensated
                              ? "bg-amber-500"
                              : isFailed
                              ? "bg-rose-600"
                              : "bg-blue-500"
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-900">{step.nodeName}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                            {step.nodeType}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          <span className="text-slate-400 font-sans">耗时: {step.latencyMs || 0}ms</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold ${
                            isSuccess
                              ? "bg-emerald-100 text-emerald-800"
                              : isBlocked
                              ? "bg-rose-100 text-rose-800"
                              : isCompensated
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {step.status === "SUCCESS"
                              ? "✓ 成功"
                              : step.status === "BLOCKED"
                              ? "⚠ 拦截"
                              : step.status === "COMPENSATED"
                              ? "↺ 已回滚"
                              : step.status}
                          </span>
                        </div>
                      </div>

                      {step.outputPayload && (
                        <div className="p-2.5 bg-slate-50 rounded-xl font-mono text-[11px] text-slate-700 whitespace-pre-wrap break-all border border-slate-200/60 max-h-36 overflow-y-auto">
                          {typeof step.outputPayload === "object"
                            ? JSON.stringify(step.outputPayload, null, 2)
                            : String(step.outputPayload)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 终态汇总与审计防伪摘要 */}
          {(merkleRoot || finalSummary) && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs space-y-2">
              <div className="flex items-center justify-between font-bold text-emerald-900">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>全链路执行完毕 · 业务审计流水已签发存证</span>
                </span>
                <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  AUDIT_COMMITTED
                </span>
              </div>
              {merkleRoot && (
                <div className="font-mono text-[11px] text-slate-700 bg-white p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-slate-400 block text-[10px] mb-0.5">防伪审计数字摘要 (SHA-256 Digest)：</span>
                  <span className="font-bold text-emerald-800 select-all">{merkleRoot}</span>
                </div>
              )}
              {finalSummary && (
                <p className="text-slate-600 leading-relaxed pt-1">
                  {finalSummary}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 底部操作条 */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <span className="text-[11px] text-slate-400">
            OwnAgent 真实业务引擎驱动
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            关闭推演台
          </button>
        </div>
      </div>
    </div>
  );
};
export default WorkflowExecutionModal;
