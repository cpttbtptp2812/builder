import React, { useState, useEffect } from "react";
import HomePage from "./pages/home/HomePage";
import ChatPlaygroundPage from "./pages/chat/ChatPlaygroundPage";
import AgentsListPage from "./pages/agents/AgentsListPage";
import KnowledgePage from "./pages/knowledge/KnowledgePage";
import ToolsMarketPage from "./pages/tools/ToolsMarketPage";
import AuditLogsPage from "./pages/logs/AuditLogsPage";
import SettingsPage from "./pages/settings/SettingsPage";
import WorkflowsListPage from "./pages/workflows/WorkflowsListPage";
import PipelineConfigModal from "./components/workflow/PipelineConfigModal";
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
import {
  Bot,
  Database,
  Wrench,
  FileText,
  Settings,
  Sparkles,
  MessageSquare,
  ArrowRight,
  X,
  Layers,
} from "lucide-react";

export default function App() {
  const [currentView, setCurrentView] = useState<"home" | "chat">("home");
  const [currentTab, setCurrentTab] = useState<NavTab>("chat");

  // 全局业务数据状态 (100% 真实后端持久化)
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [currentAgent, setCurrentAgent] = useState<AgentItem | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [health, setHealth] = useState<{ ok: boolean; info?: any }>({ ok: false });

  // 业务流水线与指标状态 (100% 数据库持久化)
  const [workflows, setWorkflows] = useState<PipelineItem[]>([]);
  const [knowledgeCount, setKnowledgeCount] = useState<number>(0);
  const [toolsCount, setToolsCount] = useState<number>(0);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<PipelineItem | null>(null);
  const [initialChatPrompt, setInitialChatPrompt] = useState<string | undefined>(undefined);

  // 类似豆包/元宝的全局设置弹窗模式 (当打开 非chat 页面时，以模态抽屉/弹出层呈现，绝不污染主页纯净大对话框)
  const [activeModal, setActiveModal] = useState<NavTab | null>(null);

  // 1. 页面挂载时从真实后端探活并拉取智能体、业务流水线与审计日志
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
      if (logList && logList.length > 0) {
        setLogs(logList);
      }
    });

    fetchWorkflowsApi().then((wfList) => {
      if (wfList && wfList.length > 0) {
        setWorkflows(wfList);
      }
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
    setActiveModal(null);
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
      alert("请至少保留一个智能体！");
      return;
    }
    try {
      await deleteAgentApi(id);
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

  // 业务流水线管理动作
  const handleLaunchWorkflow = (wf: PipelineItem) => {
    setInitialChatPrompt(wf.promptTemplate);
    setCurrentView("chat");
    setActiveModal(null);
  };

  const handleOpenCreateWorkflow = () => {
    setEditingWorkflow(null);
    setIsWorkflowModalOpen(true);
  };

  const handleOpenEditWorkflow = (wf: PipelineItem) => {
    setEditingWorkflow(wf);
    setIsWorkflowModalOpen(true);
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
    } catch (err) {
      console.error("Failed to delete workflow", err);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-screen bg-[#FAFBFC] text-slate-800 font-sans overflow-hidden select-none">
      {/* ────────────────── 全站统一 SaaS 顶部导航栏 ────────────────── */}
      <header className="h-14 px-6 border-b border-slate-200/80 bg-white/95 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-6">
          <div
            onClick={() => setCurrentView("home")}
            className="flex items-center gap-2.5 cursor-pointer group"
            title="返回系统首页门户"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-slate-900 tracking-tight text-base">OwnAgent</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                v2.4
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
              平台首页
            </button>
            <button
              onClick={() => setCurrentView("chat")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentView === "chat"
                  ? "bg-white text-blue-600 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              智能工作台
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveModal("settings")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
            title="打开系统控制中心"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>系统控制中心</span>
          </button>

          {currentView === "home" ? (
            <button
              onClick={() => setCurrentView("chat")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              <span>进入工作台</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </header>

      {/* ────────────────── 核心主视窗容器 ────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col h-full w-full overflow-hidden">
        {currentView === "home" ? (
          <HomePage
            onEnterWorkbench={() => setCurrentView("chat")}
            onOpenModal={(tab) => setActiveModal(tab)}
            onOpenFinOps={() => {
              setCurrentView("chat");
            }}
            workflows={workflows}
            onLaunchWorkflow={handleLaunchWorkflow}
            onOpenCreateWorkflow={handleOpenCreateWorkflow}
            onOpenEditWorkflow={handleOpenEditWorkflow}
            onDeleteWorkflow={handleDeleteWorkflow}
            agentsCount={agents.length}
            knowledgeCount={knowledgeCount}
            toolsCount={toolsCount}
            logsCount={logs.length}
          />
        ) : (
          <ChatPlaygroundPage
            agents={agents}
            currentAgent={currentAgent}
            onSelectAgent={setCurrentAgent}
            onAddAuditLog={handleAddAuditLog}
            onNavigateSettings={() => setActiveModal("settings")}
            onOpenModal={(tab: NavTab) => setActiveModal(tab)}
            onBackHome={() => setCurrentView("home")}
            workflows={workflows}
            initialPrompt={initialChatPrompt}
            onClearInitialPrompt={() => setInitialChatPrompt(undefined)}
            onOpenCreateWorkflow={handleOpenCreateWorkflow}
          />
        )}
      </main>

      {/* ────────────────── 3. 模态弹出层 (智能体、知识库、工具、设置全部在弹窗内优雅处理) ────────────────── */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4 sm:p-6 lg:p-10">
          <div className="relative w-full max-w-5xl h-[85vh] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* 弹窗顶栏 */}
            <div className="h-14 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-4">
                <span className="text-sm font-black text-slate-800">控制中心</span>

                {/* 固定位置的选项卡 */}
                <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setActiveModal("settings")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeModal === "settings"
                        ? "bg-white text-blue-600 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    模型接入
                  </button>
                  <button
                    onClick={() => setActiveModal("workflows")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeModal === "workflows"
                        ? "bg-white text-blue-600 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    业务流水线
                  </button>
                  <button
                    onClick={() => setActiveModal("agents")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeModal === "agents"
                        ? "bg-white text-blue-600 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    智能体
                  </button>
                  <button
                    onClick={() => setActiveModal("knowledge")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeModal === "knowledge"
                        ? "bg-white text-blue-600 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    知识库
                  </button>
                  <button
                    onClick={() => setActiveModal("tools")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeModal === "tools"
                        ? "bg-white text-blue-600 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    工具
                  </button>
                  <button
                    onClick={() => setActiveModal("logs")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeModal === "logs"
                        ? "bg-white text-blue-600 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    日志
                  </button>
                </div>
              </div>

              {/* 关闭弹窗返回主页面 */}
              <button
                onClick={() => {
                  setActiveModal(null);
                  window.dispatchEvent(new Event("system-config-updated"));
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
                title="关闭并返回对话"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 弹窗内容工作区 */}
            <div className="flex-1 overflow-y-auto">
              {activeModal === "workflows" && (
                <WorkflowsListPage
                  workflows={workflows}
                  onLaunchWorkflow={handleLaunchWorkflow}
                  onOpenCreate={handleOpenCreateWorkflow}
                  onOpenEdit={handleOpenEditWorkflow}
                  onDelete={handleDeleteWorkflow}
                />
              )}

              {activeModal === "agents" && (
                <AgentsListPage
                  agents={agents}
                  onOpenChat={handleOpenChat}
                  onUpdateAgent={handleUpdateAgent}
                  onDeleteAgent={handleDeleteAgent}
                  onCreateAgent={handleCreateAgent}
                />
              )}

              {activeModal === "knowledge" && <KnowledgePage />}

              {activeModal === "tools" && <ToolsMarketPage />}

              {activeModal === "logs" && <AuditLogsPage logs={logs} />}

              {activeModal === "settings" && <SettingsPage />}
            </div>
          </div>
        </div>
      )}

      {/* 4. 流水线增改配置弹窗 */}
      <PipelineConfigModal
        isOpen={isWorkflowModalOpen}
        onClose={() => setIsWorkflowModalOpen(false)}
        initialPipeline={editingWorkflow}
        onSaved={handleSaveWorkflow}
      />
    </div>
  );
}
