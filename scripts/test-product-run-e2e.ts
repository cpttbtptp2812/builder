/**
 * 办事 product-run 端到端（Node + 隔离 SQLite）— ledger-desk 主 skill
 */
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(os.tmpdir(), `ownagent-e2e-${randomUUID()}.sqlite`);

import { archiveProductRun, continueProductRun, saveServerDataset, startProductRun } from "../server/productRun.ts";
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

type DeskCase = {
  skillId: string;
  query: string;
  uploads: { slot: ProductDataSlot; title: string; columns: string[]; rows: string[][] }[];
  expect: RegExp[];
};

const DESK_CASES: DeskCase[] = [
  {
    skillId: "ticket-desk",
    query: "把这批工单分派一下，看看时效",
    uploads: [
      {
        slot: "service-tickets",
        title: "E2E十月工单",
        columns: ["工单号", "客户", "创建时间", "首次响应时间", "解决时间", "标题", "内容", "状态"],
        rows: [
          ["Q771", "客户Q1", "2026-10-13 09:00", "2026-10-13 09:20", "", "退款没到账", "申请退款一周了还没到账", "处理中"],
          ["Q772", "客户Q2", "2026-10-13 10:00", "", "", "APP 闪退", "一打开就闪退", "待处理"],
          ["Q773", "客户Q3", "2026-10-13 11:00", "2026-10-13 11:05", "2026-10-13 11:40", "如何改密码", "请问在哪里改密码", "已解决"],
        ],
      },
      {
        slot: "service-agents",
        title: "E2E坐席",
        columns: ["坐席", "技能组", "在岗"],
        rows: [
          ["坐席Q1", "账务组|综合组", "是"],
          ["坐席Q2", "技术组", "是"],
        ],
      },
    ],
    expect: [/E2E十月工单/, /共 3 张工单/, /未结 2 张/, /已分派 2 张/],
  },
  {
    skillId: "shift-desk",
    query: "按员工表和班次需求排一下班",
    uploads: [
      {
        slot: "staff-roster",
        title: "E2E店员",
        columns: ["员工", "岗位技能", "用工类型", "时薪"],
        rows: [
          ["店员Q1", "收银|值班长", "全职", "31"],
          ["店员Q2", "收银", "全职", "27"],
        ],
      },
      {
        slot: "shift-demand",
        title: "E2E班次",
        columns: ["日期", "开始", "结束", "岗位", "人数"],
        rows: [
          ["2026-10-19", "09:00", "17:00", "收银", "1"],
          ["2026-10-20", "09:00", "17:00", "收银", "2"],
        ],
      },
    ],
    expect: [/E2E班次/, /共需 3 人次，排上 3 人次/, /覆盖率 100\.0%/],
  },
];

async function testDeskGateAndFinish(c: DeskCase) {
  const sessionId = `e2e-${c.skillId}-${randomUUID()}`;
  const first = await startProductRun({ sessionId, skillId: c.skillId, query: c.query });
  if (!first.ok || first.status !== "waiting_import") {
    fail(`${c.skillId} gate: 无材料应 waiting_import，得 ${first.ok ? first.status : "error"}`);
  }
  assertNoDemo(first.message, `${c.skillId} gate message`);
  assertCustomerGateCopy(first.message, `${c.skillId} gate message`);
  if (/客户Q|店员Q|坐席Q/.test(first.message)) fail(`${c.skillId} gate: 不该出现数据`);
  const gateImports = first.parts.filter((p) => p.kind === "import");
  if (gateImports.length !== c.uploads.length) {
    fail(`${c.skillId} gate: 应有 ${c.uploads.length} 个导入位，得 ${gateImports.length}`);
  }
  if (first.parts.some((p) => p.kind === "process")) fail(`${c.skillId} gate: 门闩时不该有处理步骤`);
  console.log(`OK  gate  ${c.skillId} waiting_import (${gateImports.length} slot)`);

  for (const u of c.uploads) saveServerDataset(sessionId, u);
  const fin = await continueProductRun(first.processId, sessionId);
  if (!fin.ok || fin.status !== "finish") {
    fail(`${c.skillId} finish: 上传后应 finish，得 ${fin.ok ? fin.status : "error"} ${fin.ok ? fin.message.slice(0, 200) : ""}`);
  }
  const blob = finishBlob(fin);
  assertNoDemo(blob, `${c.skillId} finish output`);
  assertNoDuplicateSentences(fin.message, `${c.skillId} finish message`);
  for (const re of c.expect) {
    if (!re.test(blob)) fail(`${c.skillId} finish: 结论应含 ${re}：${blob.slice(0, 600)}`);
  }
  const trace = fin.trace as { tool?: string; ok?: boolean }[] | undefined;
  if (!trace?.some((t) => t.tool === "__llm_product_brief__" && t.ok)) {
    fail(`${c.skillId} finish: trace 须含成功的 __llm_product_brief__ 步`);
  }
  const steps = fin.parts.filter((p) => p.kind === "process");
  if (steps.length < 10) fail(`${c.skillId} finish: 处理步骤只有 ${steps.length} 步`);
  const corrected = c.uploads[0]!;
  saveServerDataset(sessionId, { ...corrected, title: `修正后-${corrected.title}` });
  const rerun = await continueProductRun(first.processId, sessionId, undefined, undefined, "rerun");
  if (!rerun.ok || rerun.status !== "finish") fail(`${c.skillId}: 替换材料后应可 rerun 办结`);
  const duplicate = await continueProductRun(first.processId, sessionId);
  if (duplicate.ok || !duplicate.error.includes("已经完成")) fail(`${c.skillId}: 已办结 process 不应被重复 continue`);
  const archived = archiveProductRun(first.processId, sessionId, "e2e-user");
  if (!archived.ok || !archived.archivedAt) fail(`${c.skillId}: 办结后应可持久化归档`);
  console.log(`OK  ${c.skillId} finish with upload (${steps.length} steps)`);
}

async function main() {
  await testGateNoData();
  await testStaleSessionDoesNotAutoRun();
  await testLedgerFinish();
  for (const c of DESK_CASES) await testDeskGateAndFinish(c);
  console.log("OK  test-product-run-e2e (ledger-desk, ticket-desk, shift-desk)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
