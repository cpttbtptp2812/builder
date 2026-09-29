/** 技能步骤的 React 宿主。Fiber 只标出脏节点，句子在提交时才换。 */

import { createContext, createElement, type ReactNode } from "react";
import ReactReconciler from "react-reconciler";
import type { ParsedSkillStep } from "./skillMarkdown";

export type ClausePhase = "same" | "dirty" | "running" | "done";

export type SkillClause = {
  stepId: string;
  phase: ClausePhase;
  /** 草稿里这一段要说的话 */
  draftHeard: string;
  /** 线上这一段正在说的话。新步骤为空 */
  onlineHeard: string;
  fresh: boolean;
};

const EMPTY: SkillClause[] = [];
const HostTransitionContext = createContext<null>(null);

type StepProps = {
  skillId: string;
  stepId: string;
  label: string;
  fingerprint: string;
  baselineFingerprint: string;
  baselineLabel: string;
  previewGen: number;
  settledGen: number;
};

type StepNode = {
  kind: "step";
  props: StepProps;
  phase: ClausePhase;
  draftHeard: string;
  onlineHeard: string;
  children: HostNode[];
};

type HostNode = StepNode | { kind: "root"; children: HostNode[] } | { kind: "text"; text: string };

type Container = {
  skillId: string;
  root: unknown;
  children: HostNode[];
};

const containers = new Map<string, Container>();
const listeners = new Map<string, Set<() => void>>();
const lastSteps = new Map<string, { online: ParsedSkillStep[]; draft: ParsedSkillStep[] }>();
const previewGens = new Map<string, number>();
const doneGen = new Map<string, number>();
const doneFp = new Map<string, string>();
const runningGen = new Map<string, number>();
const runToken = new Map<string, number>();

function keyOf(skillId: string, stepId: string) {
  return `${skillId}:${stepId}`;
}

export function clauseText(label: string): string {
  const parts = label
    .split(/\s*[·•]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1]!;
  return parts[0] || "这一步";
}

