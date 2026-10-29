import React, { useState } from "react";
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  Coins,
  ShieldCheck,
  Activity,
  Layers,
  XCircle,
} from "lucide-react";
import { AuditLogItem } from "../../types/platform";

interface AuditLogsPageProps {
  logs: AuditLogItem[];
}

export default function AuditLogsPage({ logs }: AuditLogsPageProps) {
  const [filter, setFilter] = useState("ALL");

  const filtered = logs.filter((l) => (filter === "ALL" ? true : l.status === filter));
  const totalTokens = logs.reduce((sum, l) => (sum || 0) + (l.tokensIn || 0) + (l.tokensOut || 0), 0);

  const avgLatency =
    logs.length > 0
      ? (
          logs.reduce((sum, l) => {
            const num = parseFloat(l.duration) || 0;
            return sum + (l.duration?.includes("s") && !l.duration?.includes("ms") ? num * 1000 : num);
          }, 0) / logs.length
        ).toFixed(0) + " ms"
      : "0 ms";

  const successCount = logs.filter((l) => l.status === "SUCCESS").length;
  const availabilityRate =
    logs.length > 0 ? ((successCount / logs.length) * 100).toFixed(1) + "%" : "100.0%";

  return (
    <div className="flex-1 overflow-y-auto p-8 relative scrollbar-hide">
      <div className="max-w-6xl mx-auto space-y-7">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-purple-600 uppercase tracking-wider bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">
              Observability & Audit
            </span>
            <span className="text-xs text-slate-400">· 全链路追踪与可观测大盘 (真实持久化)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">全链路审计日志</h1>
          <p className="text-xs text-slate-500 mt-1">
            追踪每一次智能体对话、Function Calling 工具执行与向量切片检索的端到端耗时与 Token 明细
          </p>
        </div>

        {/* 顶部指标统计卡片 (真实根据 logs 动态计算，零写死) */}
        <div className="grid grid-cols-4 gap-5">
          <div className="bg-white/90 backdrop-blur-md p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-semibold">总调用请求数</div>
              <div className="text-2xl font-black text-slate-900 mt-1.5 font-mono">{logs.length} 次</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-md p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-semibold">平均执行延迟</div>
              <div className="text-2xl font-black text-blue-600 mt-1.5 font-mono">{avgLatency}</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-md p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-semibold">执行可用率</div>
              <div className="text-2xl font-black text-emerald-600 mt-1.5 font-mono">{availabilityRate}</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-md p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-semibold">累计消耗 Token</div>
              <div className="text-2xl font-black text-amber-600 mt-1.5 font-mono">{totalTokens}</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Coins className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 审计日志大表格 */}
        <div className="bg-white/90 backdrop-blur-md rounded-[2rem] border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">状态过滤:</span>
              <button
                onClick={() => setFilter("ALL")}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold transition ${
                  filter === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setFilter("SUCCESS")}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold transition ${
                  filter === "SUCCESS" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                成功
              </button>
              <button
                onClick={() => setFilter("ABORTED")}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold transition ${
                  filter === "ABORTED" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                熔断中断
              </button>
            </div>
            <span className="text-xs text-slate-400 font-mono">安全审计数据库实时记录</span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80 font-semibold">
              <tr>
                <th className="py-3.5 px-6">调用时间</th>
                <th className="py-3.5 px-6">目标 / 工具名</th>
                <th className="py-3.5 px-6">事件类型</th>
                <th className="py-3.5 px-6">入参 JSON / 模型</th>
                <th className="py-3.5 px-6">耗时</th>
                <th className="py-3.5 px-6">真实 Token (入/出)</th>
                <th className="py-3.5 px-6 text-right">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    暂无审计日志，进行智能体对话或执行工具后将实时入库记录。
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-6 font-mono text-slate-500">{log.time}</td>
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {log.eventType === "TOOL_CALL" ? (
                        <span className="text-purple-600 font-mono flex items-center gap-1">
                          🔧 {log.toolName || log.agentName}
                        </span>
                      ) : (
                        log.agentName
                      )}
                    </td>
                    <td className="py-3.5 px-6 font-mono text-indigo-600 font-semibold">{log.eventType}</td>
                    <td className="py-3.5 px-6 font-mono text-slate-500 max-w-[200px] truncate" title={log.parameters || log.model}>
                      {log.parameters ? log.parameters : log.model}
                    </td>
                    <td className="py-3.5 px-6 font-mono text-slate-800 font-bold">{log.duration}</td>
                    <td className="py-3.5 px-6 font-mono text-slate-600">
                      {log.isRealUsage ? (
                        <span className="text-amber-600 font-bold">
                          {log.tokensIn} / {log.tokensOut} (供应商)
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-- (免虚标)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      {log.status === "SUCCESS" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-bold border border-emerald-100">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 成功
                        </span>
                      ) : log.status === "ABORTED" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-bold border border-amber-200">
                          ⚡ 物理熔断
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-red-600 bg-red-50 px-2.5 py-1 rounded-full font-bold border border-red-100">
                          <XCircle className="w-3.5 h-3.5" /> 异常
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
