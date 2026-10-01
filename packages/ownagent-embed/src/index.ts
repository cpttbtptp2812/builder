/**
 * Framework-neutral OwnAgent gate adapter.
 *
 * This module intentionally has no imports: OEM hosts provide every side
 * effect through the dependency interfaces below.
 */

export const OWNAGENT_GATE_API_SCHEMA = "ownagent-skill-gate-api/1" as const;
export const OWNAGENT_GATE_REPORT_SCHEMA = "ownagent-skill-gate/1" as const;
export const OWNAGENT_CHECK_SCHEMA = "ownagent-check/2" as const;

export type Awaitable<T> = T | Promise<T>;
export type GateDecision = "PASS" | "WARN" | "BLOCK";
export type GateLevel = "pass" | "warn" | "block";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/** Minimal cancellation contract, structurally compatible with AbortSignal. */
export type OwnAgentAbortSignal = {
  readonly aborted: boolean;
  readonly reason?: unknown;
  throwIfAborted?(): void;
};

export type OwnAgentSkill<TArtifact = unknown> = {
  id: string;
  name: string;
  version?: string;
  artifact: TArtifact;
  metadata?: JsonObject;
};

export type OwnAgentBaseline<TArtifact = unknown> = {
  skillId: string;
  version?: string;
  artifact: TArtifact;
  updatedAt: string;
  metadata?: JsonObject;
};

/** Shape returned by the server-side static gate endpoint. */
export type OwnAgentGateApiReport = {
  schema: typeof OWNAGENT_GATE_API_SCHEMA;
  skillId: string;
  gate: GateDecision;
  reasons: string[];
  compileOk: boolean;
  stepCount: number;
  triggerCount: number;
  [key: string]: unknown;
};

/** Gate section used by the browser/full comparison report. */
export type OwnAgentGateSummary = {
  level: GateLevel;
  label: string;
  gate: GateDecision;
  reasons: string[];
  deltaSuccess: number | null;
  pivotalStepId: string | null;
  pivotalTool: string | null;
  baselinePass: boolean | null;
  candidatePass: boolean | null;
};

/** Minimum stable surface of an ownagent-skill-gate/1 report. */
export type OwnAgentGateFullReport = {
  schema: typeof OWNAGENT_GATE_REPORT_SCHEMA;
  generatedAt: string;
  skillId: string;
  skillName?: string;
  baselineVersion?: string;
  candidateVersion?: string;
  gate: OwnAgentGateSummary;
  [key: string]: unknown;
};

export type OwnAgentGateProtocolReport =
  | OwnAgentGateApiReport
  | OwnAgentGateFullReport
  | {
      schema: typeof OWNAGENT_CHECK_SCHEMA;
      generatedAt: string;
      environment: string;
      results: Array<{
        skillId: string;
        gate: GateDecision;
        reasons: string[];
        deltaSuccess: number;
        pivotal: { stepId: string; tool: string | null; exact: boolean } | null;
        coverage: { exactPct: number; incomplete: boolean };
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    };

export type CatalogAdapter<TArtifact = unknown> = {
  get(skillId: string): Awaitable<OwnAgentSkill<TArtifact> | null>;
  list(): Awaitable<readonly OwnAgentSkill<TArtifact>[]>;
};

export type ExecutionRequest<TArtifact = unknown, TContext = JsonObject> = {
  runId: string;
  skill: OwnAgentSkill<TArtifact>;
  candidate: TArtifact;
  baseline: OwnAgentBaseline<TArtifact> | null;
  actor?: string;
  context?: TContext;
  signal?: OwnAgentAbortSignal;
};

export type ExecutorAdapter<TArtifact = unknown, TContext = JsonObject> = {
  execute(
    request: ExecutionRequest<TArtifact, TContext>,
  ): Awaitable<OwnAgentGateProtocolReport>;
};

export type StoredGateRun<
  TArtifact = unknown,
  TContext = JsonObject,
> = {
  runId: string;
  skillId: string;
  actor?: string;
  candidate: TArtifact;
  baselineVersion?: string;
  context?: TContext;
  decision: GateDecision;
  reasons: string[];
  report: OwnAgentGateProtocolReport;
  createdAt: string;
};

export type StorageAdapter<TArtifact = unknown, TContext = JsonObject> = {
  getBaseline(skillId: string): Awaitable<OwnAgentBaseline<TArtifact> | null>;
  saveRun(run: StoredGateRun<TArtifact, TContext>): Awaitable<void>;
};

export type GateNotification<TContext = JsonObject> =
  | {
      type: "gate.completed";
      runId: string;
      skillId: string;
      actor?: string;
      decision: GateDecision;
      reasons: string[];
      report: OwnAgentGateProtocolReport;
      context?: TContext;
      createdAt: string;
    }
  | {
      type: "gate.failed";
      runId: string;
      skillId: string;
      actor?: string;
      error: string;
      context?: TContext;
      createdAt: string;
    };

export type NotificationsAdapter<TContext = JsonObject> = {
  notify(event: GateNotification<TContext>): Awaitable<void>;
};

export type OwnAgentGateDependencies<
  TArtifact = unknown,
  TContext = JsonObject,
> = {
  catalog: CatalogAdapter<TArtifact>;
  executor: ExecutorAdapter<TArtifact, TContext>;
  storage: StorageAdapter<TArtifact, TContext>;
  notifications: NotificationsAdapter<TContext>;
};

export type OwnAgentGateOptions = {
  now?: () => Date;
  createRunId?: () => string;
  /** Notification failures are non-fatal by default. */
  notificationErrors?: "ignore" | "throw";
};

export type GateCheckRequest<TArtifact = unknown, TContext = JsonObject> = {
  skillId: string;
  candidate?: TArtifact;
  actor?: string;
  context?: TContext;
  signal?: OwnAgentAbortSignal;
};

export type GateCheckResult<TArtifact = unknown, TContext = JsonObject> = {
  run: StoredGateRun<TArtifact, TContext>;
  skill: OwnAgentSkill<TArtifact>;
  baseline: OwnAgentBaseline<TArtifact> | null;
};

export type OwnAgentGate<TArtifact = unknown, TContext = JsonObject> = {
  listSkills(): Promise<readonly OwnAgentSkill<TArtifact>[]>;
  getBaseline(skillId: string): Promise<OwnAgentBaseline<TArtifact> | null>;
  check(
    request: GateCheckRequest<TArtifact, TContext>,
  ): Promise<GateCheckResult<TArtifact, TContext>>;
};

export class OwnAgentGateError extends Error {
  readonly code:
    | "INVALID_REQUEST"
    | "SKILL_NOT_FOUND"
    | "INVALID_REPORT";

  constructor(
    code: OwnAgentGateError["code"],
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "OwnAgentGateError";
    this.code = code;
  }
}

function defaultRunId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `gate-${Date.now().toString(36)}-${random}`;
}

