/** Repository policy-as-code for Skill release decisions. */

import type { GateVerdict } from "./ownagentProtocol";

export type SkillRisk = "low" | "medium" | "high";

export type GatePolicyRule = {
  risk: SkillRisk;
  minExactPct: number;
  blockDeltaBelow: number;
  warnDeltaBelow: number;
  requireCases: boolean;
  requireApprovalOnWarn: boolean;
};

export type GatePolicy = {
  version: number;
  defaults: GatePolicyRule;
  environments: Record<string, Partial<GatePolicyRule>>;
  skills: Record<string, Partial<GatePolicyRule>>;
};

export const DEFAULT_GATE_POLICY: GatePolicy = {
  version: 1,
  defaults: {
    risk: "medium",
    minExactPct: 80,
    blockDeltaBelow: -0.01,
    warnDeltaBelow: 0,
    requireCases: true,
    requireApprovalOnWarn: true,
  },
  environments: {
    staging: { requireApprovalOnWarn: false },
    prod: { minExactPct: 80, requireApprovalOnWarn: true },
  },
  skills: {},
};

function scalar(raw: string): string | number | boolean {
  const value = raw.trim().replace(/^["']|["']$/g, "");
  if (value === "true" || value === "false") return value === "true";
  const number = Number(value);
  return value !== "" && Number.isFinite(number) ? number : value;
}

/** Minimal indentation parser for the documented policy shape. Unknown keys are ignored. */
export function parseGatePolicy(raw: string): GatePolicy {
  const policy: GatePolicy = JSON.parse(JSON.stringify(DEFAULT_GATE_POLICY)) as GatePolicy;
  let section: "defaults" | "environments" | "skills" | null = null;
  let name = "";
  for (const source of raw.split(/\r?\n/)) {
    const line = source.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const match = line.trim().match(/^([A-Za-z0-9_.-]+):(?:\s*(.+))?$/);
    if (!match) continue;
    const key = match[1]!;
    const rawValue = match[2];
    if (indent === 0) {
      if (key === "version" && rawValue) policy.version = Number(scalar(rawValue)) || 1;
      else if (key === "defaults" || key === "environments" || key === "skills") section = key;
      name = "";
      continue;
    }
    if ((section === "environments" || section === "skills") && indent === 2 && !rawValue) {
      name = key;
      const target = section === "environments" ? policy.environments : policy.skills;
      target[name] ??= {};
      continue;
    }
    if (!rawValue) continue;
    const value = scalar(rawValue);
    const target =
      section === "defaults"
        ? policy.defaults
        : section === "environments"
          ? policy.environments[name]
          : section === "skills"
            ? policy.skills[name]
            : undefined;
    if (!target) continue;
    if (key === "risk" && (value === "low" || value === "medium" || value === "high")) target.risk = value;
    if (key === "minExactPct" && typeof value === "number") target.minExactPct = value;
    if (key === "blockDeltaBelow" && typeof value === "number") target.blockDeltaBelow = value;
    if (key === "warnDeltaBelow" && typeof value === "number") target.warnDeltaBelow = value;
    if (key === "requireCases" && typeof value === "boolean") target.requireCases = value;
    if (key === "requireApprovalOnWarn" && typeof value === "boolean") target.requireApprovalOnWarn = value;
  }
  return policy;
}

export function resolveGatePolicy(policy: GatePolicy, skillId: string, environment: string): GatePolicyRule {
  return {
    ...policy.defaults,
    ...(policy.environments[environment] ?? {}),
    ...(policy.skills[skillId] ?? {}),
  };
}

export function applyGatePolicy(input: {
  compileOk: boolean;
  deltaSuccess: number;
  failedCaseCount: number;
  caseCount: number;
  exactPct: number;
  rule: GatePolicyRule;
}): { gate: GateVerdict; reasons: string[]; incomplete: boolean; requiresApproval: boolean } {
  const reasons: string[] = [];
  const incomplete = input.caseCount === 0 || input.exactPct < input.rule.minExactPct;
  let gate: GateVerdict = "PASS";
  if (!input.compileOk) {
    gate = "BLOCK";
    reasons.push("编译失败");
  }
  if (input.rule.requireCases && input.caseCount === 0) {
    if (gate === "PASS") gate = "WARN";
    reasons.push("没有回归 case，报告未看全");
  }
  if (input.exactPct < input.rule.minExactPct) {
    if (gate === "PASS") gate = "WARN";
    reasons.push(`Exact ${input.exactPct}% 低于策略阈值 ${input.rule.minExactPct}%`);
  }
  if (!incomplete && input.deltaSuccess < input.rule.blockDeltaBelow) {
    gate = "BLOCK";
    reasons.push(`ΔP ${input.deltaSuccess} 低于阻断阈值 ${input.rule.blockDeltaBelow}`);
  } else if (input.deltaSuccess < input.rule.warnDeltaBelow && gate === "PASS") {
    gate = "WARN";
    reasons.push(`ΔP ${input.deltaSuccess} 低于告警阈值 ${input.rule.warnDeltaBelow}`);
  }
  if (input.failedCaseCount > 0) {
    if (!incomplete) gate = "BLOCK";
    else if (gate === "PASS") gate = "WARN";
    reasons.push(`${input.failedCaseCount} 个 case 未通过`);
  }
  return {
    gate,
    reasons,
    incomplete,
    requiresApproval: gate === "WARN" && input.rule.requireApprovalOnWarn,
  };
}
