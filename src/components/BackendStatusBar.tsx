import { useEffect, useState } from "react";
import { checkBackendHealth, type BackendHealth } from "../lib/apiClient";

type Props = {
  compact?: boolean;
};

/** 显示后端 SQLite API 连接状态 */
export function BackendStatusBar({ compact = false }: Props) {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkBackendHealth(true).then((h) => {
      setHealth(h);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className={`backend-status backend-status--loading ${compact ? "compact" : ""}`}>
        正在连接后端…
      </div>
    );
  }

  if (!health?.ok) {
    return (
      <div className={`backend-status backend-status--offline ${compact ? "compact" : ""}`}>
        <strong>离线演示模式</strong>
        <span>未检测到 API 服务 — 数据在浏览器内，刷新即丢失。本地请运行 <code>npm run dev:full</code></span>
      </div>
    );
  }

  return (
    <div className={`backend-status backend-status--online ${compact ? "compact" : ""}`}>
      <strong>服务端运行中</strong>
      <span>
        SQLite · {health.ragChunks} chunks · {health.skillRuns} skill runs · {health.workflowRuns} workflows
        {health.llm ? " · LLM 已配置" : ""}
      </span>
    </div>
  );
}
