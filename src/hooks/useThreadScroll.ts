import { useCallback, useEffect, useRef, useState } from "react";

/** 粘底滚动 + 结果定位 — 避免内容增高误判为用户上滑 */
export function useThreadScroll(deps: unknown[]) {
  const threadRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const programmaticRef = useRef(false);
  const [away, setAway] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  const markProgrammatic = useCallback((ms = 420) => {
    programmaticRef.current = true;
    window.setTimeout(() => {
      programmaticRef.current = false;
    }, ms);
  }, []);

  const scrollToBottom = useCallback(
    (smooth = false) => {
      const el = threadRef.current;
      if (!el) return;
      stickRef.current = true;
      setAway(false);
      markProgrammatic(smooth ? 520 : 100);
      const top = el.scrollHeight;
      if (smooth) el.scrollTo({ top, behavior: "smooth" });
      else el.scrollTop = top;
    },
    [markProgrammatic],
  );

  /** 定位到某条消息（结果卡顶部进入视口） */
  const scrollToMessage = useCallback(
    (id: string, smooth = true) => {
      const root = threadRef.current;
      if (!root) return;
      const node = root.querySelector(`[data-msg-id="${CSS.escape(id)}"]`) as HTMLElement | null;
      if (!node) {
        scrollToBottom(smooth);
        return;
      }
      stickRef.current = true;
      setAway(false);
      setFocusId(id);
      markProgrammatic(700);
      const top = Math.max(0, node.offsetTop - 16);
      if (smooth) root.scrollTo({ top, behavior: "smooth" });
      else root.scrollTop = top;
      window.setTimeout(() => setFocusId(null), 1800);
    },
    [markProgrammatic, scrollToBottom],
  );

  const onThreadScroll = useCallback(() => {
    if (programmaticRef.current) return;
    const el = threadRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = dist < 96;
    stickRef.current = nearBottom;
    setAway(!nearBottom);
  }, []);

  // 内容 / 流式变化：粘底则瞬时跟焦
  useEffect(() => {
    if (!stickRef.current) return;
    const el = threadRef.current;
    if (!el) return;
    markProgrammatic(50);
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // 内容区高度变化（表格/HITL 展开）继续粘底
  useEffect(() => {
    const content = contentRef.current;
    const el = threadRef.current;
    if (!content || !el) return;
    const ro = new ResizeObserver(() => {
      if (!stickRef.current) return;
      markProgrammatic(40);
      el.scrollTop = el.scrollHeight;
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [markProgrammatic]);

  return {
    threadRef,
    contentRef,
    sentinelRef,
    away,
    focusId,
    scrollToBottom,
    scrollToMessage,
    onThreadScroll,
    stickRef,
  };
}
