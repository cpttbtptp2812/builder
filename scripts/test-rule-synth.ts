/**
 * 反事实最小改动 + 例子反推规则：
 * 1) patchLedgerArgs 只改报销规则步骤、补缺失参数、不动别的步骤；
 * 2) 导入真实台账（走客户同一条材料路径）→ 被拦单据的最小规则改动经 Z3 证明最小，并由真实引擎复跑确认全部放行；
 * 3) 每张被拦单据各自给出规则改法与数据改法，数据改法代回引擎确实通过；
 * 4) 例子反推：一致的例子求出最近参数，引擎逐条复核通过；矛盾的例子给出最小冲突集。
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const { patchLedgerArgs, ledgerStepRules, QUEUE_CODES } = await import("../src/lib/ledgerRuleModel.ts");
const { parseSkillMarkdown } = await import("../src/lib/skillMarkdown.ts");
const { newLabSession, saveLabDataset } = await import("../server/labSession.ts");
const { deleteServerDataset } = await import("../server/productDataStore.ts");
const { counterfactualForSession, synthesizeRules } = await import("../server/ruleSynth.ts");
const { engineSide } = await import("../server/ruleProver.ts");
const { buildSheetProgramState } = await import("../src/lib/sheetDeskProgram.ts");

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}
function expect(cond: unknown, msg: string): void {
  if (!cond) fail(msg);
}

const raw = readFileSync(path.join(process.cwd(), "src/skills/ledger-desk/SKILL.md"), "utf8");

/* ---------- 1. patchLedgerArgs ---------- */
{
  expect(patchLedgerArgs(raw, {}) === raw, "空补丁必须原样返回");
  const patched = patchLedgerArgs(raw, { tolerance: 2.5, maxSingleAmount: 250000, missing: "pass" });
  const before = parseSkillMarkdown(raw).steps;
  const after = parseSkillMarkdown(patched).steps;
  expect(before.length === after.length, "补丁后步骤数变了");
  for (const [i, step] of after.entries()) {
    const old = before[i]!;
    expect(step.id === old.id && step.tool === old.tool, `第 ${i + 1} 步 id/tool 被改`);
    if (!step.tool.startsWith("__sheet_") || !old.args) {
      expect(JSON.stringify(step.args ?? {}) === JSON.stringify(old.args ?? {}), `非报销步骤 ${step.id} 的参数被动了`);
      continue;
    }
    expect(Number(step.args?.tolerance) === 2.5, `${step.id} 容差没改成 2.5`);
    expect(Number(step.args?.maxSingleAmount) === 250000, `${step.id} 单行上限没补上`);
    expect(step.args?.missing === "pass", `${step.id} 缺票策略没改`);
    for (const [k, v] of Object.entries(old.args)) {
      if (["tolerance", "maxSingleAmount", "missing"].includes(k)) continue;
      expect(JSON.stringify(step.args?.[k]) === JSON.stringify(v), `${step.id}.${k} 被误改`);
    }
  }
  console.log(`PASS  草稿补丁：${after.filter((s) => s.tool.startsWith("__sheet_")).length} 个报销步骤改参，其余步骤原样`);
}

/* ---------- 2/3. 反事实：真实导入的台账 ---------- */
const ledgerCsv = [
  "部门,报销人,报销金额,税额,发票金额",
  "销售部,张伟,3200,0,3200",
  "市场部,李娜,4580.5,0,4578",
  "研发部,王强,12000,0,11990",
  "行政部,赵敏,860,0,",
  "销售部,陈晨,6400,384,6400",
].join("\n");

const sessionId = newLabSession();
try {
  const saved = saveLabDataset(sessionId, { csv: ledgerCsv, title: "九月差旅报销台账.csv", slot: "expense-ledger" });
  expect(saved.ok, `导入失败：${"error" in saved ? saved.error : ""}`);
  if (!saved.ok) process.exit(1);
  expect(saved.columns.includes("申请人") && saved.columns.includes("发票额"), `列名没有归一：${saved.columns.join(",")}`);

  const cf = await counterfactualForSession(sessionId, raw);
  expect(cf.ok, `反事实失败：${cf.error}`);
  expect(cf.title.includes("九月差旅报销台账"), `表标题不是材料名：${cf.title}`);
  expect(cf.rows === 5, `应读到 5 行，实际 ${cf.rows}`);
  const blockedNames = cf.blockedRows.map((r) => r.person).sort();
  expect(JSON.stringify(blockedNames) === JSON.stringify(["李娜", "王强", "赵敏"].sort()), `被拦单据不对：${blockedNames.join("、")}`);

  const g = cf.global;
  expect(g, "没有给出整体最小改动");
  if (!g) process.exit(1);
  const keys = g.changes.map((c) => c.key).sort();
  expect(JSON.stringify(keys) === JSON.stringify(["missing", "tolerance"]), `最小改动应为容差+缺票策略，实际 ${keys.join(",")}`);
  const tol = g.changes.find((c) => c.key === "tolerance")!;
  expect(tol.to === "10 元", `最小容差应恰好是最大差额 10 元，实际 ${tol.to}`);
  expect(g.provedMinimal, "最小性没有被证明");
  expect(g.engine.stillBlocked === 0, `按最小改动改完，真实引擎仍拦 ${g.engine.stillBlocked} 张`);
  console.log(`PASS  整体最小改动：${g.changes.map((c) => `${c.label} ${c.from}→${c.to}`).join("，")}；${g.minimalNote.slice(0, 40)}…；引擎复跑 0 张被拦`);

  // 最小性反向佐证：容差只放到 9.99 时，王强仍被引擎拦下
  const looser = patchLedgerArgs(raw, { tolerance: 9.99, missing: "pass" });
  const report = ledgerStepRules(parseSkillMarkdown(looser).steps).find((r) => r.tool === "__sheet_report__")!;
  const st = buildSheetProgramState("", report.recipe, { productWorkbench: true, sessionId, dataSlot: "expense-ledger" });
  expect(st.reconcileFlags.some((f) => f.person === "王强" && f.kind === "拦截"), "容差 9.99 时王强应仍被拦");
  console.log("PASS  反向佐证：容差少一分（9.99 元）真实引擎仍拦王强");

  expect(cf.perRow.length === 3, `逐张改法应 3 条，实际 ${cf.perRow.length}`);
  const lina = cf.perRow.find((r) => r.row.person === "李娜")!;
  expect(lina.reason.includes("2.5"), `李娜原因不对：${lina.reason}`);
  expect(lina.ruleFix?.length === 1 && lina.ruleFix[0]!.to === "2.5 元", `李娜规则改法不对：${JSON.stringify(lina.ruleFix)}`);
  const zm = cf.perRow.find((r) => r.row.person === "赵敏")!;
  expect(zm.ruleFix?.[0]?.key === "missing", "赵敏应改缺票策略");
  expect(zm.dataFix?.invoice === 860 && zm.dataFix.note.includes("补一张"), `赵敏数据改法不对：${JSON.stringify(zm.dataFix)}`);
  const rules = ledgerStepRules(parseSkillMarkdown(raw).steps);
  const reportRule = rules.find((r) => r.tool === "__sheet_report__")!;
  for (const fix of cf.perRow) {
    expect(fix.dataFix, `${fix.row.person} 缺数据改法`);
    const side = engineSide(reportRule, { gross: fix.dataFix!.gross, tax: fix.row.tax, invoice: fix.dataFix!.invoice });
    expect(!side.blocked, `${fix.row.person} 按数据改法改完，真实引擎仍拦`);
  }
  console.log(`PASS  逐张改法：${cf.perRow.map((r) => `${r.row.person}（${r.reason}）→ ${r.dataFix!.note}`).join("；")}；数据改法代回引擎全部通过`);
} finally {
  deleteServerDataset(sessionId, "expense-ledger");
}

