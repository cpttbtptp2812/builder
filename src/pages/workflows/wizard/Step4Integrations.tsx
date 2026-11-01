import React, { useState } from "react";
import {
  Tag,
  Space,
  Input,
  Popconfirm,
  Typography,
  message,
  Switch,
  Row,
  Col,
  Radio,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  BellOutlined,
  SettingOutlined,
  SaveOutlined,
  SendOutlined,
  CheckCircleFilled,
  MessageOutlined,
  ThunderboltFilled,
  SafetyCertificateOutlined,
  ApiOutlined,
  ExclamationCircleOutlined,
  DesktopOutlined,
  GlobalOutlined,
  RobotOutlined,
  CheckOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import StudioButton from "../../../components/common/studio/StudioButton";
import StudioBreadcrumb from "../../../components/common/studio/StudioBreadcrumb";
import { McpServerConfig, GitRepositoryConfig } from "../../../types/platform";
import { testIntegrationWebhookApi, TestWebhookResult } from "../../../services/api";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Step4IntegrationsProps {
  mcpServers: McpServerConfig[];
  setMcpServers: React.Dispatch<React.SetStateAction<McpServerConfig[]>>;
  gitRepos?: GitRepositoryConfig[];
  onSaveAll?: (nextMcp?: McpServerConfig[]) => Promise<any>;
}

export const Step4Integrations: React.FC<Step4IntegrationsProps> = ({
  mcpServers,
  setMcpServers,
  gitRepos = [],
  onSaveAll,
}) => {
  const [subView, setSubView] = useState<"list" | "edit">("list");
  const [activeItem, setActiveItem] = useState<McpServerConfig | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<TestWebhookResult | null>(null);

  // 打开创建新通道
  const handleOpenCreate = (
    type: "feishu" | "dingtalk" | "wechat" | "custom_mcp" = "feishu"
  ) => {
    const defaultNames = {
      feishu: "飞书群机器人卡片推送",
      dingtalk: "钉钉群机器人消息通知",
      wechat: "企业微信群机器人通知",
      custom_mcp: "自定义服务投递 (自写 MCP)",
    };

    const defaultDesc = {
      feishu: "代码审查发现潜在隐患或高危缺陷时，向飞书项目群推送富文本诊断卡片。",
      dingtalk: "在代码审查完成后，自动向研发质量群同步代码评分与隐患摘要。",
      wechat: "向企业微信群机器人推送代码审查预警与修复建议。",
      custom_mcp: "连接自写的定制 MCP 服务，让大模型结合代码上下文与严重程度自主决策调用。",
    };

    const newItem: McpServerConfig = {
      id: `mcp-${Date.now()}`,
      name: defaultNames[type],
      type,
      description: defaultDesc[type],
      webhookUrl: "",
      secretToken: "",
      enabled: true,
      decisionMode: type === "custom_mcp" ? "ai_adaptive" : "p0_only",
      triggerCondition: "p0_p1",
      transport: type === "custom_mcp" ? "sse" : "http",
      command: "",
      args: [],
      tools: [
        {
          name: type === "custom_mcp" ? "custom_event_dispatch" : "notify_group",
          description: "由大模型根据审查结果决策执行发送",
          enabled: true,
        },
      ],
    };

    setActiveItem(newItem);
    setTestResult(null);
    setSubView("edit");
  };

  const handleOpenEdit = (item: McpServerConfig) => {
    setActiveItem(JSON.parse(JSON.stringify(item)));
    setTestResult(null);
    setSubView("edit");
  };

  const handleSave = () => {
    if (!activeItem) return;
    if (!activeItem.name.trim()) {
      message.warning("请输入通道或服务名称");
      return;
    }
    const exists = mcpServers.some((c) => c.id === activeItem.id);
    const nextServers = exists
      ? mcpServers.map((c) => (c.id === activeItem.id ? activeItem : c))
      : [activeItem, ...mcpServers];

    setMcpServers(nextServers);
    if (onSaveAll) {
      onSaveAll(nextServers);
    } else {
      message.success(`已保存「${activeItem.name}」配置`);
    }
    setSubView("list");
  };

  const handleDelete = (id: string) => {
    const nextServers = mcpServers.filter((c) => c.id !== id);
    setMcpServers(nextServers);
    if (onSaveAll) {
      onSaveAll(nextServers);
    } else {
      message.info("已移除该通道");
    }
  };

  const handleToggle = (id: string, checked: boolean) => {
    const nextServers = mcpServers.map((c) => (c.id === id ? { ...c, enabled: checked } : c));
    setMcpServers(nextServers);
    if (onSaveAll) {
      onSaveAll(nextServers);
    }
  };

  // 真实测试连通性 (通过后端中转彻底解决跨域问题)
  const handleTestConnection = async () => {
    if (!activeItem || !activeItem.webhookUrl?.trim()) {
      message.warning("请先填写 Webhook 或服务地址");
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await testIntegrationWebhookApi({
        webhookUrl: activeItem.webhookUrl.trim(),
        channelType: activeItem.type || "feishu",
        secret: activeItem.secretToken?.trim(),
      });
      setTestResult(res);
      if (res.ok) {
        message.success(
          activeItem.type === "custom_mcp"
            ? "MCP 服务握手成功！服务状态在线。"
            : "测试卡片已成功推送到群中！"
        );
      } else {
        message.error(`请求返回异常: ${res.error || `状态码 ${res.statusCode}`}`);
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        error: err.message || "请求失败，请检查服务地址与网络连通性",
      });
      message.error("连通性测试失败");
    } finally {
      setIsSendingTest(false);
    }
  };

  // =========================================================================
  // 视图 2：通道编辑与测试工作室
  // =========================================================================
  if (subView === "edit" && activeItem) {
    const isCustomMcp = activeItem.type === "custom_mcp";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <StudioBreadcrumb
          onBack={() => setSubView("list")}
          backLabel="协同通知与工具"
          currentTitle={activeItem.name || "配置通道"}
          badge={
            <Tag
              color={isCustomMcp ? "purple" : "blue"}
              style={{ borderRadius: 4, margin: 0 }}
            >
              {isCustomMcp
                ? "自写 MCP 扩展"
                : activeItem.type === "feishu"
                ? "飞书群机器人"
                : activeItem.type === "dingtalk"
                ? "钉钉群机器人"
                : "企业微信"}
            </Tag>
          }
          rightActions={
            <StudioButton
              variant="primary"
              size="sm"
              icon={<SaveOutlined />}
              onClick={handleSave}
            >
              保存配置
            </StudioButton>
          }
        />

        <Row gutter={[16, 16]}>
          {/* 左侧：表单配置 */}
          <Col xs={24} lg={13}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* 卡片 1: 基本属性与通道类型 */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <BellOutlined style={{ color: "#2563eb", fontSize: 14 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                    1. 通道类型与基本属性
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                    协同通道类型
                  </div>
                  <Radio.Group
                    value={activeItem.type || "feishu"}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setActiveItem({
                        ...activeItem,
                        type: newType,
                        decisionMode: newType === "custom_mcp" ? "ai_adaptive" : "p0_only",
                      });
                      setTestResult(null);
                    }}
                    style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                  >
                    <Radio.Button value="feishu" style={{ borderRadius: 6, fontSize: 12 }}>
                      💬 飞书群机器人
                    </Radio.Button>
                    <Radio.Button value="dingtalk" style={{ borderRadius: 6, fontSize: 12 }}>
                      🔔 钉钉群机器人
                    </Radio.Button>
                    <Radio.Button value="wechat" style={{ borderRadius: 6, fontSize: 12 }}>
                      🟢 企业微信
                    </Radio.Button>
                    <Radio.Button
                      value="custom_mcp"
                      style={{
                        borderRadius: 6,
                        fontSize: 12,
                        borderColor: isCustomMcp ? "#8b5cf6" : undefined,
                        color: isCustomMcp ? "#7c3aed" : undefined,
                        fontWeight: isCustomMcp ? 700 : 500,
                      }}
                    >
                      ⚡ 自定义服务 (自写 MCP)
                    </Radio.Button>
                  </Radio.Group>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    通道名称（用于标识和辨认）
                  </div>
                  <Input
                    value={activeItem.name}
                    onChange={(e) => setActiveItem({ ...activeItem, name: e.target.value })}
                    placeholder="如：研发二组飞书群、内部工单同步服务..."
                    style={{ borderRadius: 6, fontSize: 12.5 }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    {isCustomMcp ? "MCP 服务地址 (Endpoint URL)" : "Webhook 推送地址 (机器人链接)"}
                  </div>
                  <Input
                    value={activeItem.webhookUrl}
                    onChange={(e) => setActiveItem({ ...activeItem, webhookUrl: e.target.value })}
                    placeholder={
                      isCustomMcp
                        ? "如：http://127.0.0.1:8000/sse 或 https://api.mycompany.com/mcp"
                        : activeItem.type === "feishu"
                        ? "https://open.feishu.cn/open-apis/bot/v2/hook/********"
                        : "https://oapi.dingtalk.com/robot/send?access_token=********"
                    }
                    style={{ borderRadius: 6, fontSize: 12.5, fontFamily: "monospace" }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    {isCustomMcp ? "安全鉴权 Token (Bearer Token，可选)" : "安全密钥 / Secret (可选)"}
                  </div>
                  <Input.Password
                    value={activeItem.secretToken}
                    onChange={(e) => setActiveItem({ ...activeItem, secretToken: e.target.value })}
                    placeholder="用于签名校验或鉴权..."
                    style={{ borderRadius: 6, fontSize: 12.5 }}
                  />
                </div>
              </div>

              {/* 卡片 2: 决策与触发模式 */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <RobotOutlined style={{ color: "#7c3aed", fontSize: 14 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                    2. 大模型决策与触发时机
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                    选择大模型在审查代码时，如何决策调用此通道：
                  </div>
                  <Radio.Group
                    value={activeItem.decisionMode || "ai_adaptive"}
                    onChange={(e) =>
                      setActiveItem({ ...activeItem, decisionMode: e.target.value })
                    }
                    style={{ display: "flex", flexDirection: "column", gap: 10 }}
                  >
                    <Radio value="ai_adaptive">
                      <div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b" }}>
                          🧠 AI 结合上下文灵活决策（推荐）
                        </span>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                          大模型审查代码时，根据代码严重程度、改动模块与业务风险自主权衡，智能决定是否调用并投递。
                        </div>
                      </div>
                    </Radio>

                    <Radio value="p0_only">
                      <div>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
                          🚨 仅发现 P0 阻断 / P1 高危严重缺陷时触发
                        </span>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                          普通优化建议不打扰，仅在发现生产崩溃隐患、严重安全漏洞或空指针时强行触发。
                        </div>
                      </div>
                    </Radio>

                    <Radio value="always_exec">
                      <div>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
                          📋 每次代码审查必定调用
                        </span>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                          不论是否有严重问题，在每次审查结束时均同步汇总报告与指标。
                        </div>
                      </div>
                    </Radio>
                  </Radio.Group>
                </div>

                {/* 如果是自定义 MCP，提供让大模型理解的工具描述 (AI Instruction) */}
                {isCustomMcp && (
                  <div style={{ marginTop: 6, paddingTop: 10, borderTop: "1px dashed #e2e8f0" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                      传给大模型的工具意图说明 (AI Instruction)
                    </div>
                    <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 6 }}>
                      告诉大模型你写的这个 MCP 到底是做什么的，大模型会根据这段说明决定何时调用它：
                    </div>
                    <TextArea
                      rows={3}
                      value={activeItem.description}
                      onChange={(e) => setActiveItem({ ...activeItem, description: e.target.value })}
                      placeholder="例如：当审查发现存在影响数据库性能的慢查询、未释放的线程池或越权隐患时，调用此服务将详情直接同步给内部工单平台..."
                      style={{ borderRadius: 6, fontSize: 12 }}
                    />
                  </div>
                )}
              </div>
            </div>
          </Col>

          {/* 右侧：实时连通性探测与预览卡片 */}
          <Col xs={24} lg={11}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* 连通性测试面板 */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ThunderboltFilled style={{ color: "#eab308", fontSize: 14 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                      实时通信验证与握手测试
                    </span>
                  </div>
                  <StudioButton
                    variant="primary"
                    size="sm"
                    icon={isSendingTest ? <SyncOutlined spin /> : <SendOutlined />}
                    disabled={isSendingTest || !activeItem.webhookUrl?.trim()}
                    onClick={handleTestConnection}
                  >
                    {isSendingTest ? "探测中..." : isCustomMcp ? "测试 MCP 连通性" : "发送测试卡片"}
                  </StudioButton>
                </div>

                <div style={{ fontSize: 12, color: "#64748b" }}>
                  点击按钮将通过后端服务向目标地址发送一次标准探针请求，当场验证网络连通性。
                </div>

                {/* 连通性测试结果面板 */}
                {testResult && (
                  <div
                    style={{
                      borderRadius: 8,
                      padding: "12px 14px",
                      background: testResult.ok ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${testResult.ok ? "#bbf7d0" : "#fecaca"}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {testResult.ok ? (
                        <CheckCircleFilled style={{ color: "#16a34a", fontSize: 14 }} />
                      ) : (
                        <ExclamationCircleOutlined style={{ color: "#dc2626", fontSize: 14 }} />
                      )}
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: testResult.ok ? "#15803d" : "#b91c1c",
                        }}
                      >
                        {testResult.ok
                          ? "通信畅通！已成功接收响应"
                          : `通信失败 (${testResult.statusCode || "网络异常"})`}
                      </span>
                    </div>

                    {testResult.responseBody && (
                      <div
                        style={{
                          fontSize: 11,
                          fontFamily: "monospace",
                          color: "#334155",
                          background: "rgba(255,255,255,0.7)",
                          padding: "6px 8px",
                          borderRadius: 4,
                          maxHeight: 120,
                          overflow: "auto",
                          wordBreak: "break-all",
                        }}
                      >
                        {testResult.responseBody}
                      </div>
                    )}

                    {testResult.error && (
                      <div style={{ fontSize: 11.5, color: "#b91c1c" }}>
                        {testResult.error}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 卡片预览 */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b" }}>
                    消息卡片样式预览
                  </div>
                  <Tag color="default" style={{ margin: 0, fontSize: 10.5, borderRadius: 4, background: "#f1f5f9", color: "#64748b" }}>
                    示意预览 · 非真实推送
                  </Tag>
                </div>

                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>
                      🛡️ [OwnAgent 代码守护] 发现 1 项高危缺陷
                    </span>
                    <Tag color="red" style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>
                      P0 阻断
                    </Tag>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#475569" }}>
                    代码仓库: {gitRepos[0]?.name || "当前代码仓库"} ({gitRepos[0]?.branch || "main"} 分支)
                  </div>
                  <div style={{ fontSize: 11.5, color: "#475569" }}>
                    最新提交: {gitRepos[0]?.lastCommitSha ? `#${gitRepos[0].lastCommitSha} by ${gitRepos[0].lastCommitAuthor || "开发者"}` : "最新 Commit 提交记录"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#ef4444" }}>
                    缺陷摘要: 第 42 行存在空指针高危隐患，缺失非空防御性判空。
                  </div>
                  <div
                    style={{
                      background: "#1e293b",
                      borderRadius: 6,
                      padding: "8px 10px",
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: "#f8fafc",
                    }}
                  >
                    - user?.profile?.address?.city ?? "未知地区";
                  </div>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </div>
    );
  }

  // =========================================================================
  // 视图 1：协同通道列表 (纯净无假数据，支持快速添加 4 大通道)
  // =========================================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 顶部控制栏 */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 12,
          border: "1.5px solid #e2e8f0",
          padding: "14px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "#ecfdf5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BellOutlined style={{ color: "#059669", fontSize: 15 }} />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
              协同通知与自写 MCP 扩展
            </div>
            <div style={{ fontSize: 11.5, color: "#64748b" }}>
              配置代码审查后的结果投递目标。支持飞书、钉钉、企微及用户自写的定制 MCP 服务。
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <StudioButton
            variant="glass"
            size="sm"
            icon={<PlusOutlined />}
            onClick={() => handleOpenCreate("feishu")}
          >
            飞书机器人
          </StudioButton>
          <StudioButton
            variant="glass"
            size="sm"
            icon={<PlusOutlined />}
            onClick={() => handleOpenCreate("dingtalk")}
          >
            钉钉机器人
          </StudioButton>
          <StudioButton
            variant="primary"
            size="sm"
            icon={<PlusOutlined />}
            onClick={() => handleOpenCreate("custom_mcp")}
          >
            自写 MCP 扩展
          </StudioButton>
        </div>
      </div>

      {/* 列表内容区 */}
      {mcpServers.length === 0 ? (
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            border: "1.5px dashed #cbd5e1",
            padding: "48px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              background: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ApiOutlined style={{ fontSize: 24, color: "#94a3b8" }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
              暂未配置通知或 MCP 扩展通道
            </div>
            <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4, maxWidth: 500 }}>
              大模型审查完代码后，可通过飞书、钉钉等群机器人向团队通报，或根据上下文自主决策调用你自写的 MCP 服务。
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <StudioButton
              variant="secondary"
              size="md"
              icon={<PlusOutlined />}
              onClick={() => handleOpenCreate("feishu")}
            >
              + 飞书群机器人
            </StudioButton>
            <StudioButton
              variant="secondary"
              size="md"
              icon={<PlusOutlined />}
              onClick={() => handleOpenCreate("dingtalk")}
            >
              + 钉钉群机器人
            </StudioButton>
            <StudioButton
              variant="primary"
              size="md"
              icon={<PlusOutlined />}
              onClick={() => handleOpenCreate("custom_mcp")}
            >
              + 自定义服务 (自写 MCP)
            </StudioButton>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mcpServers.map((item) => {
            const isCustom = item.type === "custom_mcp";
            return (
              <div
                key={item.id}
                style={{
                  background: "#ffffff",
                  borderRadius: 10,
                  border: "1.5px solid #e2e8f0",
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
                  opacity: item.enabled ? 1 : 0.65,
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      background: isCustom ? "#f5f3ff" : "#eff6ff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                    }}
                  >
                    {isCustom ? "⚡" : item.type === "dingtalk" ? "🔔" : item.type === "wechat" ? "🟢" : "💬"}
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>
                        {item.name}
                      </span>
                      <Tag
                        color={isCustom ? "purple" : "blue"}
                        style={{ borderRadius: 4, margin: 0, fontSize: 11 }}
                      >
                        {isCustom
                          ? "自写 MCP 扩展"
                          : item.type === "dingtalk"
                          ? "钉钉机器人"
                          : item.type === "wechat"
                          ? "企业微信"
                          : "飞书机器人"}
                      </Tag>
                      {item.decisionMode === "ai_adaptive" && (
                        <Tag color="cyan" style={{ borderRadius: 4, margin: 0, fontSize: 11 }}>
                          🧠 AI 灵活决策
                        </Tag>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {item.description || item.webhookUrl || "尚未配置详细描述"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Switch
                    checked={item.enabled}
                    onChange={(checked) => handleToggle(item.id, checked)}
                    size="small"
                  />
                  <StudioButton
                    variant="glass"
                    size="sm"
                    icon={<SettingOutlined />}
                    onClick={() => handleOpenEdit(item)}
                  >
                    配置
                  </StudioButton>
                  <Popconfirm
                    title="确定删除此通道？"
                    onConfirm={() => handleDelete(item.id)}
                    okText="删除"
                    cancelText="取消"
                  >
                    <StudioButton variant="danger" size="sm" icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Step4Integrations;
