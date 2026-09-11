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
        <strong>浏览器内运行时</strong>
        <span>
          服务端未启动，已按设计降级 — 能力全部可用，数据存本机。跑全量：<code>npm run dev:full</code>
        </span>
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
