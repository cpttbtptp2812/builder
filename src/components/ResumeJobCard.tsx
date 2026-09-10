import type { JobExperienceEntry } from "../data/resumeContent";
import { ResumeSections } from "./ResumeSections";

export function ResumeJobCard({ job }: { job: JobExperienceEntry }) {
  return (
    <article className="resume-job-card resume-job-card--compact">
      <header className="resume-job-card-head">
        <div>
          <strong>{job.company}</strong>
          <span>{job.role}</span>
        </div>
        <time>{job.period}</time>
      </header>

      {job.stack && job.stack.length > 0 ? (
        <div className="resume-project-stack compact">
          {job.stack.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}

      <ResumeSections sections={job.sections} />
    </article>
  );
}
