/**
 * 技能页「用材料试跑」：试跑会话材料 → 线上 / 草稿各跑 runInlineSkill → summarize / compare
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(os.tmpdir(), `ownagent-tryrun-${randomUUID()}.sqlite`);

const { saveServerDataset } = await import("../server/productRun.ts");
const { runInlineSkill } = await import("../server/skillTryRun.ts");
const { summarizeTryRun, compareTryRuns } = await import("../src/lib/skillTryRun.ts");

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}

const SKILL_ID = "ledger-desk";
const online = readFileSync(path.join(process.cwd(), "src/skills/ledger-desk/SKILL.md"), "utf8");
const draft = online.replace(/tolerance: 0\b/g, "tolerance: 200");
if (draft === online) fail("草稿没改出来：SKILL 里找不到 tolerance: 0");

const columns = ["部门", "申请人", "金额", "税额", "发票额", "状态", "费用类型"];
const rows = [
  ["销售", "刘一", "3200", "416", "3200", "待审", "差旅"],
  ["销售", "陈二", "950", "124", "0", "待审", "招待"],
  ["技术", "周三", "6100", "793", "6000", "待审", "设备"],
  ["技术", "吴四", "410", "53", "410", "已审", "办公"],
];

async function run(raw: string, sessionId: string) {
  const out = await runInlineSkill({ skillId: SKILL_ID, raw, query: "按部门汇总，发票对不上的拦下来", sessionId, productWorkbench: true });
  if (!out.ok) fail(`runInlineSkill 失败：${out.error}`);
  return summarizeTryRun(out.result as Parameters<typeof summarizeTryRun>[0]);
}

const sid = `tryrun-test-${randomUUID()}`;
saveServerDataset(sid, { slot: "expense-ledger", title: "九月报销.csv", columns, rows });

const a = await run(online, sid);
if (!a.ok) fail(`线上版应跑通，停在 ${a.failedStep?.stepId}: ${a.failedStep?.detail}`);
if (!a.conclusion.includes("10660")) fail(`结论应是本材料合计 10660，得：${a.conclusion}`);
if (!a.steps[0]?.detail.includes("九月报销.csv")) fail(`第一步应读到材料名，得：${a.steps[0]?.detail}`);
if (a.model?.state !== "skipped") fail(`未配模型时模型步应为 skipped，得 ${a.model?.state}`);
console.log(`PASS  线上版：${a.steps.length} 步，结论「${a.conclusion.slice(0, 60)}」`);

const b = await run(draft, sid);
if (!b.ok) fail(`草稿应跑通，停在 ${b.failedStep?.stepId}`);
const cmp = compareTryRuns(a, b);
const recon = cmp.rows.find((r) => r.stepId === "recon");
if (!recon) fail("对比结果里没有对账步");
if (!recon.changed) fail(`容差 0→200 后对账步应不同：线上「${recon.online?.detail}」草稿「${recon.draft?.detail}」`);
const modelRow = cmp.rows.find((r) => r.draft?.tool === "__llm_product_brief__");
if (modelRow?.changed) fail("模型步措辞不同不应算作结果变了");
console.log(`PASS  草稿对比：${cmp.changedCount} 步不同；对账 线上「${recon.online?.detail}」→ 草稿「${recon.draft?.detail}」`);

const same = compareTryRuns(a, await run(online, sid));
if (same.changedCount !== 0) fail(`同一版本跑两次不应有差异，得 ${same.changedCount}`);
console.log("PASS  同一版本重复跑：0 步不同");

const empty = await run(online, `tryrun-empty-${randomUUID()}`);
if (empty.ok) fail("没有材料不应跑通");
if (/10660|刘一|陈二/.test(empty.conclusion)) fail(`无材料结论不应出现数据：${empty.conclusion}`);
if (/expense-ledger|[a-z]+-[a-z]+/.test(empty.conclusion)) fail(`无材料提示不应露内部编号：${empty.conclusion}`);
console.log(`PASS  无材料：停在「${empty.failedStep?.stepId}」— ${empty.conclusion.slice(0, 60)}`);

const broken = await runInlineSkill({ skillId: SKILL_ID, raw: "---\nname: ledger-desk\nsteps:\n  - id: x\n    tool: __no_such_tool__\n---\n", query: "对账", sessionId: sid });
if (broken.ok) fail("写错工具名的 SKILL 不应能跑");
console.log(`PASS  写错的 SKILL：${broken.error}`);

console.log("\nskill try-run OK");
