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
              <span>当前在本机浏览器运行，全部能力可用。可选启动服务端：npm run dev:full</span>
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
        <strong>本机运行</strong>
        <span>服务端未启动时自动降级，能力仍可用。</span>
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
