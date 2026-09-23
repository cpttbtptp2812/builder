import { useEffect, useState } from "react";
import { checkBackendHealth, type BackendHealth } from "../lib/apiClient";

type Props = {
  compact?: boolean;
  /** 产品页：只显示圆点，不摊开技术文案 */
  quiet?: boolean;
};

/** 后端连接状态 — 产品页用 quiet 降噪 */
export function BackendStatusBar({ compact = false, quiet = false }: Props) {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    checkBackendHealth(true).then((h) => {
      setHealth(h);
      setLoading(false);
    });
  }, []);

  if (quiet) {
    const online = Boolean(health?.ok);
    const label = loading ? "检测中" : online ? "已连接服务端" : "本机运行";
    return (
      <div className="backend-status-quiet">
        <button
          type="button"
          className={`backend-dot ${loading ? "loading" : online ? "online" : "offline"}`}
          title={label}
          aria-label={label}
          onClick={() => setOpen((o) => !o)}
        />
        {open && (
          <div className="backend-quiet-tip">
            {loading ? (
              <span>正在检测运行环境…</span>
            ) : online ? (
              <span>服务端已连接，数据可持久化到 SQLite。</span>
            ) : (
              <span>演示模式：对话、知识库、广场均在本机运行；发布/广场数据存浏览器。完整管理后台需 docker compose 或 npm run dev:full</span>
            )}
          </div>
        )}
      </div>
    );
  }

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
        <strong>演示模式</strong>
        <span>无后端时自动降级本机运行；对话、广场、知识库可用。管理后台需启动服务端。</span>
      </div>
    );
  }

  return (
    <div className={`backend-status backend-status--online ${compact ? "compact" : ""}`}>
      <strong>服务端已连接</strong>
      <span>SQLite · {health.ragChunks} chunks</span>
    </div>
  );
}
