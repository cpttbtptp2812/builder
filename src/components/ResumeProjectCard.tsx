import { Link } from "react-router-dom";
import type { ResumeProjectEntry } from "../data/resumeContent";
import { ResumeSections } from "./ResumeSections";

export function ResumeProjectCard({ project }: { project: ResumeProjectEntry }) {
  return (
    <article className="resume-project-card">
      <header className="resume-project-head">
        <div>
          <h3>{project.name}</h3>
          <p className="resume-project-meta">
            {project.role} · {project.period}
          </p>
        </div>
      </header>

      <ResumeSections sections={project.sections} />

      <div className="resume-project-block">
        <h4>业绩</h4>
        <ul>
          {project.achievements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {project.stack && project.stack.length > 0 ? (
        <div className="resume-project-stack">
          {project.stack.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}

      {project.workSlug ? (
        <Link to={`/work/${project.workSlug}`} className="resume-project-link">
          查看交互演示 →
        </Link>
      ) : null}
    </article>
  );
}
