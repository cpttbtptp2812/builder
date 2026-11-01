import React, { useState, useEffect } from "react";
import { Button, Tag, Space, Spin } from "antd";
import {
  MessageOutlined,
  RocketFilled,
  SlidersOutlined,
  ArrowRightOutlined,
  SafetyCertificateOutlined,
  ThunderboltFilled,
  ApiOutlined,
  BranchesOutlined,
  CheckCircleFilled,
  SyncOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { PipelineItem, GitRepositoryConfig } from "../../types/platform";
import { fetchGitRepositoriesApi } from "../../services/api";

interface HomePageProps {
  onEnterWorkbench: () => void;
  onEnterWorkbenchWithPrompt?: (prompt: string, autoSend?: boolean) => void;
  onLaunchWorkflow?: (workflow: PipelineItem) => void;
  onOpenRepositories?: () => void;
  onOpenModal: (tab: "settings" | "knowledge" | "tools" | "logs" | "agents" | "workflows") => void;
  workflows?: PipelineItem[];
}

export const HomePage: React.FC<HomePageProps> = ({
  onEnterWorkbench,
  onEnterWorkbenchWithPrompt,
  onOpenRepositories,
  onOpenModal,
}) => {
  const [savedRepos, setSavedRepos] = useState<GitRepositoryConfig[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(true);

  // 挂载时从真实 H2 数据库拉取已持久化的 Git 代码仓库列表
  useEffect(() => {
    let active = true;
    fetchGitRepositoriesApi()
      .then((repos) => {
        if (active) {
          setSavedRepos(repos || []);
          setLoadingRepos(false);
        }
      })
      .catch((err) => {
        console.warn("[ownagent] 主页读取真实代码仓库失败", err);
        if (active) setLoadingRepos(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const latestRepo = savedRepos.length > 0 ? savedRepos[0] : null;

  return (
    <div
      className="cyber-grid-canvas"
      style={{
        width: "100%",
        height: "calc(100vh - 56px)",
        maxHeight: "calc(100vh - 56px)",
        overflow: "hidden", // 严守单屏零滚动极简标准
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* 顶部科技感柔和环境光 (Ambient Aura) */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 560,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(99, 102, 241, 0.16) 0%, rgba(59, 130, 246, 0.05) 50%, transparent 75%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      {/* ──────────────── 1. 一个大图标：气场十足的核心标志 ──────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 22,
            background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #06b6d4 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 12px 32px rgba(99, 102, 241, 0.32), 0 0 0 1px rgba(255, 255, 255, 0.8) inset",
            color: "#ffffff",
            fontSize: 38,
            transition: "transform 0.3s ease, box-shadow 0.3s ease",
            cursor: "pointer",
          }}
          onClick={onEnterWorkbench}
          title="点击直接进入智能工作台"
        >
          <RocketFilled />
        </div>
      </div>

      {/* ──────────────── 2. 几句话：极简、震撼、直击痛点的文案 ──────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          textAlign: "center",
          maxWidth: 720,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* 顶部微型信标 */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "4px 14px",
            borderRadius: 20,
            background: "#ffffff",
            border: "1px solid #e0e7ff",
            boxShadow: "0 2px 6px rgba(99, 102, 241, 0.08)",
            marginBottom: 12,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#10b981",
              boxShadow: "0 0 8px #10b981",
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#4338ca", letterSpacing: "0.3px" }}>
            OWNAGENT · 企业级专业智能体系统
          </span>
        </div>

        {/* 主标题 */}
        <div
          style={{
            fontSize: "clamp(26px, 3vw, 38px)",
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-1px",
            lineHeight: 1.25,
            marginBottom: 12,
          }}
        >
          让 Agent 告别浅聊，
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #4f46e5 0%, #3b82f6 45%, #06b6d4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            成为真正懂业务的专家智能体
          </span>
        </div>

        {/* 精炼 Slogan */}
        <div
          style={{
            fontSize: "clamp(13px, 1.15vw, 15px)",
            color: "#64748b",
            lineHeight: 1.65,
            maxWidth: 580,
            marginBottom: 20,
          }}
        >
          赋予智能体代码感知、系统特权与确定性工程工具。
          <br />
          从 Git 资产守护到运维交付，全天候自主闭环企业真实业务流。
        </div>

        {/* ──────────────── 3. 行动按钮组 (高质感双 CTA) ──────────────── */}
        <Space size={14} style={{ marginBottom: 22 }}>
          <Button
            type="primary"
            size="large"
            icon={<MessageOutlined style={{ fontSize: 16 }} />}
            onClick={onEnterWorkbench}
            style={{
              height: 44,
              padding: "0 26px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
              border: "none",
              boxShadow: "0 4px 18px rgba(99, 102, 241, 0.4)",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>开启智能工作台</span>
            <ArrowRightOutlined style={{ fontSize: 12 }} />
          </Button>

          <Button
            size="large"
            icon={<SlidersOutlined style={{ fontSize: 15 }} />}
            onClick={() => onOpenModal("workflows")}
            style={{
              height: 44,
              padding: "0 20px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              background: "#ffffff",
              border: "1.5px solid #cbd5e1",
              color: "#1e293b",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
            }}
          >
            业务流方案库
          </Button>
        </Space>

        {/* ──────────────── 4. 实时守护中的代码仓库卡片 (真实数据库直连) ──────────────── */}
        <div style={{ width: "100%", maxWidth: 660, marginBottom: 20 }}>
          {loadingRepos ? (
            <div style={{ padding: "8px 0", color: "#94a3b8", fontSize: 12 }}>
              <Spin size="small" style={{ marginRight: 8 }} />
              正在同步真实已入库代码资产...
            </div>
          ) : latestRepo ? (
            <div
              style={{
                background: "#ffffff",
                borderRadius: 12,
                border: "1px solid #e0e7ff",
                boxShadow: "0 4px 16px rgba(99, 102, 241, 0.08), 0 1px 3px rgba(0, 0, 0, 0.03)",
                padding: "10px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                textAlign: "left",
                gap: 12,
              }}
            >
              {/* 左侧库信息 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap" }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#10b981",
                      boxShadow: "0 0 6px #10b981",
                      flexShrink: 0,
                    }}
                  />
                  <BranchesOutlined style={{ color: "#4f46e5", fontSize: 14, flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>
                    {latestRepo.name}
                  </span>
                  <Tag color="indigo" style={{ margin: 0, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                    {latestRepo.branch}
                  </Tag>
                  {savedRepos.length > 1 && (
                    <Tag color="default" style={{ margin: 0, borderRadius: 10, fontSize: 10.5, color: "#64748b" }}>
                      +{savedRepos.length - 1} 库
                    </Tag>
                  )}
                  {latestRepo.healthStatus === "warning" ? (
                    <Tag color="warning" style={{ margin: 0, borderRadius: 4, fontSize: 10.5 }}>
                      ⚠️ 风险阻断中
                    </Tag>
                  ) : (
                    <Tag color="success" style={{ margin: 0, borderRadius: 4, fontSize: 10.5 }}>
                      🟢 探活正常
                    </Tag>
                  )}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={latestRepo.lastCommitMessage || latestRepo.repoUrl}
                >
                  {latestRepo.lastCommitSha ? (
                    <span>
                      最新 Commit <code style={{ color: "#4f46e5", fontWeight: 600 }}>#{latestRepo.lastCommitSha}</code>: {latestRepo.lastCommitMessage}
                      {latestRepo.lastCommitAuthor && ` (${latestRepo.lastCommitAuthor.split(" <")[0]})`}
                    </span>
                  ) : (
                    <span>{latestRepo.repoUrl}</span>
                  )}
                </div>
              </div>

              {/* 右侧操作按钮 */}
              <Space size={8} style={{ flexShrink: 0 }}>
                <Button
                  size="small"
                  onClick={onOpenRepositories || (() => onOpenModal("workflows"))}
                  style={{
                    borderRadius: 6,
                    height: 28,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#475569",
                    background: "#f8fafc",
                    borderColor: "#cbd5e1",
                  }}
                >
                  管理仓库配置
                </Button>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    if (onEnterWorkbenchWithPrompt) {
                      onEnterWorkbenchWithPrompt(
                        `请对当前代码库「${latestRepo.name}」(${latestRepo.branch}分支) 最新提交 #${latestRepo.lastCommitSha || "HEAD"} 执行深度安全体检与依赖扫描。`,
                        true
                      );
                    } else {
                      onEnterWorkbench();
                    }
                  }}
                  style={{
                    borderRadius: 6,
                    height: 28,
                    fontSize: 12,
                    fontWeight: 600,
                    background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                    border: "none",
                  }}
                >
                  启动巡检 ➔
                </Button>
              </Space>
            </div>
          ) : (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 16px",
                borderRadius: 20,
                background: "rgba(255, 255, 255, 0.75)",
                border: "1px dashed #cbd5e1",
                fontSize: 12,
                color: "#64748b",
              }}
            >
              <span>📦 尚未接入代码仓库</span>
              <Button
                type="link"
                size="small"
                onClick={onOpenRepositories || (() => onOpenModal("workflows"))}
                style={{ fontSize: 12, padding: 0, fontWeight: 700, color: "#4f46e5" }}
              >
                立即接入生产代码库 ➔
              </Button>
            </div>
          )}
        </div>

        {/* ──────────────── 5. 极简三大专业能力胶囊 ──────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div
            onClick={onOpenRepositories || (() => onOpenModal("workflows"))}
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 14px",
              borderRadius: 20,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
              fontSize: 12,
              color: "#334155",
              fontWeight: 600,
              transition: "all 0.15s ease",
            }}
          >
            <SafetyCertificateOutlined style={{ color: "#4f46e5", fontSize: 13 }} />
            <span>代码守护智能体：Commit 巡检与脱敏自愈</span>
          </div>

          <div
            onClick={() => {
              if (onEnterWorkbenchWithPrompt) {
                onEnterWorkbenchWithPrompt("请探活当前关联的服务器运行状态，检查 CPU 与日志", true);
              } else {
                onEnterWorkbench();
              }
            }}
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 14px",
              borderRadius: 20,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
              fontSize: 12,
              color: "#334155",
              fontWeight: 600,
              transition: "all 0.15s ease",
            }}
          >
            <ThunderboltFilled style={{ color: "#0284c7", fontSize: 13 }} />
            <span>运维与 Sudo 智能体：服务器探活与高危熔断</span>
          </div>

          <div
            onClick={() => {
              if (onEnterWorkbenchWithPrompt) {
                onEnterWorkbenchWithPrompt("比对后端 API 变动，检查客户端契约兼容性", true);
              } else {
                onEnterWorkbench();
              }
            }}
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 14px",
              borderRadius: 20,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
              fontSize: 12,
              color: "#334155",
              fontWeight: 600,
              transition: "all 0.15s ease",
            }}
          >
            <ApiOutlined style={{ color: "#7c3aed", fontSize: 13 }} />
            <span>契约与交付智能体：微服务对齐与流水线</span>
          </div>
        </div>

        {/* 底部信任行 */}
        <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 10 }}>
          <span>🔒 只读安全沙箱与 Sudo 双控</span>
          <span>•</span>
          <span>⚡ 真实环境直连 · 零 Mock 假数据</span>
          <span>•</span>
          <span>🧩 确定性 DAG 业务流编排</span>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
