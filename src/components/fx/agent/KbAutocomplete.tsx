import { useEffect, useMemo, useRef, useState } from "react";
import { listKnowledgeDocs } from "../../../lib/ownKnowledge";

type Suggestion = { text: string; hint: string; docId: string };

function norm(s: string) {
  return s.trim().toLowerCase();
}

/** 输入框上方：知识库问句智能补全 */
export function KbAutocomplete({
  query,
  exclude,
  onPick,
}: {
  query: string;
  exclude?: string[];
  onPick: (text: string) => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = norm(query);
    if (q.length < 2) return [];
    const blocked = new Set((exclude ?? []).map(norm));
    const results: Suggestion[] = [];
    for (const doc of listKnowledgeDocs()) {
      if (!doc.body.trim()) continue;
      for (const p of doc.prompts) {
        const pt = p.trim();
        if (!pt || blocked.has(norm(pt))) continue;
        if (norm(pt).includes(q) || q.split("").some((c) => norm(pt).includes(c))) {
          // basic character-level fuzzy
          const overlap = q.split("").filter((c) => norm(pt).includes(c)).length;
          if (overlap / q.length >= 0.5) {
            results.push({ text: pt, hint: doc.title, docId: doc.id });
          }
        }
        if (results.length >= 5) break;
      }
      if (results.length >= 5) break;
    }
    return results;
  }, [query, exclude]);

  // reset index when suggestions change
  useEffect(() => setActiveIdx(0), [suggestions.length]);

  const listRef = useRef<HTMLUListElement>(null);

  // keyboard support
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!suggestions.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Tab" || e.key === "Enter") {
        const s = suggestions[activeIdx];
        if (s) {
          e.preventDefault();
          onPick(s.text);
        }
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [suggestions, activeIdx, onPick]);

  if (!suggestions.length) return null;

  return (
    <ul ref={listRef} className="ua-kb-autocomplete" role="listbox" aria-label="知识库建议">
      {suggestions.map((s, i) => (
        <li
          key={s.docId + i}
          role="option"
          aria-selected={i === activeIdx}
          className={`ua-kb-ac-item${i === activeIdx ? " active" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault(); // don't blur textarea
            onPick(s.text);
          }}
          onMouseEnter={() => setActiveIdx(i)}
        >
          <span className="ua-kb-ac-icon" aria-hidden>📖</span>
          <span className="ua-kb-ac-body">
            <strong>{s.text}</strong>
            <em>{s.hint}</em>
          </span>
          <span className="ua-kb-ac-tab" aria-hidden>Tab ↵</span>
        </li>
      ))}
    </ul>
  );
}
