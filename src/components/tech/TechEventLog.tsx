import { useEffect, useRef } from "react";
import type { TechEvent } from "../../lib/techLog";

type Props = {
  events: TechEvent[];
  title?: string;
  hint?: string;
  empty?: string;
  className?: string;
  /** 默认 true；SkillForge 内关闭，避免整页滚到底部 */
  autoScroll?: boolean;
};

/** 浅色技术事件流 — 每次操作打出 API 名 */
export function TechEventLog({
  events,
  title = "技术事件流",
  hint = "每次操作对应真实 API",
  empty = "操作后这里会逐条打出用了什么技术…",
  className = "",
  autoScroll = true,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length, autoScroll]);

  return (
    <div className={`tech-event-log ${className}`.trim()}>
      <header>
        <span>{title}</span>
        <em>{hint}</em>
      </header>
      <pre className="tech-log-body">
        {events.length === 0 && <span className="pipeline-empty dark">{empty}</span>}
        {events.map((e) => (
          <div key={e.id} className={`tech-log-line kind-${e.kind}`}>
            <span className="tech-log-api">{e.api}</span>
            <span className="tech-log-detail">{e.detail}</span>
          </div>
        ))}
        <div ref={endRef} />
      </pre>
    </div>
  );
}
