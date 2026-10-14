/**
 * 规则证明器：
 * 1) 单行决策模型与真实报销引擎对拍（随机单据 × 随机参数），模型错了证明就不可信；
 * 2) 现用 ledger-desk：证明总监队列不可达，并用真实引擎在边界金额上佐证；
 * 3) 改容差 / 改线 / 改分组：等价、反例、部分证明三种结论各自正确，反例经真实引擎复跑确认。
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const { proveLedgerRules, engineSide } = await import("../server/ruleProver.ts");
const { concreteAlgebra, ledgerStepRules, ruleParams, rowOutcome, QUEUE_CODES, RECON_CODES } = await import(
  "../src/lib/ledgerRuleModel.ts"
);
const { parseSkillMarkdown } = await import("../src/lib/skillMarkdown.ts");

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}
function expect(cond: unknown, msg: string): void {
  if (!cond) fail(msg);
}

const ledgerRaw = readFileSync(path.join(process.cwd(), "src/skills/ledger-desk/SKILL.md"), "utf8");

/* ---------- 1. 模型 vs 引擎对拍 ---------- */

let seed = 20261014;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;

function randomStepsRaw(): { id: string; label: string; tool: string; args: Record<string, unknown> }[] {
  const lines = [pick([3000, 5000, 8000]), pick([8000, 10000, 12000]), pick([6000, 8000, 20000])];
  const args = {
    tax: pick(["include", "exclude"]),
    tolerance: pick([0, 0.5, 10, 100]),
    missing: pick(["block", "pass"]),
    groupBy: "部门",
    leadAt: lines[0],
    directorAt: lines[1],
    financeReviewAt: lines[2],
    maxSingleAmount: pick([200000, 9000]),
  };
  return [
    { id: "esc", label: "升级", tool: "__sheet_escalation__", args },
    { id: "miss", label: "缺票", tool: "__sheet_missing_guard__", args: { ...args, guard: "fail" } },
    { id: "recon", label: "对账", tool: "__sheet_reconcile__", args },
  ];
}

let checked = 0;
for (let round = 0; round < 60; round++) {
  const rules = ledgerStepRules(randomStepsRaw());
  const near = [
    rules[0]!.recipe.escalation.leadAt,
    rules[0]!.recipe.escalation.directorAt,
    rules[0]!.recipe.escalation.financeReviewAt,
    rules[0]!.recipe.maxSingleAmount,
  ];
  for (let i = 0; i < 40; i++) {
    const base = rand() < 0.6 ? pick(near) + pick([-1, 0, 0.5, 1]) : Math.round(rand() * 30000) - (rand() < 0.1 ? 20000 : 0);
    const gross = base;
    const tax = rand() < 0.3 ? 0 : Math.round(rand() * 2000) / 2 - (rand() < 0.05 ? 500 : 0);
    const hasInvoice = rand() > 0.2;
    const invoice = hasInvoice ? gross + pick([0, 0.5, 1, 10, 10.5, 100, 101, -100, -0.5]) : null;
    for (const rule of rules) {
      const scale = 100;
      const p = ruleParams(rule, scale);
      const model = rowOutcome(concreteAlgebra, p, {
        gross: Math.round(gross * scale),
        tax: Math.round(tax * scale),
        invoice: Math.round((invoice ?? 0) * scale),
        hasInvoice,
      });
      const engine = engineSide(rule, { gross, tax, invoice });
      const where = `${rule.stepId} 参数 ${JSON.stringify(rule.args)} 单据 金额${gross} 税${tax} 发票${invoice ?? "空"}`;
      expect(model.cap === engine.cap, `单行上限不一致：${where}`);
      expect(Math.abs(model.booked / scale - engine.booked) < 1e-9, `入账额不一致：${where}`);
      expect(RECON_CODES[model.recon] === engine.recon, `对账结论不一致（模型 ${RECON_CODES[model.recon]} / 引擎 ${engine.recon}）：${where}`);
      expect(QUEUE_CODES[model.queue] === engine.queue, `审批队列不一致（模型 ${QUEUE_CODES[model.queue]} / 引擎 ${engine.queue}）：${where}`);
      expect(model.blocked === engine.blocked, `整批拦截不一致：${where}`);
      expect(model.guardStop === engine.guardStop, `守卫中止不一致：${where}`);
      checked += 1;
    }
  }
}
console.log(`PASS  模型与真实引擎对拍 ${checked} 次，六项结果全部一致`);

/* ---------- 2. 现用版：总监队列是死规则 ---------- */

const self = await proveLedgerRules(ledgerRaw, ledgerRaw);
expect(self.supported, "ledger-desk 应被证明器支持");
expect(self.verdict === "equivalent", `同一版应等价，实际 ${self.verdict}`);
expect(self.counterexamples.length === 0, "同一版不该有反例");
const director = self.deadBranches.find((d) => d.target === "总监");
expect(director, `应证明总监队列不可达；实际死分支：${self.deadBranches.map((d) => d.target).join("、") || "无"}`);
expect(director!.explanation.includes("8000") && director!.explanation.includes("10000"), `解释应点出 8000 与 10000：${director!.explanation}`);
expect(director!.engineEvidence.includes("财务复核（达线）"), `真实引擎应佐证 10000 元进财务复核：${director!.engineEvidence}`);
expect(!self.deadBranches.some((d) => d.target === "出纳" || d.target === "部门负责人"), "出纳和负责人队列应可达");
expect(self.smtlib.includes("(declare-const gross Int)") && self.smtlib.includes("(check-sat)"), "应导出 SMT-LIB 查询");
console.log(`PASS  现用版：Z3 证明「总监」队列不可达（${self.solver.version}，${self.solver.queries} 次查询，${self.solver.ms} ms）`);

