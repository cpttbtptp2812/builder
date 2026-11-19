import React, { useState, useEffect, useRef, useCallback } from "react";
import HomePage, { type DreamoraStar } from "./pages/home/HomePage";
import ChatPlaygroundPage from "./pages/chat/ChatPlaygroundPage";
import WorkflowsListPage from "./pages/workflows/WorkflowsListPage";
import WorkflowDesignerPage from "./pages/workflows/WorkflowDesignerPage";
import SystemSettingsPage from "./pages/settings/SystemSettingsPage";
import KnowledgePage from "./pages/knowledge/KnowledgePage";
import AgentsListPage from "./pages/agents/AgentsListPage";
import ToolsMarketPage from "./pages/tools/ToolsMarketPage";
import EvaluationPage from "./pages/evaluation/EvaluationPage";
import RunsPage from "./pages/runs/RunsPage";
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
  fetchKnowledgeChunksApi,
  fetchToolsApi,
  saveWorkflowApi,
} from "./services/api";
import { WorkflowExecutionModal } from "./components/workflow/WorkflowExecutionModal";
import { useToast } from "./context/ToastContext";
import {
  Segmented,
  Badge,
  Button,
  Space,
  Tag,
  Tooltip,
} from "antd";
import {
  DashboardOutlined,
  MessageOutlined,
  AppstoreOutlined,
  SettingOutlined,
  DeploymentUnitOutlined,
} from "@ant-design/icons";

export type ViewMode =
  | "home"
  | "chat"
  | "workflows"
  | "knowledge"
  | "agents"
  | "tools"
  | "settings"
  | "designer"
  | "evaluation"
  | "runs";

