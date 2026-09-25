import { useEffect, useMemo, useRef, useState } from "react";
import { listPlaza, scorePlazaLocal } from "../../../lib/plazaFeed";
import { listKnowledgeDocs, listKnowledgePrompts } from "../../../lib/ownKnowledge";

export type SuggestItem = {
  id: string;
  text: string;
  hint: string;
  source: "plaza" | "kb" | "example";
  score: number;
};

const MIN_SCORE = 55;
const DEBOUNCE_MS = 480;

function norm(s: string) {
  return s.trim().toLowerCase();
}

function scoreKbPrompt(query: string, prompt: string): number {
  const q = norm(query);
  const p = norm(prompt);
  if (!q || q.length < 2 || !p) return 0;
  if (p === q) return 100;
  if (p.includes(q) || q.includes(p)) return 88;
  const qTokens = q.split(/[\s，。？?、]+/).filter((t) => t.length >= 2);
  if (qTokens.length === 0) return 0;
  const hit = qTokens.filter((t) => p.includes(t)).length;
  return hit === 0 ? 0 : Math.round((hit / qTokens.length) * 78);
}

async function collectSuggestions(query: string, exclude: Set<string>, skipPlaza = false): Promise<SuggestItem[]> {
  const q = query.trim();
  const out: SuggestItem[] = [];

  if (!q) {
    for (const ex of listKnowledgePrompts(5)) {
      if (exclude.has(norm(ex.text))) continue;
      out.push({
        id: `ex-${ex.docId}`,
        text: ex.text,
        hint: ex.hint,
        source: "example",
        score: 100,
      });
    }
    return out;
  }

  if (q.startsWith("/")) return [];

  if (!skipPlaza) try {
    const { items: plazaItems } = await listPlaza(q, 12);
    for (const item of plazaItems) {
      const text = item.question.trim();
      if (!text || exclude.has(norm(text))) continue;
      const score = scorePlazaLocal(q, item);
      if (score >= MIN_SCORE) {
        out.push({
          id: `plaza-${item.id}`,
          text,
          hint: "知识广场",
          source: "plaza",
          score,
        });
      }
    }
  } catch { /* local fallback inside listPlaza */ }

  for (const doc of listKnowledgeDocs()) {
    if (!doc.body.trim()) continue;
    for (const raw of doc.prompts) {
      const text = raw.trim();
      if (!text || exclude.has(norm(text))) continue;
      const score = scoreKbPrompt(q, text);
      if (score >= MIN_SCORE) {
        out.push({
          id: `kb-${doc.id}-${text.slice(0, 12)}`,
          text,
          hint: doc.title,
          source: "kb",
          score,
        });
      }
    }
  }

  const seen = new Set<string>();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((it) => {
      const k = norm(it.text);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 5);
}

const SOURCE_ICON: Record<SuggestItem["source"], string> = {
  plaza: "🌐",
  kb: "📖",
  example: "💡",
};

/** 输入暂停后弹出相关建议，供点选（非逐字弹出无关项） */
export function InputSuggestPopup({
  input,
  running,
  focused,
  exclude,
  onPick,
  onClose,
  skipPlaza = false,
  showExamples: allowExamples = true,
}: {
  input: string;
  running?: boolean;
  focused?: boolean;
  exclude?: string[];
  onPick: (text: string) => void;
  onClose?: () => void;
  /** 广场条目由外部「直接采用」弹层展示时关闭 */
  skipPlaza?: boolean;
  /** 空输入时是否弹出示例（外部已有快捷提问时关闭） */
  showExamples?: boolean;
}) {
  const [items, setItems] = useState<SuggestItem[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const dismissedRef = useRef(false);
  const itemsRef = useRef<SuggestItem[]>([]);
  itemsRef.current = items;

  const blocked = useMemo(() => new Set((exclude ?? []).map(norm)), [exclude]);

  useEffect(() => {
    dismissedRef.current = false;
  }, [input]);

  useEffect(() => {
    if (running || !focused) {
      setOpen(false);
      setItems([]);
      return;
    }

    const q = input.trim();
    const showExamples = !q;

    if ((showExamples && !allowExamples) || (!showExamples && q.length < 2)) {
      setOpen(false);
      setItems([]);
      return;
    }

    // 示例只属于空输入，开始打字立即收起，不等防抖
    if (!showExamples && itemsRef.current.some((it) => it.source === "example")) {
      setOpen(false);
      setItems([]);
    }

    setLoading(!showExamples);
    const timer = window.setTimeout(() => {
      void collectSuggestions(input, blocked, skipPlaza).then((next) => {
        setLoading(false);
        if (dismissedRef.current) return;
        setItems(next);
        setActiveIdx(0);
        setOpen(next.length > 0);
      });
    }, showExamples ? 0 : DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [input, running, focused, blocked, skipPlaza, allowExamples]);

  useEffect(() => {
    if (!open || !items.length) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        dismissedRef.current = true;
        setOpen(false);
        onClose?.();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, items.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Tab") {
        const s = items[activeIdx];
        if (s) {
          e.preventDefault();
          dismissedRef.current = true;
          setOpen(false);
          onPick(s.text);
        }
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, items, activeIdx, onPick, onClose]);

  if (!open || !items.length) return null;

  const q = input.trim();
  const title = !q ? "快捷提问 · 点选填入输入框" : "相关问题 · 点选或 Tab 填入";

  return (
    <div className="ua-suggest-popup" role="dialog" aria-label="输入建议">
      <div className="ua-suggest-popup-head">
        <span>{title}</span>
        {loading && <i className="ua-suggest-spin" aria-hidden />}
      </div>
      <ul className="ua-suggest-popup-list" role="listbox">
        {items.map((s, i) => (
          <li
            key={s.id}
            role="option"
            aria-selected={i === activeIdx}
            className={`ua-kb-ac-item${i === activeIdx ? " active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              dismissedRef.current = true;
              setOpen(false);
              onPick(s.text);
            }}
            onMouseEnter={() => setActiveIdx(i)}
          >
            <span className="ua-kb-ac-icon" aria-hidden>
              {SOURCE_ICON[s.source]}
            </span>
            <span className="ua-kb-ac-body">
              <strong>{s.text}</strong>
              <em>
                {s.hint}
                {s.score >= 70 && s.source !== "example" ? ` · 匹配 ${s.score}%` : ""}
              </em>
            </span>
            <span className="ua-kb-ac-tab" aria-hidden>
              {i === activeIdx ? "Tab" : ""}
            </span>
          </li>
        ))}
      </ul>
      {q && (
        <div className="ua-suggest-popup-foot">
          Esc 关闭 · Enter 仍发送「{q.length > 18 ? `${q.slice(0, 18)}…` : q}」
        </div>
      )}
    </div>
  );
}
