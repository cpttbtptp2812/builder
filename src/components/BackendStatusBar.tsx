import { useEffect, useState } from "react";
import { checkBackendHealth, type BackendHealth } from "../lib/apiClient";
import { isLlmProbeLive, loadLlmConfig } from "../lib/llmConfig";

type Props = {
  compact?: boolean;
  /** 产品页：显示客户自己的模型有没有连上 */
  quiet?: boolean;
};

/** 后端连接状态 — 产品页用 quiet 降噪 */
export function BackendStatusBar({ compact = false, quiet = false }: Props) {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [modelLink, setModelLink] = useState(() => {
    const cfg = loadLlmConfig();
    return { live: isLlmProbeLive(cfg), model: cfg.model.trim() };
  });

  useEffect(() => {
    checkBackendHealth(true).then((h) => {
      setHealth(h);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const sync = () => {
      const cfg = loadLlmConfig();
      setModelLink({ live: isLlmProbeLive(cfg), model: cfg.model.trim() });
    };
    sync();
    window.addEventListener("ownagent:config-updated", sync);
    return () => window.removeEventListener("ownagent:config-updated", sync);
  }, []);

  if (quiet) {
    const label = modelLink.live ? `已连接 ${modelLink.model}` : "未连接你的模型";
    return (
      <div className="backend-status-quiet">
        <button
          type="button"
          className="backend-link"
          title={label}
          aria-label={label}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={`backend-dot ${modelLink.live ? "online" : "offline"}`} aria-hidden />
          <span>{label}</span>
        </button>
        {open && (
          <div className="backend-quiet-tip">
            {modelLink.live ? (
              <span>这是你自己的 Key 连上的 {modelLink.model}。线上也是每位客户自己连接，平台不代连。</span>
            ) : (
              <span>还没连上你的模型。在接入配置填自己的 Key，测试连接通过后这里才变绿。线上同样是客户自己连。</span>
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
