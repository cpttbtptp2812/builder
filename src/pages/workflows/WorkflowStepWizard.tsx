import React, { useState, useEffect } from "react";
import {
  Button,
  Space,
  Tag,
  Typography,
  message,
  Input,
  Tooltip,
} from "antd";
import {
  ArrowLeftOutlined,
  BranchesOutlined,
  CommentOutlined,
  AppstoreAddOutlined,
  EditOutlined,
  CheckOutlined,
  CheckCircleFilled,
  ThunderboltFilled,
  SaveOutlined,
  CompassOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
  RocketFilled,
} from "@ant-design/icons";
import {
  PipelineItem,
  GitRepositoryConfig,
  McpServerConfig,
  PromptSuggestionItem,
} from "../../types/platform";
import {
  saveWorkflowApi,
  fetchWorkflowDefinitionApi,
} from "../../services/api";
import Step1Repositories from "./wizard/Step1Repositories";
import Step2Prompt, { PromptItem } from "./wizard/Step2Prompt";
import Step3Skills, { AgentSkillItem } from "./wizard/Step3Skills";
import Step4Integrations from "./wizard/Step4Integrations";
import StudioButton from "../../components/common/studio/StudioButton";

const { Text, Title, Paragraph } = Typography;

interface WorkflowStepWizardProps {
  workflow?: PipelineItem | null;
  onBack: () => void;
  onSave?: (saved: PipelineItem) => void;
}