/* ---------- 3. 改容差：有反例，真实引擎确认 ---------- */

const tolRaw = ledgerRaw.replace(/tolerance: 0\b/g, "tolerance: 100");
const tol = await proveLedgerRules(ledgerRaw, tolRaw);
expect(tol.verdict === "different", `容差 0→100 应不等价，实际 ${tol.verdict}`);
const reconCx = tol.counterexamples.find((c) => c.field === "recon");
expect(reconCx, `应有对账结论的反例；实际字段：${tol.counterexamples.map((c) => c.field).join(",")}`);
expect(reconCx!.engineConfirmed, `反例应被真实引擎确认：${reconCx!.engineNote}`);
expect(reconCx!.row.invoice != null, "容差反例应带发票额");
expect(reconCx!.row.gross >= 1 && reconCx!.row.tax >= 0 && (reconCx!.row.invoice ?? 0) >= 0, `反例应是正常单据：${JSON.stringify(reconCx!.row)}`);
expect(reconCx!.steps.length === tol.stepsChanged.length, `同类差异应合并为一条：${reconCx!.steps.length}/${tol.stepsChanged.length} 步`);
expect(new Set(tol.counterexamples.map((c) => c.field)).size === tol.counterexamples.length, "每类差异只应出现一次");
const gap = Math.abs(reconCx!.row.gross - (reconCx!.row.invoice ?? 0));
expect(gap > 0 && gap <= 100, `反例差额应落在 (0,100]，实际 ${gap}`);
expect(reconCx!.baseline.recon === "发票差额拦截" && reconCx!.candidate.recon === "通过", "反例两版对账结论应为 拦截 → 通过");
expect(tol.counterexamples.every((c) => c.engineConfirmed), "所有反例都应被真实引擎确认");
expect(reconCx!.csv.split("\n").length === 2, "反例 CSV 应为表头 + 一行");
console.log(`PASS  容差 0→100：${tol.headline}；示例 金额${reconCx!.row.gross} 发票${reconCx!.row.invoice}`);

/* ---------- 4. 改总监线但仍在财务复核线之上：证明等价 ---------- */

const dirRaw = ledgerRaw.replace(/directorAt: 10000/g, "directorAt: 9000");
const dir = await proveLedgerRules(ledgerRaw, dirRaw);
expect(dir.verdict === "equivalent", `总监线 10000→9000（仍高于财务复核线 8000）应等价，实际 ${dir.verdict}：${dir.headline}`);
expect(dir.stepsChanged.length > 0 && dir.headline.includes("已证明"), `应说明改了参数但已证明等价：${dir.headline}`);
console.log(`PASS  总监线 10000→9000：${dir.headline}`);

/* ---------- 5. 修好死规则：财务复核线提到 20000 ---------- */

const fixRaw = ledgerRaw.replace(/financeReviewAt: 8000/g, "financeReviewAt: 20000");
const fix = await proveLedgerRules(ledgerRaw, fixRaw);
expect(fix.verdict === "different", `财务复核线 8000→20000 应不等价，实际 ${fix.verdict}`);
const queueCx = fix.counterexamples.find((c) => c.field === "queue");
expect(queueCx?.engineConfirmed, "审批队列反例应被真实引擎确认");
expect(queueCx!.grossRange?.min === 8000, `差异最低金额应为 8000，实际 ${queueCx!.grossRange?.min}`);
expect(queueCx!.grossRange?.max === 19999.99, `差异最高金额应为 19999.99，实际 ${queueCx!.grossRange?.max}`);
const fixedDead = fix.deadBranches.find((d) => d.target === "总监");
expect(fixedDead?.version === "baseline", `新版应修好总监死规则（只剩现用版），实际 ${fixedDead?.version ?? "无"}`);
console.log(`PASS  财务复核线 8000→20000：差异金额区间 [${queueCx!.grossRange!.min}, ${queueCx!.grossRange!.max}]，新版总监队列恢复可达`);

/* ---------- 6. 改分组列：部分证明 ---------- */

const groupRaw = ledgerRaw.replace(/groupBy: 部门/g, "groupBy: 申请人");
const group = await proveLedgerRules(ledgerRaw, groupRaw);
expect(group.verdict === "partial", `只改分组列应为部分证明，实际 ${group.verdict}`);
expect(group.unmodeled.length === 1 && group.unmodeled[0]!.includes("分组列"), `同一处分组列改动应合并为一条：${group.unmodeled.join(" | ")}`);
console.log(`PASS  改分组列：${group.headline}`);

/* ---------- 7. 非报销技能：明确不适用 ---------- */

const ticketRaw = readFileSync(path.join(process.cwd(), "src/skills/ticket-desk/SKILL.md"), "utf8");
const ticket = await proveLedgerRules(ticketRaw, ticketRaw);
expect(!ticket.supported && ticket.reason, "工单技能应明确返回不适用");
expect(parseSkillMarkdown(ledgerRaw).ok, "ledger-desk 原文应能解析");
console.log("PASS  非报销技能明确返回不适用");

console.log("PASS  test-rule-prover");
process.exit(0);
