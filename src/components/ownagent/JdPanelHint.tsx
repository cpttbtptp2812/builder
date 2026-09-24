import { JD_SKILLS } from "../../lib/agentJdRequirements";

/** 面板顶部的 JD 理论提示条 */
export function JdPanelHint({ skillId }: { skillId: string }) {
  const skill = JD_SKILLS.find((s) => s.id === skillId);
  if (!skill) return null;
  return (
    <aside className="oa-jd-hint">
      <span className="oa-jd-hint-label">能力说明</span>
      <strong>{skill.title}</strong>
      <p>{skill.theory}</p>
    </aside>
  );
}
