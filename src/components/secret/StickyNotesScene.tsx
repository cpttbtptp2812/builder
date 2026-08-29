import { useState } from "react";
import { secretRomance } from "../../data/secretRomance";

/** 林婷的两张纸条 — 点击翻转 + 光尘 */
export function StickyNotesScene({
  onComplete,
  onBurst,
}: {
  onComplete: () => void;
  onBurst?: (x: number, y: number) => void;
}) {
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const notes = secretRomance.notes;
  const allFlipped = flipped.size >= notes.length;

  function toggle(id: string, e: React.MouseEvent) {
    setFlipped((prev) => {
      const next = new Set(prev);
      const wasFlipped = next.has(id);
      if (wasFlipped) next.delete(id);
      else {
        next.add(id);
        onBurst?.(e.clientX, e.clientY);
      }
      return next;
    });
  }

  return (
    <section className="secret-notes">
      <h2>林婷的纸条</h2>
      <p className="secret-notes-lead">
        {allFlipped ? "读完了。收好它们 ↓" : "夹在金刚经里的两张纸条——点击翻开"}
      </p>

      <div className="secret-notes-grid">
        {notes.map((note) => {
          const isFlipped = flipped.has(note.id);
          return (
            <button
              key={note.id}
              type="button"
              className={`secret-note-card ${note.color}${isFlipped ? " flipped glow" : ""}`}
              onClick={(e) => toggle(note.id, e)}
            >
              <div className="secret-note-inner">
                <div className="secret-note-front">
                  <span className="secret-note-label">{note.label}</span>
                  <span className="secret-note-hint">林婷写给你的</span>
                </div>
                <div className="secret-note-back">
                  <p className="secret-note-hand">{note.text}</p>
                  {note.smile && <span className="secret-note-smile">☺</span>}
                  <span className="secret-note-label back">{note.label}</span>
                </div>
              </div>
              {isFlipped && <span className="secret-note-dust" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {allFlipped && (
        <button
          type="button"
          className="secret-notes-continue"
          onClick={(e) => {
            onBurst?.(e.clientX, e.clientY);
            onComplete();
          }}
        >
          收好纸条，继续 ✦
        </button>
      )}
    </section>
  );
}
