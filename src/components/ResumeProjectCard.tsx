import { Link } from "react-router-dom";
import type { ResumeProjectEntry } from "../data/resumeContent";
import { ResumeSections } from "./ResumeSections";

export function ResumeProjectCard({ project }: { project: ResumeProjectEntry }) {
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
      </header>

      {project.stack && project.stack.length > 0 ? (
        <div className="resume-project-stack compact top">
          {project.stack.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
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
