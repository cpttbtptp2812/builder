/** 将 Semcompiler 结果挂到 SkillManifest — 与 parse/hydrate 解耦 */

import {
  compileSkill,
  mergeDiagnostics,
  type CompileOptions,
  type CompileResult,
  type SkillEffect,
  type SkillIR,
  type SkillPeer,
} from "./skillSemcompiler";
import type { ParsedSkillDoc, SkillManifest, SkillManifestCore } from "./skillMarkdown";
import type { RuntimeEnv } from "./skillToolRegistry";

export type SkillDiagnostic = import("./skillSemcompiler").SkillDiagnostic;

export type SkillCompileFields = {
  compile?: CompileResult;
  ir?: SkillIR | null;
  diagnostics: SkillDiagnostic[];
  compileOk: boolean;
  runOk: boolean;
  effectUpperBound?: SkillEffect;
};

type ManifestBase = SkillManifestCore;

const EMPTY_COMPILE: SkillCompileFields = {
  diagnostics: [],
  compileOk: false,
  runOk: false,
};

export function attachCompileToManifest(manifest: ManifestBase, opts: CompileOptions): SkillManifest {
  const compile = compileSkill(manifest.parsed, opts);
  const diagnostics = mergeDiagnostics(manifest.parsed.issues, compile.diagnostics);
  return {
    ...manifest,
    compile,
    ir: compile.ir,
    diagnostics,
    compileOk: compile.compileOk,
    runOk: compile.runOk,
    effectUpperBound: compile.ir?.effectUpperBound,
    runnable: compile.runOk,
  };
}

export function enrichSkillCatalog(manifests: ManifestBase[], env: RuntimeEnv = "browser"): SkillManifest[] {
  const peers: SkillPeer[] = manifests.map((m) => ({ id: m.id, triggers: m.triggers }));
  return manifests.map((m) =>
    attachCompileToManifest(m, {
      skillId: m.id,
      env,
      peers: peers.filter((p) => p.id !== m.id),
    }),
  );
}

export function compileParsedOnly(parsed: ParsedSkillDoc, skillId: string, peers: SkillPeer[] = [], env: RuntimeEnv = "browser") {
  const compile = compileSkill(parsed, { skillId, env, peers });
  return {
    compile,
    diagnostics: mergeDiagnostics(parsed.issues, compile.diagnostics),
  };
}

export function emptyCompileFields(): SkillCompileFields {
  return { ...EMPTY_COMPILE };
}
