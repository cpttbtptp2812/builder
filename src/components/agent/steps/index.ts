import type { ComponentType } from "react";
import type { StepId } from "./registry";
import { StepBrowser } from "./StepBrowser";
import { StepContext } from "./StepContext";
import { StepCtrl } from "./StepCtrl";
import { StepDsl } from "./StepDsl";
import { StepEngine } from "./StepEngine";
import { StepEntity } from "./StepEntity";
import { StepIntent } from "./StepIntent";
import { StepKb } from "./StepKb";
import { StepManage } from "./StepManage";
import { StepMcp } from "./StepMcp";
import { StepMech } from "./StepMech";
import { StepNlu } from "./StepNlu";
import { StepPattern } from "./StepPattern";
import { StepPlan } from "./StepPlan";

export { getStep, isStepId, STEP_IDS, STEP_REGISTRY, type StepId } from "./registry";

export const STEP_DEMOS: Record<StepId, ComponentType> = {
  nlu: StepNlu,
  intent: StepIntent,
  entity: StepEntity,
  plan: StepPlan,
  context: StepContext,
  dsl: StepDsl,
  manage: StepManage,
  pattern: StepPattern,
  engine: StepEngine,
  mech: StepMech,
  ctrl: StepCtrl,
  browser: StepBrowser,
  mcp: StepMcp,
  kb: StepKb,
};
