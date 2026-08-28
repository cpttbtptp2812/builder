import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { buildMultiProjectPrompt, PROJECT_DETAILS, type ProjectDetail } from "../data/knowledge";
import { profile } from "../data/profile";
import { useStore } from "../store";

type Filter = "all" | "current" | "history";

export function EntryPage() {
  const nav = useNavigate();
  const setPendingChat = useStore((s) => s.setPendingChat);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focused, setFocused] = useState<string>(PROJECT_DETAILS[0]!.id);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return PROJECT_DETAILS;
    return PROJECT_DETAILS.filter((p) => p.era === filter);
  }, [filter]);

  const preview = PROJECT_DETAILS.find((p) => p.id === focused) ?? PROJECT_DETAILS[0]!;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setFocused(id);
  }

  function selectAllVisible() {
    setSelected(new Set(filtered.map((p) => p.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function enterChat(projectIds: string[]) {
    const prompt =
      projectIds.length > 0
        ? buildMultiProjectPrompt(projectIds)
        : null;
    setPendingChat(prompt, projectIds);
    nav("/demo/chat");
  }

  function chatOne(p: ProjectDetail) {
    enterChat([p.id]);
  }

  return (
    <div className="entry">
      <header className="entry-head">
        <div className="entry-intro">
          <p className="eyebrow">Portfolio · {profile.years} 年经验</p>
          <h1>{profile.name}</h1>
          <p className="entry-title">{profile.title} · {profile.location}</p>
          <p className="entry-lead">{profile.summary}</p>
          <div className="entry-actions">
            <Link to="/about" className="ghost-btn">
              查看完整简历
            </Link>
            <button type="button" className="cta" onClick={() => enterChat([])}>
              直接体验技术演示
            </button>
          </div>
        </div>
        <aside className="entry-contact">
          <h3>联系方式</h3>
          <p><a href={`mailto:${profile.email}`}>{profile.email}</a></p>
          <p><a href={`tel:${profile.phone}`}>{profile.phone}</a></p>
          <ul className="metrics">
            {profile.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </aside>
      </header>

      <main className="entry-main">
        <div className="entry-toolbar">
          <div>
            <h2>选择感兴趣的项目</h2>
            <p>可多选，带入对话；点击卡片右侧可预览详情（含历史银行/阿里项目）</p>
          </div>
          <div className="entry-filters">
            {(
              [
                ["all", "全部"],
                ["current", "AI 平台（当前）"],
                ["history", "银行 / 阿里（历史）"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={filter === key ? "f on" : "f"}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="entry-grid">
          <div className="entry-cards">
            <div className="entry-select-bar">
              <span>{selected.size} 项已选</span>
              <button type="button" className="link-btn" onClick={selectAllVisible}>
                全选当前
              </button>
              <button type="button" className="link-btn" onClick={clearSelection}>
                清空
              </button>
            </div>

            {filtered.map((p) => {
              const on = selected.has(p.id);
              const isFocus = focused === p.id;
              return (
                <article
                  key={p.id}
                  className={`entry-card ${on ? "selected" : ""} ${isFocus ? "focus" : ""}`}
                >
                  <label className="entry-check">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(p.id)}
                    />
                    <span className="check-ui" />
                  </label>
                  <button
                    type="button"
                    className="entry-card-body"
                    onClick={() => setFocused(p.id)}
                  >
                    <div className="entry-card-top">
                      <h3>{p.name}</h3>
                      <span className={`era ${p.era}`}>
                        {p.era === "current" ? "当前" : "历史"}
                      </span>
                    </div>
                    <p className="project-meta">{p.role} · {p.period}</p>
                    <p className="entry-card-desc">{p.desc}</p>
                    <div className="stack">
                      {p.stack.slice(0, 4).map((s) => (
                        <span key={s}>{s}</span>
                      ))}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="entry-card-chat"
                    onClick={() => chatOne(p)}
                  >
                    单独了解 →
                  </button>
                </article>
              );
            })}
          </div>

          <aside className="entry-preview">
            <header>
              <h2>{preview.name}</h2>
              <p className="project-meta">{preview.role} · {preview.period}</p>
            </header>
            <p>{preview.desc}</p>
            <section>
              <h4>架构</h4>
              <p>{preview.architecture}</p>
            </section>
            <section>
              <h4>核心成果</h4>
              <ul>
                {preview.achievements.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
            <section>
              <h4>技术难点</h4>
              <ul>
                {preview.challenges.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>
            <div className="entry-preview-actions">
              <button type="button" className="cta sm" onClick={() => chatOne(preview)}>
                聊这个项目
              </button>
              {preview.demo && (
                <button type="button" className="ghost-btn sm" onClick={() => enterChat([])}>
                  看交互演示
                </button>
              )}
            </div>
          </aside>
        </div>
      </main>

      <footer className="entry-foot">
        <p>
          {selected.size > 0
            ? `已选 ${selected.size} 个项目，将带入对话逐一介绍`
            : "未选项目也可直接进入演示，或先浏览右侧详情"}
        </p>
        <button
          type="button"
          className="cta"
          disabled={selected.size === 0}
          onClick={() => enterChat([...selected])}
        >
          带选中项目开始交流 ({selected.size})
        </button>
      </footer>
    </div>
  );
}
