/**
 * 办事 product-run 端到端（Node + 隔离 SQLite）— ledger-desk 主 skill
 */
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(os.tmpdir(), `ownagent-e2e-${randomUUID()}.sqlite`);

import { continueProductRun, saveServerDataset, startProductRun } from "../server/productRun.ts";
import type { ProductDataSlot } from "../src/lib/productDataStore.ts";

const DEMO_FORBIDDEN = [/12800/, /4200/, /张三/, /李四/, /王旭/, /星图智造/, /问句里的表/];

const PRODUCT_SKILL = "ledger-desk" as const;

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}

function assertNoDemo(text: string, ctx: string) {
  for (const re of DEMO_FORBIDDEN) {
    if (re.test(text)) fail(`${ctx} 含 demo/禁用片段 ${re}: ${text.slice(0, 200)}`);
  }
}

function assertCustomerGateCopy(text: string, ctx: string) {
  if (/[（(].*[）)]/.test(text)) fail(`${ctx} 含括号/internal 说明，须客户文案: ${text.slice(0, 200)}`);
  if (/本机|session|auto-run|模板样例/.test(text)) fail(`${ctx} 含内部词: ${text.slice(0, 200)}`);
}

function assertNoDuplicateSentences(text: string, ctx: string) {
  const chunks = text
    .split(/[。；\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
  const seen = new Set<string>();
  for (const c of chunks) {
    if (seen.has(c)) fail(`${ctx} 文案重复：「${c.slice(0, 80)}…」`);
    seen.add(c);
  }
}

function finishBlob(fin: { message: string; parts: { kind: string; detail?: string; summary?: string }[] }) {
  return [fin.message, ...fin.parts.map((p) => (p.kind === "process" ? p.detail : p.kind === "finish" ? p.summary : ""))].join(
    "\n",
  );
}

async function testGateNoData() {
  const sessionId = `e2e-gate-${randomUUID()}`;
  const res = await startProductRun({ sessionId, skillId: PRODUCT_SKILL, query: "发票对不上" });
  if (!res.ok) fail(`gate: start 失败 ${"error" in res ? res.error : ""}`);
  if (res.status !== "waiting_import") {
    fail(`gate: 无导入应为 waiting_import，得 ${res.status}`);
  }
  assertNoDemo(res.message, "gate message");
  assertCustomerGateCopy(res.message, "gate message");
  const importParts = res.parts.filter((p) => p.kind === "import");
  if (!importParts.length) fail("gate: 缺少 import parts");
  console.log(`OK  gate  ${PRODUCT_SKILL} waiting_import (${importParts.length} slot)`);
}

async function testStaleSessionDoesNotAutoRun() {
  const sessionId = `e2e-stale-${randomUUID()}`;
  saveServerDataset(sessionId, {
    slot: "expense-ledger",
    title: "旧会话两行",
    columns: ["部门", "申请人", "金额", "税额", "发票额", "状态"],
    rows: [
      ["研发", "经办A", "12800", "1664", "12800", "待审"],
      ["市场", "经办B", "4200", "546", "4200", "待审"],
    ],
  });
  const res = await startProductRun({ sessionId, skillId: PRODUCT_SKILL, query: "按部门汇总报销表" });
  if (!res.ok || res.status !== "waiting_import") {
    fail(`stale session: 新开 process 必须门闩，不得 auto-finish，得 ${res.ok ? res.status : "error"}`);
  }
  assertNoDemo(res.message, "stale session gate message");
  assertCustomerGateCopy(res.message, "stale session gate message");
  const imports = res.parts.filter((p) => p.kind === "import");
  if (imports.length !== 1) fail(`stale session: 应有 1 个 import part，得 ${imports.length}`);
  const imp = imports[0] as { ready?: boolean; rowCount?: number; materialTitle?: string };
  if (!imp.ready || imp.rowCount !== 2) fail("stale session: import part 应 ready 且 rowCount=2");
  if (!imp.materialTitle) fail("stale session: 应有 materialTitle");
  console.log("OK  stale session data does not auto-run process");
}

async function testLedgerFinish() {
  const sessionId = `e2e-finish-${randomUUID()}`;
  const query = "按部门汇总报销表，标出和发票对不上的";
  const slot: ProductDataSlot = "expense-ledger";
  const first = await startProductRun({ sessionId, skillId: PRODUCT_SKILL, query });
  if (!first.ok || first.status !== "waiting_import") {
    fail(`finish: 第一步应门闩，得 ${first.ok ? first.status : "error"}`);
  }
  saveServerDataset(sessionId, {
    slot,
    title: "E2E上传报销明细",
    columns: ["部门", "申请人", "金额", "税额", "发票额", "状态"],
    rows: [
      ["测试部", "用例甲", "77701", "10101", "77701", "待审"],
      ["测试部", "用例乙", "88802", "11544", "88802", "待审"],
    ],
  });
  const fin = await continueProductRun(first.processId, sessionId);
  if (!fin.ok || fin.status !== "finish") {
    fail(`finish: 继续后应 finish，得 ${fin.ok ? fin.status : "error"}`);
  }
  const blob = finishBlob(fin);
  assertNoDemo(blob, "finish output");
  assertNoDuplicateSentences(fin.message, "finish message");
  if (!/E2E上传报销明细|166503/.test(blob)) {
    fail(`finish: 未见上传材料标记: ${blob.slice(0, 500)}`);
  }
  const steps = fin.parts.filter((p) => p.kind === "process");
  if (!steps.length) fail("finish: 应有 process 步骤");
  const trace = fin.trace as { tool?: string; ok?: boolean }[] | undefined;
  if (!trace?.some((t) => t.tool === "__llm_product_brief__" && t.ok)) {
    fail("finish: trace 须含成功的 __llm_product_brief__ 步");
  }
  const importsAfter = fin.parts.filter((p) => p.kind === "import");
  if (!importsAfter.length) fail("finish: 办结后仍应有 import parts");
  console.log("OK  ledger-desk finish with upload + llm step");
}

async function main() {
  await testGateNoData();
  await testStaleSessionDoesNotAutoRun();
  await testLedgerFinish();
  console.log("OK  test-product-run-e2e (ledger-desk)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
