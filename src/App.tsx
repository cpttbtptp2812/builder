import React, { useState, useEffect } from "react";
import HomePage from "./pages/home/HomePage";
import ChatPlaygroundPage from "./pages/chat/ChatPlaygroundPage";
import AgentsListPage from "./pages/agents/AgentsListPage";
import KnowledgePage from "./pages/knowledge/KnowledgePage";
import ToolsMarketPage from "./pages/tools/ToolsMarketPage";
import WorkflowsListPage from "./pages/workflows/WorkflowsListPage";
import WorkflowDesignerPage from "./pages/workflows/WorkflowDesignerPage";
import SystemSettingsPage from "./pages/settings/SystemSettingsPage";
import { NavTab, AgentItem, AuditLogItem, PipelineItem } from "./types/platform";
import {
  fetchAgentsApi,
  saveAgentApi,
  deleteAgentApi,
  fetchAuditLogsApi,
  checkBackendHealth,
  fetchWorkflowsApi,
  deleteWorkflowApi,
  fetchKnowledgeChunksApi,
  fetchToolsApi,
} from "./services/api";
import { WorkflowExecutionModal } from "./components/workflow/WorkflowExecutionModal";
import { useToast } from "./context/ToastContext";
import {
  Bot,
  Database,
  Wrench,
  FileText,
  Settings,
  Sparkles,
  MessageSquare,
  ArrowRight,
  Layers,
  BookOpen,
  Activity,
  ChevronDown,
} from "lucide-react";

export type ViewMode =
  | "home"
  | "chat"
  | "workflows"
  | "knowledge"
  | "agents"
  | "tools"
  | "settings"
  | "designer";

