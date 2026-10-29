import React from "react";
import {
  MessageSquare,
  Bot,
  Database,
  Wrench,
  FileText,
  Settings,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { NavTab } from "../../types/platform";

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  agentsCount: number;
  docsCount: number;
}

export default function Sidebar({ currentTab, onSelectTab, agentsCount, docsCount }: SidebarProps) {
  const menuItems: Array<{
    id: NavTab;
    label: string;
    icon: any;
    badge?: string | number;
  }> = [
    {
      id: "chat",
      label: "ownagent 对话",
      icon: MessageSquare,
    },
    {
      id: "agents",
      label: "专家技能库",
      icon: Bot,
      badge: agentsCount,
    },
    {
      id: "knowledge",
      label: "知识资源库",
      icon: Database,
      badge: docsCount,
    },
    {
      id: "tools",
      label: "插件与工具",
      icon: Wrench,
    },
    {
      id: "logs",
      label: "全链路审计",
      icon: FileText,
    },
    {
      id: "settings",
      label: "系统与凭证",
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 bg-white/80 backdrop-blur-xl border-r border-slate-200/80 flex flex-col justify-between flex-shrink-0 z-30 select-none">
      <div>
        {/* 系统 Brand Header (彻底统一为 ownagent) */}
        <div className="h-16 border-b border-slate-100 px-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-black text-slate-900 tracking-tight">ownagent</div>
            <div className="text-[10px] text-slate-400 font-medium">企业级自主智能体中台</div>
          </div>
        </div>

        {/* 导航菜单列表 (对齐 tianyangAgent: h-12 胶囊项与圆角 2xl) */}
        <nav className="p-3.5 space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`group relative flex h-12 w-full items-center justify-between rounded-2xl px-4 text-xs font-semibold transition-all duration-300 ease-out ${
                  isActive
                    ? "bg-blue-50 text-blue-600 shadow-xs"
                    : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={18}
                    strokeWidth={isActive ? 2.3 : 2.0}
                    className={`shrink-0 transition-transform duration-300 ${
                      isActive ? "scale-105 text-blue-600" : "text-slate-400 group-hover:scale-110 group-hover:text-slate-700"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono transition ${
                      isActive ? "bg-blue-100 text-blue-700 font-bold" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 底部账户与集群状态 */}
      <div className="p-4 border-t border-slate-100/80 space-y-2.5">
        <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between hover:bg-slate-100/60 transition">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white text-xs flex items-center justify-center font-bold shadow-xs">
              OA
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">ownagent 核心</div>
              <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>ownsudo 集群就绪</span>
              </div>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 text-center font-sans">
          ownagent 企业级智能中枢平台
        </div>
      </div>
    </aside>
  );
}