/* ---------- 4. 例子反推 ---------- */
{
  const ok = await synthesizeRules(raw, [
    { gross: 6000, tax: 0, invoice: 6000, expect: { queue: "部门负责人" } },
    { gross: 9500, tax: 0, invoice: 9500, expect: { queue: "总监" } },
    { gross: 15000, tax: 0, invoice: 15000, expect: { queue: "财务复核（达线）" } },
    { gross: 3000, tax: 0, invoice: 2990, expect: { blocked: false } },
  ]);
  expect(ok.ok && ok.status === "sat", `一致例子应可解：${ok.error ?? ok.status}`);
  expect(ok.verified.length === 4 && ok.verified.every((v) => v.pass), `引擎复核未全过：${JSON.stringify(ok.verified.map((v) => [v.engineQueue, v.engineBlocked]))}`);
  const k = ok.changes.map((c) => c.key).sort();
  expect(JSON.stringify(k) === JSON.stringify(["directorAt", "financeReviewAt", "tolerance"]), `改动参数不对：${k.join(",")}`);
  expect(ok.impact && ok.impact.counterexamples > 0, "应附带与现用版的差异证明");
  console.log(`PASS  例子反推：${ok.changes.map((c) => `${c.label} ${c.from}→${c.to}`).join("，")}；引擎逐条复核 4/4；${ok.impact!.headline.slice(0, 30)}…`);

  const bad = await synthesizeRules(raw, [
    { gross: 15000, tax: 0, invoice: 15000, expect: { queue: "财务复核（达线）" } },
    { gross: 6000, tax: 0, invoice: 6000, expect: { queue: "部门负责人" }, label: "甲" },
    { gross: 2000, tax: 0, invoice: 2000, expect: { queue: "出纳" } },
    { gross: 6000, tax: 0, invoice: 6000, expect: { queue: QUEUE_CODES[0] }, label: "乙" },
  ]);
  expect(bad.ok && bad.status === "unsat", `矛盾例子应无解：${bad.status}`);
  const core = bad.conflict.map((c) => c.index).sort();
  expect(JSON.stringify(core) === JSON.stringify([1, 3]), `最小冲突集应是第 2、4 个例子，实际 ${core.map((i) => i + 1).join(",")}`);
  console.log(`PASS  矛盾例子：最小冲突集 = 第 ${core.map((i) => i + 1).join("、")} 个（同一张 6000 元单据既要进负责人又要进出纳）`);

  // 5020 - 5000.4 在浮点里是 19.600000000000364；容差恰好 19.6 时引擎必须和求解器一样判通过
  const edge = await synthesizeRules(raw, [
    { gross: 4580.5, tax: 0, invoice: 4578, expect: { queue: "出纳", blocked: false } },
    { gross: 12000, tax: 0, invoice: 11990, expect: { blocked: true } },
    { gross: 2280, tax: 0, invoice: 2205, expect: { blocked: true } },
    { gross: 5020, tax: 0, invoice: 5000.4, expect: { queue: "部门负责人", blocked: false } },
  ]);
  expect(edge.ok && edge.status === "sat", `分位边界例子应可解：${edge.error ?? edge.status}`);
  expect(
    edge.verified.length === 4 && edge.verified.every((v) => v.pass),
    `求解器和引擎在分位边界上不一致：${JSON.stringify(edge.verified.map((v) => [v.example.gross, v.engineQueue, v.engineBlocked]))}`,
  );
  console.log(`PASS  分位边界：${edge.changes.map((c) => `${c.label} ${c.from}→${c.to}`).join("，")}；差额 19.60 = 容差时引擎判通过，与 Z3 一致`);
}

console.log("PASS  test-rule-synth");
process.exit(0);