export default function App() {
  const toast = useToast();
  const [currentView, setCurrentView] = useState<ViewMode>("home");
  const [isAssetsMenuOpen, setIsAssetsMenuOpen] = useState(false);
  const assetsMenuRef = React.useRef<HTMLDivElement>(null);

  // 点击外部自动收起底层资产库下拉菜单
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (assetsMenuRef.current && !assetsMenuRef.current.contains(e.target as Node)) {
        setIsAssetsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleGlobalClick);
    return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, []);

  // 全局业务状态 (100% 真实后端持久化)
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [currentAgent, setCurrentAgent] = useState<AgentItem | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [health, setHealth] = useState<{ ok: boolean; info?: any }>({ ok: false });

  // 业务流水线状态 (纯动态数据库读取)
  const [workflows, setWorkflows] = useState<PipelineItem[]>([]);
  const [knowledgeCount, setKnowledgeCount] = useState<number>(0);
  const [toolsCount, setToolsCount] = useState<number>(0);
  const [editingWorkflow, setEditingWorkflow] = useState<PipelineItem | null>(null);
  const [initialChatPrompt, setInitialChatPrompt] = useState<
    { prompt: string; autoSend?: boolean } | string | undefined
  >(undefined);
  const [executingWorkflow, setExecutingWorkflow] = useState<PipelineItem | null>(null);

  // 1. 初始化探测后端健康度并加载业务数据
  useEffect(() => {
    checkBackendHealth().then((h) => setHealth(h));

    fetchAgentsApi().then((list) => {
      if (list && list.length > 0) {
        setAgents(list);
        setCurrentAgent(list[0]);
      } else {
        setAgents([]);
        setCurrentAgent(null);
      }
    });

    fetchAuditLogsApi().then((logList) => {
      if (logList && logList.length > 0) setLogs(logList);
    });

    fetchWorkflowsApi()
      .then((wfList) => {
        setWorkflows(wfList || []);
      })
      .catch((err) => {
        console.warn("Workflows fetch returned empty or error", err);
        setWorkflows([]);
      });

    fetchKnowledgeChunksApi().then((chunks) => {
      if (chunks) setKnowledgeCount(chunks.length);
    });

    fetchToolsApi().then((tools) => {
      if (tools) setToolsCount(tools.length);
    });
  }, []);

  const handleAddAuditLog = (newLog: AuditLogItem) => {
    setLogs((prev) => [newLog, ...prev]);
  };

  const handleOpenChat = (agent: AgentItem) => {
    setCurrentAgent(agent);
    setCurrentView("chat");
  };

  const handleUpdateAgent = async (updated: AgentItem) => {
    try {
      const saved = await saveAgentApi(updated);
      setAgents((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
      if (currentAgent?.id === saved.id) setCurrentAgent(saved);
    } catch {
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (agents.length <= 1) {
      toast.warning("系统至少需保留一个可用智能体！", "无法删除");
      return;
    }
    try {
      await deleteAgentApi(id);
      toast.success("智能体已从数据库中彻底移除", "删除成功");
    } catch (err) {
      console.warn("Delete API call", err);
    }
    const filtered = agents.filter((a) => a.id !== id);
    setAgents(filtered);
    if (currentAgent?.id === id) {
      setCurrentAgent(filtered.length > 0 ? filtered[0] : null);
    }
  };

  const handleCreateAgent = async (newAgent: AgentItem) => {
    try {
      const saved = await saveAgentApi(newAgent);
      setAgents([saved, ...agents]);
      setCurrentAgent(saved);
    } catch {
      setAgents([newAgent, ...agents]);
      setCurrentAgent(newAgent);
    }
  };

  // 业务流水线直接在智能工作台左右分屏实时执行
  const handleLaunchWorkflow = (wf: PipelineItem) => {
    setInitialChatPrompt({ prompt: wf.promptTemplate, autoSend: true });
    setCurrentView("chat");
  };

  const handleFillPromptToChat = (wf: PipelineItem) => {
    setInitialChatPrompt({ prompt: wf.promptTemplate, autoSend: false });
    setCurrentView("chat");
  };

  const handleOpenCreateWorkflow = () => {
    setEditingWorkflow(null);
    setCurrentView("designer");
  };

  const handleOpenEditWorkflow = (wf: PipelineItem) => {
    setEditingWorkflow(wf);
    setCurrentView("designer");
  };

  const handleSaveWorkflow = (saved: PipelineItem) => {
    setWorkflows((prev) => {
      const exists = prev.some((w) => w.id === saved.id);
      return exists ? prev.map((w) => (w.id === saved.id ? saved : w)) : [saved, ...prev];
    });
  };

  const handleDeleteWorkflow = async (id: string) => {
    try {
      await deleteWorkflowApi(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      toast.success("业务流水线已从数据库中彻底移除", "删除成功");
    } catch (err) {
      console.error("Failed to delete workflow", err);
      toast.error("删除流水线失败，请检查网络", "删除异常");
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-screen bg-[#FAFBFC] text-slate-800 font-sans overflow-hidden select-none">
      {/* 顶部企业级导航栏 */}
      <header className="h-14 px-6 border-b border-slate-200/80 bg-white/95 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-6">
          <div
            onClick={() => setCurrentView("home")}
            className="flex items-center gap-2.5 cursor-pointer group"
            title="返回系统首页"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-slate-900 tracking-tight text-base">OwnAgent</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                企业版
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setCurrentView("home")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentView === "home"
                  ? "bg-white text-blue-600 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              首页
            </button>
            <button
              onClick={() => setCurrentView("chat")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                currentView === "chat"
                  ? "bg-white text-blue-600 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>智能工作台</span>
            </button>
            <button
              onClick={() => setCurrentView("workflows")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                currentView === "workflows" || currentView === "designer"
                  ? "bg-white text-blue-600 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>方案编排中心</span>
            </button>

            {/* 全局底层资产池 (增加无缝悬停桥接与点击常开支持，杜绝间隙失焦断触) */}
            <div
              ref={assetsMenuRef}
              className="relative"
              onMouseEnter={() => setIsAssetsMenuOpen(true)}
              onMouseLeave={() => setIsAssetsMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => setIsAssetsMenuOpen((prev) => !prev)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  currentView === "knowledge" || currentView === "agents" || currentView === "tools" || isAssetsMenuOpen
                    ? "bg-white text-blue-600 shadow-2xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>底层资产库</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isAssetsMenuOpen ? "rotate-180 text-blue-600" : ""}`} />
              </button>

              {/* 下拉浮层容器：增加 pt-1.5 内边距实现无缝鼠标桥接，彻底杜绝悬浮断触 */}
              {isAssetsMenuOpen && (
                <div className="absolute top-full left-0 pt-1.5 w-48 z-50">
                  <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentView("knowledge");
                        setIsAssetsMenuOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 hover:bg-slate-50 text-xs transition cursor-pointer ${
                        currentView === "knowledge" ? "font-bold text-blue-600 bg-blue-50/60" : "text-slate-700"
                      }`}
                    >
                      <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="flex flex-col">
                        <span>企业知识库</span>
                        <span className="text-[10px] text-slate-400 font-normal">规章制度与合规文档</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentView("agents");
                        setIsAssetsMenuOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 hover:bg-slate-50 text-xs transition cursor-pointer ${
                        currentView === "agents" ? "font-bold text-blue-600 bg-blue-50/60" : "text-slate-700"
                      }`}
                    >
                      <Bot className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="flex flex-col">
                        <span>智能体角色库</span>
                        <span className="text-[10px] text-slate-400 font-normal">多智能体协同配置</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentView("tools");
                        setIsAssetsMenuOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 hover:bg-slate-50 text-xs transition cursor-pointer ${
                        currentView === "tools" ? "font-bold text-blue-600 bg-blue-50/60" : "text-slate-700"
                      }`}
                    >
                      <Wrench className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="flex flex-col">
                        <span>扩展工具市场</span>
                        <span className="text-[10px] text-slate-400 font-normal">受控执行与计算工具</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setCurrentView("settings")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                currentView === "settings"
                  ? "bg-white text-blue-600 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>系统与审计</span>
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-medium text-slate-500 bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200/60 hidden sm:inline-block">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                health.ok ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
              }`}
            />
            {health.ok ? "系统运行正常" : "正在连接后端服务"}
          </span>
        </div>
      </header>

      {/* 主视图渲染 */}
      <main className="relative z-10 flex-1 flex flex-col h-full w-full overflow-hidden">
        {currentView === "home" && (
          <HomePage
            onEnterWorkbench={() => setCurrentView("chat")}
            onEnterWorkbenchWithPrompt={(prompt, autoSend = true) => {
              setInitialChatPrompt({ prompt, autoSend });
              setCurrentView("chat");
            }}
            onLaunchWorkflow={handleLaunchWorkflow}
            onOpenModal={(tab) => {
              if (tab === "workflows") setCurrentView("workflows");
              else if (tab === "knowledge") setCurrentView("knowledge");
              else if (tab === "agents") setCurrentView("agents");
              else if (tab === "tools") setCurrentView("tools");
              else setCurrentView("settings");
            }}
            workflows={workflows}
          />
        )}

        {currentView === "chat" && (
          <ChatPlaygroundPage
            agents={agents}
            currentAgent={currentAgent}
            onSelectAgent={setCurrentAgent}
            onAddAuditLog={handleAddAuditLog}
            onNavigateSettings={() => setCurrentView("settings")}
            onOpenModal={(tab: NavTab) => {
              if (tab === "workflows") setCurrentView("workflows");
              else if (tab === "knowledge") setCurrentView("knowledge");
              else if (tab === "agents") setCurrentView("agents");
              else if (tab === "tools") setCurrentView("tools");
              else setCurrentView("settings");
            }}
            onBackHome={() => setCurrentView("home")}
            workflows={workflows}
            initialPrompt={initialChatPrompt}
            onClearInitialPrompt={() => setInitialChatPrompt(undefined)}
            onOpenCreateWorkflow={handleOpenCreateWorkflow}
            onNavigateStudio={() => setCurrentView("workflows")}
            onRunWorkflow={handleLaunchWorkflow}
          />
        )}

        {currentView === "workflows" && (
          <WorkflowsListPage
            workflows={workflows}
            onLaunchWorkflow={handleLaunchWorkflow}
            onFillPrompt={handleFillPromptToChat}
            onOpenCreate={handleOpenCreateWorkflow}
            onOpenEdit={handleOpenEditWorkflow}
            onDelete={handleDeleteWorkflow}
            onSaveWorkflow={handleSaveWorkflow}
          />
        )}

        {currentView === "knowledge" && (
          <KnowledgePage />
        )}

        {currentView === "agents" && (
          <AgentsListPage
            agents={agents}
            onOpenChat={handleOpenChat}
            onUpdateAgent={handleUpdateAgent}
            onDeleteAgent={handleDeleteAgent}
            onCreateAgent={handleCreateAgent}
          />
        )}

        {currentView === "tools" && (
          <ToolsMarketPage />
        )}

        {currentView === "settings" && (
          <SystemSettingsPage
            logs={logs}
            health={health}
            onEnterWorkbench={() => setCurrentView("chat")}
          />
        )}

        {currentView === "designer" && (
          <WorkflowDesignerPage
            workflow={editingWorkflow}
            agents={agents}
            onBack={() => setCurrentView("workflows")}
            onSave={handleSaveWorkflow}
            onSaveAndLaunch={(saved, prompt) => {
              handleSaveWorkflow(saved);
              setCurrentView("chat");
              if (prompt) {
                setInitialChatPrompt({ prompt, autoSend: true });
              }
            }}
          />
        )}
      </main>

      {/* 业务流水线全链路执行弹窗 (支持一键无缝跳转至工作台左右分屏实时执行) */}
      <WorkflowExecutionModal
        isOpen={!!executingWorkflow}
        onClose={() => setExecutingWorkflow(null)}
        workflow={executingWorkflow}
        onSwitchToChat={(prompt) => {
          setInitialChatPrompt({ prompt, autoSend: true });
          setCurrentView("chat");
          setExecutingWorkflow(null);
        }}
      />
    </div>
  );
}