function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row)
      .sort()
      .map((k) => `${k}:${canon(row[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "";
}

function fingerprint(step: ParsedSkillStep): string {
  return `${step.tool}|${canon(step.args)}|${step.label}`;
}

function readPhase(props: StepProps): { phase: ClausePhase; draftHeard: string; onlineHeard: string } {
  const onlineHeard = props.baselineLabel ? clauseText(props.baselineLabel) : "";
  const draftHeard = clauseText(props.label);
  const key = keyOf(props.skillId, props.stepId);
  if (props.fingerprint === props.baselineFingerprint) {
    return { phase: "same", draftHeard, onlineHeard: onlineHeard || draftHeard };
  }
  if (doneFp.get(key) === props.fingerprint && doneGen.get(key) === props.previewGen && props.previewGen > 0) {
    return { phase: "done", draftHeard, onlineHeard };
  }
  if (runningGen.get(key) === props.previewGen) {
    return { phase: "running", draftHeard, onlineHeard };
  }
  return { phase: "dirty", draftHeard, onlineHeard };
}

function publish(skillId: string) {
  listeners.get(skillId)?.forEach((fn) => fn());
}

function scheduleRun(props: StepProps) {
  const key = keyOf(props.skillId, props.stepId);
  if (runningGen.get(key) === props.previewGen) return;
  if (doneGen.get(key) === props.previewGen && doneFp.get(key) === props.fingerprint) return;
  runningGen.set(key, props.previewGen);
  const token = (runToken.get(key) ?? 0) + 1;
  runToken.set(key, token);
  const gen = props.previewGen;
  const fp = props.fingerprint;
  const skillId = props.skillId;
  window.setTimeout(() => {
    if (runToken.get(key) !== token) return;
    runningGen.delete(key);
    doneGen.set(key, gen);
    doneFp.set(key, fp);
    const saved = lastSteps.get(skillId);
    if (saved) renderSkillHost(skillId, saved.online, saved.draft);
    else publish(skillId);
  }, 680);
}

const noop = () => {};

const reconciler = ReactReconciler({
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: false,
  warnsIfNotActing: false,
  supportsMicrotasks: true,
  scheduleMicrotask: queueMicrotask,
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  getRootHostContext: () => ({}),
  getChildHostContext: () => ({}),
  getPublicInstance: (instance: HostNode) => instance,
  prepareForCommit: () => null,
  resetAfterCommit: (container: Container) => publish(container.skillId),
  preparePortalMount: noop,
  clearContainer: (container: Container) => {
    container.children = [];
  },
  shouldAttemptEagerTransition: () => false,
  trackSchedulerEvent: noop,
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
  requestPostPaintCallback: noop,
  maySuspendCommit: () => false,
  maySuspendCommitOnUpdate: () => false,
  maySuspendCommitInSyncRender: () => false,
  preloadInstance: () => true,
  startSuspendingCommit: noop,
  suspendInstance: noop,
  suspendOnActiveViewTransition: noop,
  waitForCommitToBeReady: () => null,
  getSuspendedCommitReason: () => null,
  NotPendingTransition: null,
  HostTransitionContext,
  setCurrentUpdatePriority: noop,
  getCurrentUpdatePriority: () => 32,
  resolveUpdatePriority: () => 32,
  resetFormInstance: noop,
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur: noop,
  afterActiveInstanceBlur: noop,
  prepareScopeUpdate: noop,
  getInstanceFromScope: () => null,
  detachDeletedInstance: noop,
  createInstance(type: string, props: StepProps): HostNode {
    if (type !== "skill-step") return { kind: "root", children: [] };
    const next = readPhase(props);
    return { kind: "step", props, ...next, children: [] };
  },
  appendInitialChild(parent: HostNode, child: HostNode) {
    if (parent.kind !== "text") parent.children.push(child);
  },
  finalizeInitialChildren: () => false,
  prepareUpdate(_instance: StepNode, _type: string, oldProps: StepProps, newProps: StepProps) {
    if (
      oldProps.fingerprint === newProps.fingerprint &&
      oldProps.baselineFingerprint === newProps.baselineFingerprint &&
      oldProps.previewGen === newProps.previewGen &&
      oldProps.settledGen === newProps.settledGen &&
      oldProps.label === newProps.label
    ) {
      return null;
    }
    return newProps;
  },
  shouldSetTextContent: () => false,
  createTextInstance: (text: string) => ({ kind: "text" as const, text }),
  appendChild(parent: HostNode, child: HostNode) {
    if (parent.kind !== "text") parent.children.push(child);
  },
  appendChildToContainer(container: Container, child: HostNode) {
    container.children.push(child);
  },
  insertBefore(parent: HostNode, child: HostNode, before: HostNode) {
    if (parent.kind === "text") return;
    const at = parent.children.indexOf(before);
    if (at >= 0) parent.children.splice(at, 0, child);
    else parent.children.push(child);
  },
  insertInContainerBefore(container: Container, child: HostNode, before: HostNode) {
    const at = container.children.indexOf(before);
    if (at >= 0) container.children.splice(at, 0, child);
    else container.children.push(child);
  },
  removeChild(parent: HostNode, child: HostNode) {
    if (parent.kind === "text") return;
    const at = parent.children.indexOf(child);
    if (at >= 0) parent.children.splice(at, 1);
  },
  removeChildFromContainer(container: Container, child: HostNode) {
    const at = container.children.indexOf(child);
    if (at >= 0) container.children.splice(at, 1);
  },
  resetTextContent: noop,
  commitTextUpdate: noop,
  commitMount: noop,
  commitUpdate(instance: StepNode, updatePayload: StepProps) {
    const next = readPhase(updatePayload);
    instance.props = updatePayload;
    instance.phase = next.phase;
    instance.draftHeard = next.draftHeard;
    instance.onlineHeard = next.onlineHeard;
    if (
      updatePayload.previewGen > 0 &&
      updatePayload.fingerprint !== updatePayload.baselineFingerprint &&
      doneGen.get(keyOf(updatePayload.skillId, updatePayload.stepId)) !== updatePayload.previewGen
    ) {
      scheduleRun(updatePayload);
    }
  },
  hideInstance: noop,
  hideTextInstance: noop,
  unhideInstance: noop,
  unhideTextInstance: noop,
});

function skillElement(skillId: string, online: ParsedSkillStep[], draft: ParsedSkillStep[]): ReactNode {
  const onlineById = new Map(online.map((step) => [step.id, step]));
  return createElement(
    "skill-root",
    null,
    ...draft.map((step) => {
      const base = onlineById.get(step.id);
      const props: StepProps = {
        skillId,
        stepId: step.id,
        label: step.label,
        fingerprint: fingerprint(step),
        baselineFingerprint: base ? fingerprint(base) : "",
        baselineLabel: base?.label ?? "",
        previewGen: previewGens.get(keyOf(skillId, step.id)) ?? 0,
        settledGen: doneGen.get(keyOf(skillId, step.id)) ?? 0,
      };
      return createElement("skill-step", { key: step.id, ...props });
    }),
  );
}

export function renderSkillHost(skillId: string, online: ParsedSkillStep[], draft: ParsedSkillStep[]) {
  lastSteps.set(skillId, { online, draft });
  let box = containers.get(skillId);
  if (!box) {
    const container = { skillId, root: null as unknown, children: [] as HostNode[] };
    container.root = reconciler.createContainer(
      container,
      0,
      null,
      false,
      null,
      "skill",
      (error) => console.error(error),
      (error) => console.error(error),
      (error) => console.error(error),
      null,
    );
    box = container;
    containers.set(skillId, container);
  }
  reconciler.updateContainerSync(skillElement(skillId, online, draft), box.root, null, null);
  reconciler.flushSyncWork();
  publish(skillId);
}

export function previewClause(skillId: string, stepId: string) {
  const saved = lastSteps.get(skillId);
  const step = saved?.draft.find((item) => item.id === stepId);
  if (!saved || !step) return;
  const key = keyOf(skillId, stepId);
  const gen = (previewGens.get(key) ?? 0) + 1;
  previewGens.set(key, gen);
  runningGen.set(key, gen);
  publish(skillId);
  const token = (runToken.get(key) ?? 0) + 1;
  runToken.set(key, token);
  const fp = fingerprint(step);
  window.setTimeout(() => {
    if (runToken.get(key) !== token) return;
    runningGen.delete(key);
    doneGen.set(key, gen);
    doneFp.set(key, fp);
    const latest = lastSteps.get(skillId);
    if (latest) renderSkillHost(skillId, latest.online, latest.draft);
    else publish(skillId);
  }, 680);
}

export function subscribeSkillHost(skillId: string, onStoreChange: () => void) {
  let set = listeners.get(skillId);
  if (!set) {
    set = new Set();
    listeners.set(skillId, set);
  }
  set.add(onStoreChange);
  return () => set!.delete(onStoreChange);
}

const clauseCache = new Map<string, { key: string; snap: SkillClause[] }>();

function clausesNow(skillId: string): SkillClause[] {
  const saved = lastSteps.get(skillId);
  if (!saved) return EMPTY;
  const onlineById = new Map(saved.online.map((step) => [step.id, step]));
  return saved.draft.map((step) => {
    const base = onlineById.get(step.id);
    const props: StepProps = {
      skillId,
      stepId: step.id,
      label: step.label,
      fingerprint: fingerprint(step),
      baselineFingerprint: base ? fingerprint(base) : "",
      baselineLabel: base?.label ?? "",
      previewGen: previewGens.get(keyOf(skillId, step.id)) ?? 0,
      settledGen: doneGen.get(keyOf(skillId, step.id)) ?? 0,
    };
    const next = readPhase(props);
    return {
      stepId: step.id,
      phase: next.phase,
      draftHeard: next.draftHeard,
      onlineHeard: next.onlineHeard,
      fresh: props.fingerprint !== props.baselineFingerprint,
    };
  });
}

export function getSkillClauses(skillId: string): SkillClause[] {
  const snap = clausesNow(skillId);
  const key = JSON.stringify(snap);
  const prev = clauseCache.get(skillId);
  if (prev && prev.key === key) return prev.snap;
  clauseCache.set(skillId, { key, snap });
  return snap;
}
