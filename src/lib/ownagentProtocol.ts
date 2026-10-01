/** Public ownagent-check/2 protocol shared by CLI, API and OEM consumers. */

export const OWNAGENT_CHECK_SCHEMA = "ownagent-check/2" as const;

export type GateVerdict = "PASS" | "WARN" | "BLOCK";

export type OwnAgentCaseConsequence = {
  id: string;
  query: string;
  baselinePass?: boolean;
  candidatePass?: boolean;
  deltaSuccess?: number;
  detail?: string;
};

export type OwnAgentCheckResultV2 = {
  skillId: string;
  environment: string;
  gate: GateVerdict;
  compileOk: boolean;
  baseline: { version: string };
  candidate: { version: string };
  deltaSuccess: number;
  pivotal: { stepId: string; tool: string | null; exact: boolean } | null;
  failedCases: OwnAgentCaseConsequence[];
  coverage: {
    exact: number;
    total: number;
    exactPct: number;
    missingTools: string[];
    incomplete: boolean;
  };
  policy: {
    risk: "low" | "medium" | "high";
    minExactPct: number;
    requireCases: boolean;
    requiresApproval: boolean;
  };
  impact?: {
    direct: string[];
    transitive: string[];
    ambiguousRoutes: number;
  };
  reasons: string[];
};

export type OwnAgentCheckReportV2 = {
  schema: typeof OWNAGENT_CHECK_SCHEMA;
  generatedAt: string;
  environment: string;
  results: OwnAgentCheckResultV2[];
};

export function isOwnAgentCheckV2(value: unknown): value is OwnAgentCheckReportV2 {
  if (!value || typeof value !== "object") return false;
  const row = value as { schema?: unknown; results?: unknown };
  return row.schema === OWNAGENT_CHECK_SCHEMA && Array.isArray(row.results);
}
