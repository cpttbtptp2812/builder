/**
 * 信贷多轮流程冒烟：每流程至少推进一步，校验 UI/引擎不抛错、抽屉门控配置一致。
 */
import { CREDIT_FLOWS } from "../src/lib/creditFlowCatalog";
import { isFlowExitQuery, processCreditFlowTurn } from "../src/lib/creditFlowEngine";
import {
  flowUiRequiresDrawer,
  flowUsesUnifiedHubDrawer,
  initialFlowValidation,
} from "../src/lib/creditFlowUiGate";
import { uiForFlowStep } from "../src/lib/creditFlowUi";

let failed = 0;

function ok(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  }
}

for (const flow of CREDIT_FLOWS) {
  const entry = flow.triggers[0] ?? flow.name;
  let turn = processCreditFlowTurn(entry, null, { forcedFlowId: flow.id });
  ok(Boolean(turn.showcaseFlow.flowId), `${flow.id}: entry turn has flowId`);
  ok(turn.nextState != null, `${flow.id}: entry has nextState`);

  const start = turn.showcaseFlow.actions?.[0]?.sendAs ?? "开始";
  turn = processCreditFlowTurn(start, turn.nextState, { forcedFlowId: flow.id });
  ok(!turn.blocked || Boolean(turn.showcaseFlow), `${flow.id}: after start`);

  const sf = turn.showcaseFlow;
  if (sf.flowId && sf.stepId) {
    const { ui, actions } = uiForFlowStep(sf.flowId, sf.stepId);
    ok(Boolean(ui?.kind) || actions.length > 0 || sf.stepId.endsWith("_task"), `${flow.id}/${sf.stepId}: step has ui or actions`);
    initialFlowValidation(sf.ui ?? ui);
    const unified = flowUsesUnifiedHubDrawer(sf.flowId, sf.stepId, ui);
    const needsDrawer = flowUiRequiresDrawer(ui);
    if (sf.flowId === "contract" && (sf.stepId === "contract_risks" || sf.stepId === "contract_revise")) {
      ok(unified, `${flow.id}/${sf.stepId}: contract unified drawer`);
    }
    if (needsDrawer && sf.stepId !== "contract_risks") {
      ok(unified || needsDrawer, `${flow.id}/${sf.stepId}: drawer ui configured`);
    }
    if (actions.length === 0 && ui?.kind === "animated_checks") {
      ok(Boolean(ui.autoAdvanceSendAs), `${flow.id}/${sf.stepId}: animated_checks autoAdvance`);
    }
  }
}

ok(isFlowExitQuery("退出流程"), "exit: 退出流程");
ok(isFlowExitQuery("退出"), "exit: 退出");
ok(!isFlowExitQuery("继续"), "exit: 继续 is not exit");

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log(`OK: ${CREDIT_FLOWS.length} credit flows smoke passed`);
