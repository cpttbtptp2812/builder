/** Skill Semcompiler — SKILL.md 静态分析：工具、变量、副作用、trigger 干涉 */

import { validateParams } from "./mcpBridgeLab";
import type { ParsedSkillDoc, ParsedSkillStep } from "./skillMarkdown";
import { BUILTIN_SLOTS, stepVarWrites } from "./skillVarBindings";
import {
  resolveTool,
  toolAvailableIn,
  type RuntimeEnv,
  type SkillEffect,
} from "./skillToolRegistry";

export type { SkillEffect };

export type SkillDiagnostic = {
  code: string;
  level: "error" | "warning" | "info";
  stepId?: string;
  message: string;
  fixHint?: string;
};

export type SkillIRStep = {
  id: string;
  tool: string;
  toolKind: "mcp" | "internal" | "unknown";
  reads: string[];
  writes: string[];
  effect: SkillEffect;
};

export type TriggerInterference = {
  otherSkillId: string;
  shared: string[];
};

export type SkillIR = {
  skillId: string;
  name: string;
  triggers: string[];
  declaredTools: string[];
  steps: SkillIRStep[];
  effectUpperBound: SkillEffect;
  dataFlow: { from: string; to: string; stepId: string }[];
  triggerInterference: TriggerInterference[];
};

export type CompileResult = {
  ir: SkillIR | null;
  diagnostics: SkillDiagnostic[];
  compileOk: boolean;
  runOk: boolean;
};

export type SkillPeer = { id: string; triggers: string[] };

export type CompileOptions = {
  skillId: string;
  env?: RuntimeEnv;
  peers?: SkillPeer[];
};

const EFFECT_RANK: Record<SkillEffect, number> = {
  pure: 0,
  read_dom: 1,
  read_remote: 2,
  hitl: 3,
  mutate: 4,
};

function maxEffect(a: SkillEffect, b: SkillEffect): SkillEffect {
  return EFFECT_RANK[a] >= EFFECT_RANK[b] ? a : b;
}

function diag(
  code: string,
  level: SkillDiagnostic["level"],
  message: string,
  extra?: { stepId?: string; fixHint?: string },
): SkillDiagnostic {
  return { code, level, message, ...extra };
}

function extractRefs(value: unknown, reads: { slots: Set<string>; vars: Set<string> }): void {
  if (typeof value === "string") {
    const s = value.trim();
    if (s.startsWith("$") && !s.includes(" ")) {
      reads.vars.add(s.slice(1));
      return;
    }
    for (const m of s.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
      reads.slots.add(m[1]!);
    }
    if (s.startsWith("$") && !s.includes(" ")) reads.vars.add(s.slice(1));
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) extractRefs(v, reads);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) extractRefs(v, reads);
  }
}

function resolveArgsForSchema(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "string") {
      const s = v.trim();
      if (s === "{{query}}") out[k] = "compile-sample-query";
      else if (s === "{{probeUrl}}") out[k] = "https://example.com";
      else if (s.startsWith("$")) out[k] = {};
      else out[k] = s.replace(/\{\{[^}]+\}\}/g, "sample");
    } else {
      out[k] = v;
    }
  }
  return out;
}

function sharedTriggers(a: string[], b: string[]): string[] {
  const out: string[] = [];
  for (const t of a) {
    const tl = t.toLowerCase();
    if (tl.length < 2) continue;
    for (const u of b) {
      const ul = u.toLowerCase();
      if (tl === ul || tl.includes(ul) || ul.includes(tl)) {
        out.push(t);
        break;
      }
    }
  }
  return [...new Set(out)];
}

function normRef(name: string): string {
  return name.startsWith("$") ? name.slice(1) : name;
}

function buildDataFlow(steps: SkillIRStep[]): SkillIR["dataFlow"] {
  const edges: SkillIR["dataFlow"] = [];
  const available = new Set<string>([...BUILTIN_SLOTS]);

  for (const step of steps) {
    for (const r of step.reads) {
      const key = normRef(r);
      if (available.has(key) || BUILTIN_SLOTS.includes(key as (typeof BUILTIN_SLOTS)[number])) {
        edges.push({ from: r, to: step.id, stepId: step.id });
      }
    }
    for (const w of step.writes) available.add(w);
  }
  return edges;
}