export default function App() {
  const toast = useToast();
  const [currentView, setCurrentView] = useState<ViewMode>("home");
  const [navDirection, setNavDirection] = useState<"forward" | "backward">("forward");

  const handleNavChange = (newView: ViewMode) => {
    const order: Record<string, number> = { home: 0, chat: 1, runs: 2, workflows: 3, designer: 4, knowledge: 5, agents: 6, tools: 7, settings: 8, evaluation: 9 };
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
  const [pendingDream, setPendingDream] = useState("");
  const [pendingDreamMode, setPendingDreamMode] = useState("倾听");
  const [dreamArrival, setDreamArrival] = useState<DreamoraStar | null>(null);
  const [continuingDream, setContinuingDream] = useState<DreamoraStar | null>(null);
  const [evaluationMessage, setEvaluationMessage] = useState<any>(null);
  const dismissDreamArrival = useCallback(() => setDreamArrival(null), []);

  const handleLaunchDream = (dream: string, mode: string) => {
    const guidance: Record<string, string> = {
      倾听: "先认真倾听和理解，不急着给建议。回应这份梦想对用户意味着什么，让它被看见。",
      探索: "陪用户探索这个梦想的来源、可能性和想象空间。先提出有启发的问题，不替用户下结论。",
      规划: "帮助用户把梦想拆成温和、可调整的阶段和第一个小步骤，不制造压力。",
      创造: "和用户一起构思可以创造出来的作品、原型或体验，给出一个能开始的创意方向。",
      研究: "帮助用户梳理值得研究的问题、资料方向和现实资源；不编造事实或来源。",
      行动: "优先识别当前 Agent 已注册、可用的工具或 Action，先说明准备执行的动作、参数和可能副作用，并等待用户明确确认及系统审批。只有审批通过后才能通过现有执行能力操作；不花钱、不联系他人、不修改外部数据，除非用户明确授权。若没有可用 Action，就诚实给出可执行计划，不要声称已经执行。"
    };
    setPendingDream(dream);
    setPendingDreamMode(mode);
    setInitialChatPrompt({
      prompt: `这是用户亲自写下的梦想：\n\n${dream}\n\n用户选择的陪伴方式：${mode}。\n${guidance[mode] || guidance["倾听"]}\n\n请用真诚、具体、有想象力的中文回应。尊重用户的自主权，不评判梦想是否现实，不把所有梦想强行变成效率任务。`,
      autoSend: true
    });
    handleNavChange("chat");
  };

  const handleContinueDream = (star: DreamoraStar) => {
    setContinuingDream(star);
    setPendingDream(star.dream);
    setPendingDreamMode(star.mode || "倾听");
    setInitialChatPrompt({
      prompt: `我们正在继续一份被记录在 DREAMORA 星图里的梦想。\n\n原始梦想：\n${star.dream}\n\n上一次的回应：\n${star.response || "这份梦想刚刚被记录下来。"}\n\n请承接之前的语境继续交流，不要重新介绍自己，也不要重复整段旧回应。可以询问用户下一步最想探索的部分，并给出有温度、有实质内容的回应。`,
      autoSend: true
    });
    handleNavChange("chat");
  };

  const handleDreamResponse = (dream: string, response: string) => {
    const previous = continuingDream;
    setDreamArrival(previous ? {
      ...previous,
      response: [previous.response, response].filter(Boolean).join("\n\n"),
      createdAt: previous.createdAt
    } : {
      id: `dream-${Date.now()}`,
      dream,
      response,
      mode: pendingDreamMode,
      createdAt: new Date().toISOString()
    });
    setContinuingDream(null);
    setPendingDream("");
    handleNavChange("home");
  };

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
  const navValue = currentView === "designer" ? "workflows" : currentView;

  // 顶栏滑动高光胶囊指示器 (Apple / Linear 级顺滑滑动物理反馈)
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const [navIndicator, setNavIndicator] = useState<{ left: number; width: number }>({ left: 4, width: 98 });
  const navItemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const navItems = [
    { label: "首页大盘", value: "home", icon: <DashboardOutlined /> },
    { label: "智能工作台", value: "chat", icon: <MessageOutlined /> },
    { label: "运行记录", value: "runs", icon: <DeploymentUnitOutlined /> },
    { label: "业务流中心", value: "workflows", icon: <AppstoreOutlined /> },
  ];

  useEffect(() => {
    const activeKey = currentView === "designer" ? "workflows" : currentView;
    const targetEl = navItemRefs.current[activeKey];
    if (targetEl && navContainerRef.current) {
      const containerRect = navContainerRef.current.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      setNavIndicator({
        left: targetRect.left - containerRect.left,
        width: targetRect.width,
      });
    }
  }, [currentView]);

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
          background: currentView === "home" ? "rgba(5, 8, 20, 0.78)" : "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(22px)",
          borderBottom: currentView === "home" ? "1px solid rgba(190,190,255,.14)" : "1px solid #e2e8f0",
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
            onClick={() => setCurrentView("home")}
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
              <span style={{ fontSize: 16.5, fontWeight: 800, color: currentView === "home" ? "#f2edff" : "#0f172a", letterSpacing: currentView === "home" ? "3px" : "-0.4px" }}>
                {currentView === "home" ? "DREAMORA" : "OwnAgent"}
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
              background: currentView === "home" ? "rgba(255,255,255,.055)" : "#f1f5f9",
              padding: "4px",
              borderRadius: 999,
              border: currentView === "home" ? "1px solid rgba(196,181,253,.18)" : "1px solid #e2e8f0",
              boxShadow: currentView === "home" ? "inset 0 1px 0 rgba(255,255,255,.08)" : "inset 0 1px 2px rgba(0, 0, 0, 0.03)",
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
                background: currentView === "home" ? "linear-gradient(110deg,rgba(205,190,255,.24),rgba(255,255,255,.12))" : "#ffffff",
                borderRadius: 999,
                boxShadow: currentView === "home" ? "0 0 22px rgba(169,145,255,.18)" : "0 1px 3px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(99, 102, 241, 0.1)",
                transition: "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), width 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
                pointerEvents: "none",
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
                    color: currentView === "home" ? (isActive ? "#f6f0ff" : "#9d9ab8") : (isActive ? "#4338ca" : "#64748b"),
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "color 0.2s ease, transform 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = currentView === "home" ? "#f1eaff" : "#0f172a";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = currentView === "home" ? "#9d9ab8" : "#64748b";
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: currentView === "home" ? (isActive ? "#e0d2ff" : "#777692") : (isActive ? "#4f46e5" : "#94a3b8"),
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
          {currentView === "home" && (
            <HomePage
              onLaunchDream={handleLaunchDream}
              arrivalDream={dreamArrival}
              onDismissArrival={dismissDreamArrival}
              onContinueDream={handleContinueDream}
            />
          )}

          {currentView === "runs" && <RunsPage />}

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
            onBackHome={() => handleNavChange("home")}
            workflows={workflows}
            initialPrompt={initialChatPrompt}
            onClearInitialPrompt={() => setInitialChatPrompt(undefined)}
            onOpenCreateWorkflow={handleOpenCreateWorkflow}
            onNavigateStudio={() => handleNavChange("workflows")}
            onRunWorkflow={handleLaunchWorkflow}
            dreamSeed={pendingDream}
            onDreamResponse={handleDreamResponse}
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
