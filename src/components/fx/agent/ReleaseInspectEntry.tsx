/** 对话框上方 — 发布前巡检入口（任意 URL） */

import { useEffect, useRef, useState } from "react";
import { checkBackendHealth } from "../../../lib/apiClient";
import { getProbeUrl } from "../../../lib/sessionId";

export function ReleaseInspectEntry({
  disabled,
  onInspect,
  compact = false,
  variant = "default",
}: {
  disabled?: boolean;
  onInspect: (url: string) => void;
  /** Hub 模式默认收起，节省对话区高度 */
  compact?: boolean;
  /** 输入栏内仅图标，悬停看说明 */
  variant?: "default" | "icon";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [open, setOpen] = useState(!compact);

  useEffect(() => {
    let cancelled = false;
    void checkBackendHealth(true).then((h) => {
      if (!cancelled) setApiOk(Boolean(h?.ok));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = (url?: string) => {
    let v = (url ?? inputRef.current?.value ?? "").trim();
    v = v.replace(/^\/inspect\s+/gi, "").trim();
    if (v) onInspect(v);
  };

  const probeUrl = typeof window !== "undefined" ? getProbeUrl() : "";

  const apiHint = apiOk === true ? "API 就绪" : apiOk === false ? "需 dev:server" : "检测中…";

  if (variant === "icon" && compact && !open) {
    return (
      <button
        type="button"
        className="oc-inspect-icon"
        disabled={disabled}
        title={`发布前巡检 · ${apiHint}${probeUrl ? " · 双击测本站" : ""}`}
        onClick={() => setOpen(true)}
        onDoubleClick={() => {
          if (probeUrl) onInspect(probeUrl);
        }}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
          <path
            d="M7.5 1.5L2 4v3.5c0 3.2 2.3 5.5 5.5 6.5 3.2-1 5.5-3.3 5.5-6.5V4L7.5 1.5z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path d="M5.5 7.5l1.3 1.3L9.8 5.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    );
  }

  if (compact && !open) {
    return (
      <div className="release-inspect-entry release-inspect-entry--collapsed">
        <button type="button" className="release-inspect-entry-toggle" disabled={disabled} onClick={() => setOpen(true)}>
          <span>发布前巡检</span>
          <em>{apiOk ? "API 就绪" : "展开输入 URL"}</em>
        </button>
        {probeUrl ? (
          <button
            type="button"
            className="release-inspect-entry-quick"
            disabled={disabled}
            onClick={() => onInspect(probeUrl)}
          >
            测本站
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`release-inspect-entry${compact ? " compact" : ""}${variant === "icon" ? " release-inspect-entry--icon-pop" : ""}`}
    >
      <div className="release-inspect-entry-top">
        <span className="release-inspect-entry-label">发布前巡检</span>
        {apiOk === true ? (
          <span className="release-inspect-api ok">API 就绪</span>
        ) : apiOk === false ? (
          <span className="release-inspect-api warn">需 dev:server</span>
        ) : null}
        {compact ? (
          <button type="button" className="release-inspect-entry-fold" onClick={() => setOpen(false)}>
            收起
          </button>
        ) : null}
      </div>
      <div className="release-inspect-entry-row">
        <input
          ref={inputRef}
          type="url"
          className="release-inspect-entry-input"
          placeholder={probeUrl || "https://staging.example.com"}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              submit();
            }
          }}
        />
        {probeUrl ? (
          <button
            type="button"
            className="release-inspect-entry-quick"
            disabled={disabled}
            onClick={() => submit(probeUrl)}
            title="探当前站点入口页（含 /builder/ 等子路径）"
          >
            测本站
          </button>
        ) : null}
        <button type="button" className="release-inspect-entry-btn" disabled={disabled} onClick={() => submit()}>
          开始巡检
        </button>
      </div>
      {!compact && (
        <p className="release-inspect-entry-hint">
          报告已生成即巡检成功；建议发布 = URL 返回 200 且无错误页信号。
        </p>
      )}
    </div>
  );
}