function analyzeStep(
  step: ParsedSkillStep,
  available: Set<string>,
  env: RuntimeEnv,
  declaredTools: Set<string>,
): { ir: SkillIRStep; diagnostics: SkillDiagnostic[]; effect: SkillEffect } {
  const diagnostics: SkillDiagnostic[] = [];
  const refs = { slots: new Set<string>(), vars: new Set<string>() };
  extractRefs(step.args, refs);

  const reads = [...refs.slots, ...[...refs.vars].map((v) => `$${v}`)];
  for (const slot of refs.slots) {
    if (!BUILTIN_SLOTS.includes(slot as (typeof BUILTIN_SLOTS)[number]) && !available.has(slot)) {
      diagnostics.push(
        diag("UNDEF_SLOT", "error", `步骤「${step.id}」引用未定义变量 {{${slot}}}`, {
          stepId: step.id,
          fixHint: "在前序 step 产出该变量，或使用 query / probeUrl",
        }),
      );
    }
  }
  for (const v of refs.vars) {
    if (!available.has(v)) {
      diagnostics.push(
        diag("UNDEF_VAR", "error", `步骤「${step.id}」引用未定义 $${v}`, {
          stepId: step.id,
          fixHint: `确认前序 step 已通过 stepId 或工具别名写入 $${v}`,
        }),
      );
    }
  }

  const resolved = resolveTool(step.tool);
  let toolKind: SkillIRStep["toolKind"] = "unknown";
  let effect: SkillEffect = "read_remote";

  if (resolved.kind === "unknown") {
    diagnostics.push(
      diag("UNKNOWN_TOOL", "error", `未知工具「${step.tool}」`, {
        stepId: step.id,
        fixHint: "检查 MCP 工具名或 internal __compose_* 拼写",
      }),
    );
  } else {
    toolKind = resolved.kind;
    effect = resolved.effect;
    if (!toolAvailableIn(step.tool, env)) {
      diagnostics.push(
        diag("ENV_UNSUPPORTED", "error", `工具「${step.tool}」在当前环境（${env}）不可用`, {
          stepId: step.id,
          fixHint: env === "server" ? "在 server/skills.ts 补 internal 实现，或仅在浏览器运行" : "该工具仅服务端可用",
        }),
      );
    }
    if (resolved.kind === "mcp") {
      const sampleArgs = resolveArgsForSchema(step.args as Record<string, unknown>);
      const valid = validateParams(resolved.def, sampleArgs);
      if (!valid.ok) {
        for (const err of valid.errors) {
          diagnostics.push(
            diag("SCHEMA_MISMATCH", "warning", `步骤「${step.id}」参数：${err}`, {
              stepId: step.id,
              fixHint: "对照 MCP inputSchema 补全 args",
            }),
          );
        }
      }
    }
  }

  if (!step.tool.startsWith("__") && !declaredTools.has(step.tool)) {
    diagnostics.push(
      diag("TOOL_NOT_DECLARED", "warning", `frontmatter tools 未声明「${step.tool}」`, {
        stepId: step.id,
        fixHint: "在 tools: 列表中加入该工具，便于审计",
      }),
    );
  }

  const writes = stepVarWrites(step.id, step.tool);
  for (const w of writes) available.add(w);

  return {
    ir: { id: step.id, tool: step.tool, toolKind, reads, writes, effect },
    diagnostics,
    effect,
  };
}

export function compileSkill(parsed: ParsedSkillDoc, opts: CompileOptions): CompileResult {
  const env = opts.env ?? "browser";
  const diagnostics: SkillDiagnostic[] = [];
  const declaredTools = new Set(parsed.tools);
  const available = new Set<string>([...BUILTIN_SLOTS]);
  const irSteps: SkillIRStep[] = [];
  let effectUpperBound: SkillEffect = "pure";

  if (parsed.steps.length === 0 && parsed.name) {
    diagnostics.push(diag("DEAD_SKILL", "info", "没有 steps，仅作文档 Skill"));
  }

  for (const step of parsed.steps) {
    const { ir, diagnostics: stepDiags, effect } = analyzeStep(step, available, env, declaredTools);
    irSteps.push(ir);
    diagnostics.push(...stepDiags);
    effectUpperBound = maxEffect(effectUpperBound, effect);
    for (const w of ir.writes) available.add(w);
  }

  const triggerInterference: TriggerInterference[] = [];
  for (const peer of opts.peers ?? []) {
    if (peer.id === opts.skillId) continue;
    const shared = sharedTriggers(parsed.triggers, peer.triggers);
    if (shared.length > 0) {
      triggerInterference.push({ otherSkillId: peer.id, shared });
      diagnostics.push(
        diag("TRIGGER_OVERLAP", "warning", `与「${peer.id}」共享 trigger：${shared.slice(0, 4).join("、")}${shared.length > 4 ? "…" : ""}`, {
          fixHint: "收窄 trigger 或提高路由打分区分度",
        }),
      );
    }
  }

  const ir: SkillIR | null = parsed.name
    ? {
        skillId: opts.skillId,
        name: parsed.name,
        triggers: parsed.triggers,
        declaredTools: parsed.tools,
        steps: irSteps,
        effectUpperBound,
        dataFlow: buildDataFlow(irSteps),
        triggerInterference,
      }
    : null;

  const errors = diagnostics.filter((d) => d.level === "error");
  const compileOk = errors.length === 0 && parsed.ok;
  const runOk = compileOk && parsed.steps.length > 0;

  return { ir, diagnostics, compileOk, runOk };
}

export function mergeDiagnostics(
  parseIssues: { level: "error" | "warning"; message: string; line?: number }[],
  compileDiags: SkillDiagnostic[],
): SkillDiagnostic[] {
  const fromParse: SkillDiagnostic[] = parseIssues.map((i) => ({
    code: "PARSE",
    level: i.level,
    message: i.line != null ? `L${i.line}: ${i.message}` : i.message,
  }));
  return [...fromParse, ...compileDiags];
}

export function effectLabel(effect: SkillEffect): string {
  const map: Record<SkillEffect, string> = {
    pure: "纯组装",
    read_dom: "读 DOM",
    read_remote: "读远程",
    hitl: "人工门禁",
    mutate: "可变更",
  };
  return map[effect];
}
