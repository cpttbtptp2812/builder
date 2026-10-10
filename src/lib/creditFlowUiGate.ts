import { matchCreditFlowId, matchCreditFlowSkillId } from "./creditFlowCatalog";
import {
  isCreditFlowAdvanceQuery,
  isHubFlowButtonQuery,
  type CreditFlowState,
} from "./creditFlowEngine";
import type { CreditFlowUi, FlowActionDef } from "./creditFlowUi";

export type FlowUiValidation = {
  ready: boolean;
  hint: string;
};

export function flowUiRequiresDrawer(ui: CreditFlowUi | null | undefined): boolean {
  if (!ui) return false;
  return (
    ui.kind === "photo_grid" ||
    ui.kind === "signature" ||
    ui.kind === "voice" ||
    ui.kind === "form" ||
    ui.kind === "contract_edit" ||
    ui.kind === "submission_success"
  );
}

/** Hub：合同预览 + 本步办理合并为同一侧栏（不关预览再开办理） */
/** Hub 本轮是否走信贷多轮（按钮静默 / 流程话术 / 切换流程），否则走普通技能与问答 */
export function shouldBindHubCreditFlow(
  query: string,
  creditFlow: CreditFlowState | null | undefined,
  opts: { flowSilent?: boolean },
): boolean {
  const q = query.trim();
  if (!q) return false;
  if (opts.flowSilent) return true;
  if (isHubFlowButtonQuery(q)) return true;
  const entry = matchCreditFlowId(q);
  if (!creditFlow?.flowId) return Boolean(matchCreditFlowSkillId(q));
  if (entry) return true;
  return isCreditFlowAdvanceQuery(q, creditFlow);
}

export function flowUsesUnifiedHubDrawer(
  flowId: string | undefined,
  stepId: string | undefined,
  ui: CreditFlowUi | null | undefined,
): boolean {
  if (flowUiRequiresDrawer(ui)) return true;
  if (flowId === "contract" && (stepId === "contract_risks" || stepId === "contract_revise")) return true;
  return false;
}

export function flowActionNeedsCompletion(ui: CreditFlowUi | null | undefined): boolean {
  if (!ui || ui.kind === "submission_success") return false;
  return flowUiRequiresDrawer(ui);
}

export function initialFlowValidation(ui: CreditFlowUi | null | undefined): FlowUiValidation {
  if (!ui) return { ready: true, hint: "" };
  switch (ui.kind) {
    case "photo_grid":
      return { ready: false, hint: "请上传全部现场材料后再提交" };
    case "signature":
      return { ready: false, hint: "请在面板内手写并确认签名" };
    case "voice":
      return { ready: false, hint: "请先完成录音并解析" };
    case "form":
      return { ready: false, hint: "请填写必填项" };
    case "contract_edit":
      return { ready: false, hint: "请核对修订条款并确认" };
    case "submission_success":
      return { ready: true, hint: "" };
    default:
      return { ready: true, hint: "" };
  }
}

export function filterDrawerActions(
  actions: FlowActionDef[] | undefined,
  ui: CreditFlowUi | null | undefined,
): FlowActionDef[] {
  if (!actions?.length) return [];
  if (!flowActionNeedsCompletion(ui)) return actions;
  return actions;
}
