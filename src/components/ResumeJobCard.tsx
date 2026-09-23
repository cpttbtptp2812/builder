import { useState } from "react";
import type { JobExperienceEntry } from "../data/resumeContent";
import { formatBossJob, isNumberedList, splitBossLines } from "../lib/resumeBoss";
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

export function ResumeJobCard({ job }: { job: JobExperienceEntry }) {
  const [copied, setCopied] = useState(false);
  const plain = job.plain;

  async function copyBoss() {
    if (!plain) return;
    await navigator.clipboard.writeText(formatBossJob(job.company, job.role, job.period, plain));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <article className="resume-job-card resume-job-card--compact">
      <header className="resume-job-card-head">
        <div>
          <strong>{job.company}</strong>
          <span>{job.role}</span>
        </div>
        <div className="resume-job-card-head-right">
          <time>{job.period}</time>
          {plain ? (
            <button type="button" className="resume-boss-copy resume-boss-copy--sm" onClick={copyBoss}>
              {copied ? "已复制 ✓" : "复制 BOSS 格式"}
            </button>
          ) : null}
        </div>
      </header>

      {job.stack && job.stack.length > 0 ? (
        <div className="resume-project-stack compact">
          {job.stack.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}

      {plain ? (
        <div className="resume-boss-panel resume-boss-panel--job">
          <BossBlock label="工作内容" text={plain.description} />
          <BossBlock label="工作业绩" text={plain.performance} />
        </div>
      ) : null}

      <ResumeSections sections={job.sections} />
    </article>
  );
}
