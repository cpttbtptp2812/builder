import React, { useState } from "react";
import {
  Cpu,
  ShieldAlert,
  ShieldCheck,
  Server,
  Activity,
  Layers,
  Database,
  ArrowRight,
  Zap,
  Lock,
  FileText,
  Key,
} from "lucide-react";
import { AuditLogItem } from "../../types/platform";
import SettingsPage from "./SettingsPage";
import AuditLogsPage from "../logs/AuditLogsPage";

export type SystemSettingsTab = "gateway" | "audit" | "infrastructure";

interface SystemSettingsPageProps {
  logs: AuditLogItem[];
  health: { ok: boolean; info?: any };
  onEnterWorkbench: () => void;
}

export const SystemSettingsPage: React.FC<SystemSettingsPageProps> = ({
  logs,
  health,
  onEnterWorkbench,
}) => {
  const [activeTab, setActiveTab] = useState<SystemSettingsTab>("gateway");

  const menuItems = [
    {
      id: "gateway" as SystemSettingsTab,
      label: "大模型连接配置",
      subLabel: "API Key 与模型参数",
      icon: Cpu,
      color: "text-blue-600 bg-blue-50 border-blue-200",
    },
    {
      id: "audit" as SystemSettingsTab,
      label: "系统操作日志",
      subLabel: "操作记录与工单记录",
      icon: ShieldCheck,
      color: "text-purple-600 bg-purple-50 border-purple-200",
      count: logs.length,
    },
    {
      id: "infrastructure" as SystemSettingsTab,
      label: "服务运行状态",
      subLabel: "服务健康状态检查",
      icon: Server,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[#F8FAFC] overflow-hidden">
      {/* ── 主体两栏布局：左侧系统运维导航 + 右侧独立设置工作区 ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧导航栏 */}
        <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 p-4 space-y-1">
          <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            系统设置
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all cursor-pointer ${
                  isActive
                    ? "bg-slate-100/90 text-slate-900 shadow-2xs border border-slate-300 font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">{item.label}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{item.subLabel}</div>
                  </div>
                </div>

                {item.count !== undefined && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      isActive ? "bg-slate-200 text-slate-800 font-bold" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}

          <div className="mt-auto pt-4 border-t border-slate-100">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
              <div className="font-bold text-slate-700 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>安全隔离规约：</span>
              </div>
              <p className="leading-relaxed">
                此处维护上游大模型 API Key 密钥、网关断路器熔断策略与合规存证，严格受 RBAC 鉴权保护。
              </p>
            </div>
          </div>
        </aside>

        {/* 右侧独立运维工作区 */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50">
          {activeTab === "gateway" && <SettingsPage />}

          {activeTab === "audit" && <AuditLogsPage logs={logs} />}

          {activeTab === "infrastructure" && (
            <div className="p-8 max-w-4xl mx-auto space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-800">平台基础设施与运行时诊断</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  全链路持久化服务与微服务容器探活指标
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Spring Boot 3 调度引擎</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Virtual Threads 活跃
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-500 space-y-1">
                    <div>运行时版本: Java 21 (Temurin JRE)</div>
                    <div>引擎服务端口: 8080 (HTTP / SSE)</div>
                    <div>健康状态: {health.ok ? "ONLINE (200 OK)" : "STANDBY"}</div>
                  </div>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">MySQL 8.0 核心数据库</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      HikariCP 连接就绪
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-500 space-y-1">
                    <div>目标库名: agent_db</div>
                    <div>连接池状态: 10 connections / 1 active</div>
                    <div>持久化实体: workflow_def / instances / audit</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SystemSettingsPage;

