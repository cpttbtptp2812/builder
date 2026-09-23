import { useState } from "react";
import { Link } from "react-router-dom";
import type { ResumeProjectEntry } from "../data/resumeContent";
import { formatBossProject, isNumberedList, splitBossLines } from "../lib/resumeBoss";
import { ResumeSections } from "./ResumeSections";

function BossBlock({ label, text }: { label: string; text: string }) {
  const pureList = isNumberedList(text);
  const lines = splitBossLines(text);

  return (
    <div className="resume-boss-block">
      <h5 className="resume-boss-label">{label}</h5>
      {pureList ? (
        <ol className="resume-boss-list">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      ) : (
        <pre className="resume-boss-text">{text.trim()}</pre>
      )}
    </div>
  );
}

export function ResumeProjectCard({ project }: { project: ResumeProjectEntry }) {
  const [copied, setCopied] = useState(false);
  const plain = project.plain;

  async function copyBoss() {
    if (!plain) return;
    await navigator.clipboard.writeText(formatBossProject(plain));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <article className={`resume-project-card${project.personal ? " resume-project-card--personal" : ""}`}>
      <header className="resume-project-head">
        <div>
          <h3>{project.name}</h3>
          <p className="resume-project-meta">
            {project.personal ? "个人项目 · " : ""}
            {project.role} · {project.period}
          </p>
        </div>
        {plain ? (
          <button type="button" className="resume-boss-copy" onClick={copyBoss}>
            {copied ? "已复制 ✓" : "复制 BOSS 格式"}
          </button>
        ) : null}
      </header>

      {project.stack && project.stack.length > 0 ? (
        <div className="resume-project-stack compact top">
          {project.stack.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}

      {plain ? (
        <div className="resume-boss-panel">
          <p className="resume-boss-hint">以下内容可直接粘贴至 BOSS 直聘「项目经历」</p>
          <BossBlock label="项目描述" text={plain.description} />
          <BossBlock label="项目业绩" text={plain.performance} />
        </div>
      ) : null}

      <ResumeSections sections={project.sections} />

      <div className="resume-project-block">
        <h4>项目成果</h4>
        <ul>
          {project.achievements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {project.workSlug ? (
        <Link to={`/work/${project.workSlug}`} className="resume-project-link">
          查看实现 →
        </Link>
      ) : null}
    </article>
  );
}
