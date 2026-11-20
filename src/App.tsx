import React, { useState, useEffect, useRef } from "react";
import ChatPlaygroundPage from "./pages/chat/ChatPlaygroundPage";
import WorkflowsListPage from "./pages/workflows/WorkflowsListPage";
import WorkflowDesignerPage from "./pages/workflows/WorkflowDesignerPage";
import SystemSettingsPage from "./pages/settings/SystemSettingsPage";
import KnowledgePage from "./pages/knowledge/KnowledgePage";
import AgentsListPage from "./pages/agents/AgentsListPage";
import ToolsMarketPage from "./pages/tools/ToolsMarketPage";
import EvaluationPage from "./pages/evaluation/EvaluationPage";
import RunsPage from "./pages/runs/RunsPage";
import IntegrationsPage from "./pages/integrations/IntegrationsPage";
import {
  NavTab,
  AgentItem,
  AuditLogItem,
  PipelineItem,
  DEFAULT_ENTERPRISE_WORKFLOWS,
} from "./types/platform";
import {
  fetchAgentsApi,
  saveAgentApi,
  deleteAgentApi,
  fetchAuditLogsApi,
  checkBackendHealth,
  fetchWorkflowsApi,
  deleteWorkflowApi,
  saveWorkflowApi,
} from "./services/api";
import { WorkflowExecutionModal } from "./components/workflow/WorkflowExecutionModal";
import { useToast } from "./context/ToastContext";
import {
  Button,
  Tag,
  Tooltip,
} from "antd";
import {
  MessageOutlined,
  SettingOutlined,
  DeploymentUnitOutlined,
  LineChartOutlined,
} from "@ant-design/icons";

export type ViewMode =
  | "chat"
  | "workflows"
  | "knowledge"
  | "agents"
  | "tools"
  | "settings"
  | "designer"
  | "evaluation"
  | "runs"
  | "integrations";

