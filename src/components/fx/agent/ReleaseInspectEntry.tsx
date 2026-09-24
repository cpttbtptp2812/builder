/** 对话框上方 — 发布前巡检入口（任意 URL） */

import { useEffect, useRef, useState } from "react";
import { checkBackendHealth } from "../../../lib/apiClient";

export function ReleaseInspectEntry({
  disabled,
  onInspect,
  compact = false,
}: {
  disabled?: boolean;
  onInspect: (url: string) => void;
  /** Hub 模式默认收起，节省对话区高度 */
  compact?: boolean;
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

  const localOrigin = typeof window !== "undefined" ? window.location.origin : "";

  if (compact && !open) {
    return (
      <div className="release-inspect-entry release-inspect-entry--collapsed">
        <button type="button" className="release-inspect-entry-toggle" disabled={disabled} onClick={() => setOpen(true)}>
          <span>发布前巡检</span>
          <em>{apiOk ? "API 就绪" : "展开输入 URL"}</em>
        </button>
        {localOrigin ? (
          <button
            type="button"
            className="release-inspect-entry-quick"
            disabled={disabled}
            onClick={() => onInspect(localOrigin)}
          >
            测本站
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`release-inspect-entry${compact ? " compact" : ""}`}>
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
          placeholder={`${localOrigin || "https://staging.example.com"}`}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              submit();
            }
          }}
        />
        {localOrigin ? (
          <button
            type="button"
            className="release-inspect-entry-quick"
            disabled={disabled}
            onClick={() => submit(localOrigin)}
            title="探当前开发站，验证巡检链路"
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
