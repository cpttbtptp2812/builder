import { useEffect, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { getWorkNote } from "../data/workBriefs";
import { getWork } from "../data/works";

type Props = {
  slug: string | null;
  onClose: () => void;
};

/** 个人笔记弹框 */
export function WorkBriefModal({ slug, onClose }: Props) {
  const work = slug ? getWork(slug) : null;
  const note = slug ? getWorkNote(slug) : null;

  useEffect(() => {
    if (!slug) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [slug, onClose]);

  if (!slug || !work || !note) return null;

  return (
    <div className="note-overlay" role="presentation" onClick={onClose}>
      <div
        className="note-modal"
        role="dialog"
        aria-labelledby="note-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ "--note-accent": work.accent } as CSSProperties}
      >
        <header className="note-head">
          <div className="note-head-main">
            <p className="note-label">个人笔记 · 非正式</p>
            <h2 id="note-title">{work.title}</h2>
          </div>
          <button type="button" className="note-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="note-body">
          <section className="note-section note-purpose">
            <h3>为啥做这页演示</h3>
            <p>{note.purpose}</p>
          </section>

          {note.highlights.length > 0 && (
            <section className="note-section">
              <h3>核心技术亮点</h3>
              <ul className="note-highlights">
                {note.highlights.map((h) => (
                  <li key={h.title} className="note-highlight">
                    <h4>{h.title}</h4>
                    <p>{h.analysis}</p>
                    {h.metric && <em>{h.metric}</em>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="note-content">{note.content}</div>

          {note.techJots.length > 0 && (
            <section className="note-section">
              <h3>技术备忘</h3>
              <ul className="note-jots">
                {note.techJots.map((j) => (
                  <li key={j.tag}>
                    <strong>{j.tag}</strong>
                    <span>{j.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {note.scraps.length > 0 && (
            <section className="note-section">
              <h3>零碎记录</h3>
              <ul className="note-scraps">
                {note.scraps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="note-section note-site">
            <h3>这个站上的演示</h3>
            <p>{note.siteNote}</p>
          </section>

          <div className="note-stack">
            {work.stack.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>

        <footer className="note-foot">
          <Link to={`/work/${work.slug}?demo=1`} className="cta sm" onClick={onClose}>
            去看演示
          </Link>
          <button type="button" className="ghost-btn sm" onClick={onClose}>
            关掉
          </button>
        </footer>
      </div>
    </div>
  );
}