export default function App() {
  const toast = useToast();
  const [currentView, setCurrentView] = useState<ViewMode>("chat");
  const [navDirection, setNavDirection] = useState<"forward" | "backward">("forward");

  const handleNavChange = (newView: ViewMode) => {
    const order: Record<string, number> = { chat: 0, runs: 1, integrations: 2, workflows: 3, designer: 4, knowledge: 5, agents: 6, tools: 7, settings: 8, evaluation: 9 };
    const curIdx = order[currentView] ?? 0;
    const newIdx = order[newView] ?? 0;
    if (newIdx > curIdx) {
      setNavDirection("forward");
    } else if (newIdx < curIdx) {
      setNavDirection("backward");
    }
    setCurrentView(newView);
  };

  // 全局业务状态
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [currentAgent, setCurrentAgent] = useState<AgentItem | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [health, setHealth] = useState<{ ok: boolean; info?: any }>({ ok: false });

  // 业务流状态：从真实后端与数据库获取，严禁假数据污染
  const [workflows, setWorkflows] = useState<PipelineItem[]>([]);
  const [editingWorkflow, setEditingWorkflow] = useState<PipelineItem | null>(null);
  const [initialChatPrompt, setInitialChatPrompt] = useState<
    { prompt: string; autoSend?: boolean } | string | undefined
  >(undefined);
  const [executingWorkflow, setExecutingWorkflow] = useState<PipelineItem | null>(null);
  const [evaluationMessage, setEvaluationMessage] = useState<any>(null);

  // 初始化探测后端健康度并加载业务数据
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
        if (wfList && wfList.length > 0) {
          setWorkflows(wfList);
        } else {
          setWorkflows([]);
        }
      })
      .catch((err) => {
        console.warn("Workflows fetch returned empty or error", err);
        setWorkflows([]);
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
      toast.warning("系统至少需保留一个可用智能体", "无法删除");
      return;
    }
    try {
      await deleteAgentApi(id);
      toast.success("智能体已彻底移除", "删除成功");
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

  const handleLaunchWorkflow = (wf: PipelineItem) => {
    setInitialChatPrompt({ prompt: wf.promptTemplate, autoSend: true });
    setCurrentView("chat");
  };

  const handleOpenCreateWorkflow = () => {
    const newWf: PipelineItem = {
      ...DEFAULT_ENTERPRISE_WORKFLOWS[0],
      id: `wf-${Date.now().toString().slice(-6)}`,
      name: "新建自定义研发效能智能体",
      version: "v1.0.0",
    };
    setEditingWorkflow(newWf);
    setCurrentView("designer");
  };

  const handleOpenEditWorkflow = (wf: PipelineItem) => {
    setEditingWorkflow(wf);
    setCurrentView("designer");
  };

  const handleOpenRepositories = () => {
    const codeWf = workflows.find((w) => w.tags?.includes("Git监控") || w.category === "代码协同") || workflows[0];
    if (codeWf) {
      setEditingWorkflow(codeWf);
      setCurrentView("designer");
    } else {
      handleOpenCreateWorkflow();
    }
  };

  const handleSaveWorkflow = async (saved: PipelineItem) => {
    try {
      const persisted = await saveWorkflowApi(saved);
      setWorkflows((prev) => {
        const exists = prev.some((w) => w.id === persisted.id);
        return exists ? prev.map((w) => (w.id === persisted.id ? persisted : w)) : [persisted, ...prev];
      });
      toast.success("业务流与代码库配置已成功同步持久化！", "保存成功");
    } catch (err: any) {
      console.warn("后端持久化未完成，保留本地状态", err);
      setWorkflows((prev) => {
        const exists = prev.some((w) => w.id === saved.id);
        return exists ? prev.map((w) => (w.id === saved.id ? saved : w)) : [saved, ...prev];
      });
    }
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

  // 导航项映射
  const navValue = currentView === "chat" || currentView === "runs" || currentView === "integrations" ? currentView : null;

  // 顶栏滑动高光胶囊指示器 (Apple / Linear 级顺滑滑动物理反馈)
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const [navIndicator, setNavIndicator] = useState<{ left: number; width: number }>({ left: 4, width: 98 });
  const navItemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const navItems = [
    { label: "智能工作台", value: "chat", icon: <MessageOutlined /> },
    { label: "运行观测", value: "runs", icon: <LineChartOutlined /> },
    { label: "接入中心", value: "integrations", icon: <DeploymentUnitOutlined /> },
  ];

  useEffect(() => {
    const activeKey = navValue;
    const targetEl = activeKey ? navItemRefs.current[activeKey] : null;
    if (targetEl && navContainerRef.current) {
      const containerRect = navContainerRef.current.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      setNavIndicator({
        left: targetRect.left - containerRect.left,
        width: targetRect.width,
      });
    }
  }, [currentView, navValue]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        background: "#f0f2f5",
        overflow: "hidden",
      }}
    >
      {/* 顶部现代毛玻璃顶栏 (全幅铺满，触感极佳) */}
      <header
        style={{
          height: 60,
          padding: "0 28px",
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(22px)",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          zIndex: 20,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* Logo */}
          <div
            onClick={() => handleNavChange("chat")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 17,
                boxShadow: "0 2px 8px rgba(99, 102, 241, 0.35)",
              }}
            >
              <DeploymentUnitOutlined />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16.5, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.4px" }}>
                OwnAgent
              </span>
              <Tag
                style={{
                  margin: 0,
                  fontSize: 10.5,
                  borderRadius: 4,
                  fontWeight: 600,
                  background: "#eef2ff",
                  color: "#4f46e5",
                  border: "1px solid #c7d2fe",
                  padding: "0 6px",
                }}
              >
                STUDIO
              </Tag>
            </div>
          </div>

          {/* 顶级现代滑动流光切换栏 (Apple / Linear 级顺滑滑动物理反馈) */}
          <nav
            ref={navContainerRef}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 2,
              background: "#f1f5f9",
              padding: "4px",
              borderRadius: 999,
              border: "1px solid #e2e8f0",
              boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.03)",
            }}
          >
            {/* 顺滑游动的物理高光胶囊 (Sliding Pill Indicator) */}
            <div
              style={{
                position: "absolute",
                top: 4,
                bottom: 4,
                left: 0,
                transform: `translateX(${navIndicator.left}px)`,
                width: `${navIndicator.width}px`,
                background: "#ffffff",
                borderRadius: 999,
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(99, 102, 241, 0.1)",
                transition: "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), width 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
                pointerEvents: "none",
                opacity: navValue ? 1 : 0,
                zIndex: 1,
              }}
            />

            {navItems.map((item) => {
              const isActive = navValue === item.value;
              return (
                <div
                  key={item.value}
                  ref={(el) => (navItemRefs.current[item.value] = el)}
                  onClick={() => handleNavChange(item.value as ViewMode)}
                  style={{
                    position: "relative",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 16px",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#4338ca" : "#64748b",
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "color 0.2s ease, transform 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = "#0f172a";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = "#64748b";
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: isActive ? "#4f46e5" : "#94a3b8",
                      transition: "color 0.2s ease",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
              );
            })}
          </nav>
        </div>

        {/* 右侧状态与设置入口 */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              fontSize: 11.5,
              color: health.ok ? "#15803d" : "#b45309",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              background: health.ok ? "rgba(240, 253, 244, 0.85)" : "rgba(255, 251, 235, 0.85)",
              padding: "4px 12px",
              borderRadius: 20,
              border: `1px solid ${health.ok ? "#86efac" : "#fde68a"}`,
              boxShadow: health.ok ? "0 0 12px rgba(34, 197, 94, 0.2)" : "none",
              backdropFilter: "blur(8px)",
            }}
          >
            <span
              className={health.ok ? "cyber-radar-dot-green" : "cyber-radar-dot"}
              style={{ width: 6, height: 6 }}
            />
            {health.ok ? "系统运行就绪" : "连接后端中"}
          </span>

          <Tooltip title="系统设置与审计日志">
            <Button
              type="text"
              icon={<SettingOutlined style={{ fontSize: 16, color: "#64748b" }} />}
              onClick={() => setCurrentView("settings")}
              style={{ borderRadius: 8, height: 34, width: 34 }}
            />
          </Tooltip>
        </div>
      </header>

      {/* 主视图渲染 */}
      <main style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", height: "calc(100vh - 60px)", width: "100%", overflow: "hidden" }}>
        <div
          key={currentView === "chat" ? "non-chat-view" : currentView}
          className={navDirection === "forward" ? "cyber-slide-in-right" : "cyber-slide-in-left"}
          style={{ width: "100%", height: "100%", flex: 1, display: currentView === "chat" ? "none" : "flex", flexDirection: "column", overflow: "hidden" }}
        >
          {currentView === "workflows" && (
            <WorkflowsListPage
              workflows={workflows}
              onLaunchWorkflow={handleLaunchWorkflow}
              onOpenCreate={handleOpenCreateWorkflow}
              onOpenEdit={handleOpenEditWorkflow}
              onDelete={handleDeleteWorkflow}
              onSaveWorkflow={handleSaveWorkflow}
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

          {currentView === "knowledge" && <KnowledgePage />}

          {currentView === "runs" && <RunsPage />}

          {currentView === "integrations" && <IntegrationsPage onOpenRuns={() => handleNavChange("runs")} />}

          {currentView === "agents" && (
            <AgentsListPage
              agents={agents}
              onOpenChat={handleOpenChat}
              onUpdateAgent={handleUpdateAgent}
              onDeleteAgent={handleDeleteAgent}
              onCreateAgent={handleCreateAgent}
            />
          )}

          {currentView === "tools" && <ToolsMarketPage />}


          {currentView === "evaluation" && evaluationMessage && (
            <EvaluationPage message={evaluationMessage} onBack={() => handleNavChange("chat")} />
          )}

          {currentView === "settings" && (
            <SystemSettingsPage
              logs={logs}
              health={health}
              onEnterWorkbench={() => setCurrentView("chat")}
            />
          )}
        </div>

        {/* Keep the chat runtime mounted while navigating so an in-flight SSE response
            and the current conversation state are not discarded by view transitions. */}
        <div
          style={{
            display: currentView === "chat" ? "flex" : "none",
            width: "100%",
            height: "100%",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <ChatPlaygroundPage
            agents={agents}
            currentAgent={currentAgent}
            onSelectAgent={setCurrentAgent}
            onAddAuditLog={handleAddAuditLog}
            onNavigateSettings={() => handleNavChange("settings")}
            onOpenModal={(tab: NavTab) => {
              handleNavChange(tab as ViewMode);
            }}
            workflows={workflows}
            initialPrompt={initialChatPrompt}
            onClearInitialPrompt={() => setInitialChatPrompt(undefined)}
            onOpenCreateWorkflow={handleOpenCreateWorkflow}
            onNavigateStudio={() => handleNavChange("workflows")}
            onRunWorkflow={handleLaunchWorkflow}
            onOpenEvaluation={(message) => { setEvaluationMessage(message); handleNavChange("evaluation"); }}
          />
        </div>
      </main>

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