function reportOutcome(report: OwnAgentGateProtocolReport): {
  decision: GateDecision;
  reasons: string[];
} {
  if (report.schema === OWNAGENT_CHECK_SCHEMA) {
    const result = report.results[0];
    if (!result || !["PASS", "WARN", "BLOCK"].includes(result.gate)) {
      throw new OwnAgentGateError("INVALID_REPORT", "ownagent-check/2 contains no valid result");
    }
    return { decision: result.gate, reasons: [...result.reasons] };
  }
  if (report.schema === OWNAGENT_GATE_API_SCHEMA) {
    if (!["PASS", "WARN", "BLOCK"].includes(report.gate)) {
      throw new OwnAgentGateError(
        "INVALID_REPORT",
        `Unsupported gate decision: ${String(report.gate)}`,
      );
    }
    return { decision: report.gate, reasons: [...report.reasons] };
  }

  if (report.schema === OWNAGENT_GATE_REPORT_SCHEMA) {
    if (!["PASS", "WARN", "BLOCK"].includes(report.gate?.gate)) {
      throw new OwnAgentGateError(
        "INVALID_REPORT",
        `Unsupported gate decision: ${String(report.gate?.gate)}`,
      );
    }
    return {
      decision: report.gate.gate,
      reasons: [...report.gate.reasons],
    };
  }

  throw new OwnAgentGateError(
    "INVALID_REPORT",
    `Unsupported OwnAgent gate schema: ${String((report as { schema?: unknown }).schema)}`,
  );
}

/**
 * Creates an isolated gate instance. It performs no network, filesystem,
 * database, or UI work unless an injected adapter performs that work.
 */
export function createOwnAgentGate<
  TArtifact = unknown,
  TContext = JsonObject,
>(
  dependencies: OwnAgentGateDependencies<TArtifact, TContext>,
  options: OwnAgentGateOptions = {},
): OwnAgentGate<TArtifact, TContext> {
  const now = options.now ?? (() => new Date());
  const createRunId = options.createRunId ?? defaultRunId;

  async function notify(event: GateNotification<TContext>): Promise<void> {
    try {
      await dependencies.notifications.notify(event);
    } catch (error) {
      if (options.notificationErrors === "throw") throw error;
    }
  }

  return {
    async listSkills() {
      return dependencies.catalog.list();
    },

    async getBaseline(skillId) {
      const id = skillId.trim();
      if (!id) {
        throw new OwnAgentGateError(
          "INVALID_REQUEST",
          "skillId must not be empty",
        );
      }
      return dependencies.storage.getBaseline(id);
    },

    async check(request) {
      const skillId = request.skillId.trim();
      if (!skillId) {
        throw new OwnAgentGateError(
          "INVALID_REQUEST",
          "skillId must not be empty",
        );
      }

      const runId = createRunId();
      const skill = await dependencies.catalog.get(skillId);
      if (!skill) {
        throw new OwnAgentGateError(
          "SKILL_NOT_FOUND",
          `Skill not found: ${skillId}`,
        );
      }

      const candidate =
        request.candidate === undefined ? skill.artifact : request.candidate;
      const baseline = await dependencies.storage.getBaseline(skillId);

      try {
        const report = await dependencies.executor.execute({
          runId,
          skill,
          candidate,
          baseline,
          actor: request.actor,
          context: request.context,
          signal: request.signal,
        });
        const { decision, reasons } = reportOutcome(report);
        const createdAt = now().toISOString();
        const run: StoredGateRun<TArtifact, TContext> = {
          runId,
          skillId,
          actor: request.actor,
          candidate,
          baselineVersion: baseline?.version,
          context: request.context,
          decision,
          reasons,
          report,
          createdAt,
        };

        await dependencies.storage.saveRun(run);
        await notify({
          type: "gate.completed",
          runId,
          skillId,
          actor: request.actor,
          decision,
          reasons,
          report,
          context: request.context,
          createdAt,
        });

        return { run, skill, baseline };
      } catch (cause) {
        const createdAt = now().toISOString();
        await notify({
          type: "gate.failed",
          runId,
          skillId,
          actor: request.actor,
          error: cause instanceof Error ? cause.message : String(cause),
          context: request.context,
          createdAt,
        });
        throw cause;
      }
    },
  };
}
