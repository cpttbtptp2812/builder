import type { ResumeSection } from "../data/resumeContent";

export function ResumeSections({ sections }: { sections: ResumeSection[] }) {
  return (
    <>
      {sections.map((section, idx) => (
        <div key={section.heading ?? `section-${idx}`} className="resume-project-block">
          {section.heading ? <h4>{section.heading}</h4> : null}
          {section.paragraphs?.map((p) => (
            <p key={p} className="resume-para">
              {p}
            </p>
          ))}
          {section.bullets && section.bullets.length > 0 ? (
            <ul>
              {section.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {section.subsections?.map((sub) => (
            <div key={sub.heading} className="resume-subsection">
              <h5>{sub.heading}</h5>
              <ul>
                {sub.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
