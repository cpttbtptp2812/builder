import { useState } from "react";
import {
  caseFromSkillSteps,
  deleteCustomCase,
  listCustomCases,
  saveCustomCase,
  type CustomSkillTraceCase,
} from "../../lib/skillTraceCaseStore";
import type { OutcomeGrader } from "../../lib/scmOutcome";
import { getSkill } from "../../lib/agentSkills";

const GRADERS: { id: OutcomeGrader["kind"]; label: string }[] = [
  { id: "skeleton", label: "骨架一致" },
  { id: "all_ok", label: "全部 ok" },
  { id: "release_overall", label: "release overall" },
  { id: "min_steps", label: "最少步数" },
];

export function ScmCaseEditor({
  skillId,
  onChanged,
}: {
  skillId: string;
  onChanged: () => void;
}) {
  const skill = getSkill(skillId);
  const [query, setQuery] = useState("");
  const [grader, setGrader] = useState<OutcomeGrader["kind"]>("skeleton");
  const [minSteps, setMinSteps] = useState(2);
  const cases = listCustomCases(skillId);

  function buildGrader(): OutcomeGrader {
    if (grader === "release_overall") return { kind: "release_overall", min: "pass" };
    if (grader === "min_steps") return { kind: "min_steps", count: minSteps };
    if (grader === "all_ok") return { kind: "all_ok" };
    return { kind: "skeleton" };
  }

  function addCase() {
    if (!skill?.steps.length || !query.trim()) return;
    const row = caseFromSkillSteps(
      skillId,
      query.trim(),
      skill.steps.map((s) => ({ id: s.id, tool: s.tool })),
      { grader: buildGrader() },
    );
    saveCustomCase(row);
    setQuery("");
    onChanged();
  }

  return (
    <div className="own-scm-cases">
      <h4>自定义 case</h4>
      <div className="own-scm-case-form">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="测试句，例如：帮我巡检 https://example.com"
        />
        <select value={grader} onChange={(e) => setGrader(e.target.value as OutcomeGrader["kind"])}>
          {GRADERS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
        {grader === "min_steps" ? (
          <input
            type="number"
            min={1}
            value={minSteps}
            onChange={(e) => setMinSteps(Number(e.target.value))}
            title="最少步数"
          />
        ) : null}
        <button type="button" className="own-skm-batch-btn" onClick={addCase} disabled={!query.trim()}>
          添加
        </button>
      </div>
      {cases.length ? (
        <ul className="own-scm-case-list">
          {cases.map((c) => (
            <ScmCaseRow key={c.id} row={c} onDelete={() => (deleteCustomCase(skillId, c.id), onChanged())} />
          ))}
        </ul>
      ) : (
        <p className="own-scm-note">暂无自定义 case，将使用内置 SKILL_TRACE_CASES 或自动从步骤生成。</p>
      )}
    </div>
  );
}

function ScmCaseRow({ row, onDelete }: { row: CustomSkillTraceCase; onDelete: () => void }) {
  return (
    <li>
      <code>{row.query.slice(0, 48)}</code>
      <span>{row.grader?.kind ?? "skeleton"}</span>
      <button type="button" className="own-skill-inline-btn" onClick={onDelete}>
        删
      </button>
    </li>
  );
}
