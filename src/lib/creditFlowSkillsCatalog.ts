/** 信贷 *-flow-desk 技能 — 保证技能页始终能列出 13 套多轮流程（即使 SKILL 未打进 bundle） */

import type { AgentSkill } from "./agentSkills";
import { CREDIT_FLOW_DESK_IDS, getSkill } from "./agentSkills";
import { CREDIT_FLOWS, type CreditFlowDef } from "./creditFlowCatalog";
import { creditFlowSkillId } from "./creditFlowUi";

function flowForDeskId(id: string): CreditFlowDef | undefined {
  return CREDIT_FLOWS.find((f) => creditFlowSkillId(f.id) === id);
}

export function resolveCreditFlowDeskSkill(id: string): AgentSkill | null {
  const fromCatalog = getSkill(id);
  if (fromCatalog && fromCatalog.steps.length > 0 && fromCatalog.runnable !== false) {
    return fromCatalog as AgentSkill;
  }
  const flow = flowForDeskId(id);
  if (!flow) return null;
  const steps = flow.steps.map((s) => ({
    id: s.id,
    label: s.label,
    tool: "__credit_flow_turn__",
    args: { flowId: flow.id, query: "{{query}}", flowState: "{{creditFlowState}}" },
  }));
  const manifest = [
    "---",
    `name: ${flow.name}`,
    `description: ${flow.name}（多轮） — 共 ${flow.steps.length} 步，上传/签名/表单在对话右侧办理`,
    "triggers:",
    ...flow.triggers.map((t) => `  - ${t}`),
    "steps:",
    "  - id: turn",
    "    label: 推进一步",
    "    tool: __credit_flow_turn__",
    `    args:`,
    `      flowId: ${flow.id}`,
    "---",
  ].join("\n");
  return {
    id,
    name: flow.name,
    description: `${flow.name}（多轮） — 共 ${flow.steps.length} 步，上传/签名/表单在对话右侧办理`,
    skillPath: `src/skills/${id}/SKILL.md`,
    triggers: [...flow.triggers],
    tools: ["__credit_flow_turn__"],
    depends: [],
    steps,
    manifest,
    plan: flow.steps.map((s) => s.label),
    parsed: fromCatalog?.parsed,
    runnable: true,
  } as AgentSkill;
}

export function allCreditFlowDeskSkills(): AgentSkill[] {
  const out: AgentSkill[] = [];
  for (const id of CREDIT_FLOW_DESK_IDS) {
    const s = resolveCreditFlowDeskSkill(id);
    if (s) out.push(s);
  }
  return out;
}