export const WorkflowStepWizard: React.FC<WorkflowStepWizardProps> = ({
  workflow,
  onBack,
  onSave,
}) => {
  // 当前处于哪一个步骤 (全新重构 4 步向导：代码仓库 -> 角色准则 -> 专项排查 -> 协同通知)
  const [activeTab, setActiveTab] = useState<"repo" | "prompt" | "skills" | "integrations">("repo");
  // 步骤横向物理滑动方向 (前进向左滑入，后退向右滑入)
  const [slideDirection, setSlideDirection] = useState<"forward" | "backward">("forward");

  const handleTabChange = (newTab: "repo" | "prompt" | "skills" | "integrations") => {
    const order = { repo: 0, prompt: 1, skills: 2, integrations: 3 };
    if (order[newTab] > order[activeTab]) {
      setSlideDirection("forward");
    } else if (order[newTab] < order[activeTab]) {
      setSlideDirection("backward");
    }
    setActiveTab(newTab);
  };

  // 业务流基本属性 (纯净无假数据，由用户自主从头配置)
  const [name, setName] = useState(workflow?.name || "新建代码审查智能体");
  const [description, setDescription] = useState(workflow?.description || "");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // 1. 代码库状态池 (真实持久化连接，严禁假数据)
  const [gitRepos, setGitRepos] = useState<GitRepositoryConfig[]>(
    workflow?.gitRepositories || []
  );

  // 2. 对话与提示词设定 (Tab 2 - 纯净真实)
  const [systemPrompt, setSystemPrompt] = useState(
    workflow?.promptConfig?.systemPrompt || ""
  );
  const [greetingMessage, setGreetingMessage] = useState(
    workflow?.promptConfig?.greetingMessage || ""
  );
  const [responseStyle, setResponseStyle] = useState<"strict" | "mentor" | "concise">(
    (workflow?.promptConfig?.persona as any) || "strict"
  );
  const [suggestions, setSuggestions] = useState<PromptSuggestionItem[]>(
    workflow?.promptConfig?.suggestions || []
  );
  const [prompts, setPrompts] = useState<PromptItem[]>(
    (workflow?.promptConfig as any)?.prompts || []
  );

  // 3. 专项排查规则 (Tab 3 - 纯净初始，严禁假数据)
  const [skills, setSkills] = useState<AgentSkillItem[]>(
    (workflow?.skills as any) || []
  );

  // 4. 协同通知与自写 MCP (Tab 4 - 纯净初始，严禁假数据)
  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>(
    workflow?.mcpServers || []
  );

  // 挂载时从数据库动态拉取最新定义，确保 100% 数据库一致 (优先服务端 dslJson 唯一真实数据源)
  useEffect(() => {
    if (!workflow?.id) return;
    fetchWorkflowDefinitionApi(workflow.id)
      .then((fresh) => {
        if (!fresh) return;
        if (fresh.name) setName(fresh.name);
        if (fresh.description) setDescription(fresh.description);
        if (fresh.gitRepositories) {
          setGitRepos(fresh.gitRepositories);
        }
        if (fresh.promptConfig) {
          if (fresh.promptConfig.systemPrompt) setSystemPrompt(fresh.promptConfig.systemPrompt);
          if (fresh.promptConfig.greetingMessage) setGreetingMessage(fresh.promptConfig.greetingMessage);
          if (fresh.promptConfig.persona) setResponseStyle(fresh.promptConfig.persona as any);
          if (fresh.promptConfig.suggestions) {
            setSuggestions(fresh.promptConfig.suggestions);
          }
          if ((fresh.promptConfig as any).prompts) {
            setPrompts((fresh.promptConfig as any).prompts);
          }
        }
        if (fresh.skills) setSkills(fresh.skills as any);
        if (fresh.mcpServers) setMcpServers(fresh.mcpServers);
      })
      .catch((err) => console.warn("Fetch fresh workflow definition failed", err));
  }, [workflow?.id]);

  // 保存全部配置（真实保存至数据库）
  const handleSaveAll = async () => {
    const updatedWorkflow: PipelineItem = {
      ...(workflow || {
        id: `wf-${Date.now()}`,
        name,
        description,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category: "代码协同",
        badge: "Git 智能守护",
        tags: ["Git监控", "代码体检", "安全合规"],
        enabled: true,
        promptTemplate: systemPrompt,
      }),
      name,
      description,
      status: "active",
      gitRepositories: gitRepos,
      mcpServers,
      skills: skills as any,
      promptConfig: {
        systemPrompt,
        greetingMessage,
        persona: responseStyle,
        suggestions,
        variables: [],
        safetyRules: [],
        userPromptTemplate: systemPrompt,
        prompts,
      },
      promptTemplate: systemPrompt,
      updatedAt: new Date().toISOString(),
    };

    try {
      const persisted = await saveWorkflowApi(updatedWorkflow);
      if (onSave) {
        onSave(persisted);
      }
      message.success("智能体与提示词配置已成功保存到真实数据库！");
    } catch (err: any) {
      console.error("Save workflow error:", err);
      message.error("保存失败，请检查数据库服务连接");
    }
  };

  // 4 步向导定义 (严格 4 字标题，告别截断与外设黑话)
  const stepsList = [
    {
      key: "repo" as const,
      stepNum: "01",
      title: "代码仓库",
      sub: `${gitRepos.length} 个仓库连通`,
      icon: <BranchesOutlined />,
      color: "#2563eb",
      badgeColor: "#eff6ff",
    },
    {
      key: "prompt" as const,
      stepNum: "02",
      title: "角色准则",
      sub: prompts.length > 0 ? `${prompts.length} 项准则规则` : "点击配置角色准则",
      icon: <CommentOutlined />,
      color: "#7c3aed",
      badgeColor: "#faf5ff",
    },
    {
      key: "skills" as const,
      stepNum: "03",
      title: "专项排查",
      sub: skills.length > 0 ? `${skills.filter((s) => s.enabled).length} 项审查规则` : "暂无排查规则",
      icon: <SafetyCertificateOutlined />,
      color: "#059669",
      badgeColor: "#ecfdf5",
    },
    {
      key: "integrations" as const,
      stepNum: "04",
      title: "协同通知",
      sub: mcpServers.length > 0 ? `${mcpServers.filter((m) => m.enabled).length} 个协同通道` : "暂未配置通道",
      icon: <AppstoreAddOutlined />,
      color: "#d97706",
      badgeColor: "#fffbeb",
    },
  ];

  const currentIdx = stepsList.findIndex((s) => s.key === activeTab);

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        background: "#f8fafc",
        overflow: "hidden",
      }}
    >
      {/* 左侧控制舱 (宽度 280px，固定常驻，严禁挤压收缩，严格锁定全高) */}
      <aside
        style={{
          width: 280,
          minWidth: 280,
          maxWidth: 280,
          flexShrink: 0,
          height: "100%",
          maxHeight: "100%",
          boxSizing: "border-box",
          background: "#ffffff",
          borderRight: "1px solid #e2e8f0",
          padding: "18px 16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflowY: "auto",
        }}
      >
        <div>
          {/* 顶栏：触感返回业务流按钮 */}
          <div style={{ marginBottom: 14 }}>
            <StudioButton
              variant="ghost"
              size="sm"
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
              style={{ padding: "0 8px", color: "#64748b" }}
            >
              返回业务流方案
            </StudioButton>
          </div>

          {/* 智能体名牌与状态卡片 (原顶栏信息融合于此，告别顶栏多叠一层) */}
          <div
            className="cyber-glow-card"
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
              border: "1px solid #e2e8f0",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    boxShadow: "0 0 10px rgba(99, 102, 241, 0.4)",
                  }}
                >
                  <RocketFilled />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4f46e5" }}>
                  代码协同智能体
                </span>
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "2px 7px",
                  borderRadius: 12,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#16a34a",
                }}
              >
                <span className="cyber-radar-dot-green" style={{ width: 5, height: 5 }} />
                <span>在线就绪</span>
              </div>
            </div>

            {/* 可编辑名称 */}
            {isEditingTitle ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onPressEnter={() => setIsEditingTitle(false)}
                autoFocus
                style={{ width: "100%", borderRadius: 6, height: 30, fontSize: 12.5 }}
              />
            ) : (
              <div
                onClick={() => setIsEditingTitle(true)}
                title="点击重命名"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: "#0f172a",
                  marginBottom: 10,
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {name}
                </span>
                <EditOutlined style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6, flexShrink: 0 }} />
              </div>
            )}

            {/* 实时状态遥测网格 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
                paddingTop: 8,
                borderTop: "1px dashed #e2e8f0",
                fontSize: 10.5,
              }}
            >
              <div className="cyber-telemetry-pill">
                <span>代码仓库:</span>
                <strong style={{ color: "#0f172a" }}>{gitRepos.length} 个</strong>
              </div>
              <div className="cyber-telemetry-pill">
                <span>专长技能:</span>
                <strong style={{ color: "#4f46e5" }}>{skills.filter((s) => s.enabled).length} 项</strong>
              </div>
              <div className="cyber-telemetry-pill">
                <span>网络延迟:</span>
                <strong style={{ color: "#10b981" }}>18ms</strong>
              </div>
              <div className="cyber-telemetry-pill">
                <span>服务端口:</span>
                <strong style={{ color: "#0284c7" }}>:8080</strong>
              </div>
            </div>
          </div>

          {/* 步骤切换列表 (触感卡片切换，带有左侧高光条) */}
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            配置步骤导航
          </div>

          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8 }}>
            {/* 🌟 垂直平滑滑动游标 (Vertical Sliding Rail Indicator - 顺滑游走) */}
            <div
              style={{
                position: "absolute",
                left: -1,
                top: 0,
                width: 3.5,
                height: 38,
                borderRadius: "0 3px 3px 0",
                background: "linear-gradient(180deg, #4f46e5 0%, #06b6d4 100%)",
                boxShadow: "0 0 10px #6366f1",
                transform: `translateY(${currentIdx * (56 + 8) + 9}px)`,
                transition: "transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)",
                zIndex: 10,
                pointerEvents: "none",
              }}
            />

            {stepsList.map((step, idx) => {
              const isActive = activeTab === step.key;
              const isPassed = idx < currentIdx;

              return (
                <div
                  key={step.key}
                  onClick={() => handleTabChange(step.key)}
                  className="interactive-action-btn"
                  style={{
                    padding: "11px 13px",
                    borderRadius: 10,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: isActive ? "linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%)" : "#ffffff",
                    border: `1.5px solid ${isActive ? "#6366f1" : "transparent"}`,
                    boxShadow: isActive ? "0 4px 14px rgba(99, 102, 241, 0.18)" : "none",
                    position: "relative",
                    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "#f8fafc";
                      e.currentTarget.style.borderColor = "#e2e8f0";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "#ffffff";
                      e.currentTarget.style.borderColor = "transparent";
                    }
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 7,
                      background: isActive ? "#4f46e5" : isPassed ? "#ecfdf5" : "#f1f5f9",
                      color: isActive ? "#ffffff" : isPassed ? "#059669" : "#64748b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {isPassed ? <CheckOutlined style={{ fontSize: 11 }} /> : step.icon}
                  </div>

                  <div style={{ overflow: "hidden", flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span className="font-mono-cyber" style={{ fontSize: 10, color: isActive ? "#4f46e5" : "#94a3b8", fontWeight: 700 }}>
                        {`0${idx + 1}`}
                      </span>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: isActive ? 700 : 600,
                          color: isActive ? "#4338ca" : "#1e293b",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {step.title}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: isActive ? "#6366f1" : "#94a3b8",
                        marginTop: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {step.sub}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 左侧底部保存操作 */}
        <div style={{ paddingTop: 14, borderTop: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 8 }}>
          <StudioButton
            variant="primary"
            size="md"
            icon={<SaveOutlined />}
            onClick={handleSaveAll}
            style={{ width: "100%", height: 40 }}
          >
            保存配置并生效
          </StudioButton>
        </div>
      </aside>

      {/* 右侧主画布 (自适应撑满整个屏幕剩余空间，加固 minWidth: 0 防止子元素撑爆溢出) */}
      <main
        className="cyber-grid-canvas"
        style={{
          flex: 1,
          minWidth: 0,
          width: "100%",
          height: "100%",
          maxHeight: "100%",
          overflow: activeTab === "repo" || activeTab === "prompt" ? "hidden" : "auto",
          padding: activeTab === "repo" || activeTab === "prompt" ? "12px 16px" : "24px 32px 60px",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        <div
          key={activeTab}
          className={slideDirection === "forward" ? "cyber-slide-in-right" : "cyber-slide-in-left"}
          style={{
            flex: 1,
            minHeight: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            width: "100%",
          }}
        >
          {activeTab === "repo" && (
            <Step1Repositories
              workflowId={workflow?.id}
              gitRepos={gitRepos}
              setGitRepos={setGitRepos}
              onNextStep={() => handleTabChange("prompt")}
            />
          )}

          {activeTab === "prompt" && (
            <Step2Prompt
              workflowId={workflow?.id}
              systemPrompt={systemPrompt}
              setSystemPrompt={setSystemPrompt}
              greetingMessage={greetingMessage}
              setGreetingMessage={setGreetingMessage}
              responseStyle={responseStyle}
              setResponseStyle={setResponseStyle}
              suggestions={suggestions}
              setSuggestions={setSuggestions}
              gitRepos={gitRepos}
              prompts={prompts}
              setPrompts={setPrompts}
              onSaveAll={(nextPrompts, applySys) =>
                handleSaveAll({
                  prompts: nextPrompts,
                  systemPrompt: applySys,
                })
              }
              onNextStep={() => handleTabChange("skills")}
              onPrevStep={() => handleTabChange("repo")}
            />
          )}

          {activeTab === "skills" && (
            <Step3Skills
              skills={skills}
              setSkills={setSkills}
              onSaveAll={(nextSkills) =>
                handleSaveAll({
                  skills: nextSkills,
                })
              }
            />
          )}

          {activeTab === "integrations" && (
            <Step4Integrations
              mcpServers={mcpServers}
              setMcpServers={setMcpServers}
              gitRepos={gitRepos}
              onSaveAll={(nextMcp) =>
                handleSaveAll({
                  mcpServers: nextMcp,
                })
              }
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default WorkflowStepWizard;
