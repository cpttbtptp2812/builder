/**
 * data-desk 产品态：右侧文书必须与 session 导入同源（禁止 executeData 默认 85）。
 */
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(os.tmpdir(), `ownagent-paper-${randomUUID()}.sqlite`);

import { continueProductRun, saveServerDataset, startProductRun } from "../server/productRun.ts";
import { getSkill } from "../server/skills.ts";
import { paperForSkill } from "../src/lib/workPaper.ts";

const FORBIDDEN_DEFAULT = /\b85 万元\b|ED202603-10-001/;

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}

function cashflowDataset(inflow: string) {
  return {
    slot: "cashflow-monthly" as const,
    title: "同步测试流水",
    columns: ["月份", "流入万元"],
    rows: [
      ["2025-05", inflow],
      ["2025-06", inflow],
      ["2025-07", inflow],
      ["2025-08", inflow],
      ["2025-09", inflow],
      ["2025-10", inflow],
    ],
  };
}

async function main() {
  const skill = getSkill("data-desk");
  if (!skill) fail("data-desk skill missing");

  const sessionEmpty = `paper-empty-${randomUUID()}`;
  const emptyPaper = paperForSkill(skill, "测算授信额度", {
    productWorkbench: true,
    sessionId: sessionEmpty,
  });
  if (emptyPaper) fail("无导入时文书应为 null");

  const sessionBad = `paper-bad-${randomUUID()}`;
  try {
    saveServerDataset(sessionBad, {
      slot: "cashflow-monthly",
      title: "坏表头",
      columns: ["列A", "列B"],
      rows: [["1", "2"]],
    });
    fail("无法识别的表头不得写入 session");
  } catch {
    /* expected */
  }
  const badPaper = paperForSkill(skill, "测算授信额度", {
    productWorkbench: true,
    sessionId: sessionBad,
  });
  if (badPaper) fail("无法解析的材料不应出授信文书");

  const sessionA = `paper-a-${randomUUID()}`;
  saveServerDataset(sessionA, cashflowDataset("77"));
  const paperA = paperForSkill(skill, "测算授信额度", {
    productWorkbench: true,
    sessionId: sessionA,
  });
  if (!paperA || paperA.kind !== "credit") fail("有合法导入应有 credit 文书");
  const blobA = JSON.stringify(paperA);
  if (FORBIDDEN_DEFAULT.test(blobA)) fail("文书含演示默认 85 或假编号");
  if (!blobA.includes("77")) fail("文书应反映导入流入 77，得: " + blobA.slice(0, 300));

  const sessionB = `paper-b-${randomUUID()}`;
  saveServerDataset(sessionB, cashflowDataset("33"));
  const paperB = paperForSkill(skill, "测算授信额度", {
    productWorkbench: true,
    sessionId: sessionB,
  });
  if (!paperB || paperB.kind !== "credit") fail("第二组导入应有文书");
  const blobB = JSON.stringify(paperB);
  if (blobB === blobA) fail("改 CSV 数字后文书必须变化");
  if (!blobB.includes("33")) fail("文书应反映导入流入 33");

  const sessionRun = `paper-run-${randomUUID()}`;
  const gate = await startProductRun({ sessionId: sessionRun, skillId: "data-desk", query: "测算授信额度" });
  if (!gate.ok || gate.status !== "waiting_import") fail("product-run 应先门闩");
  saveServerDataset(sessionRun, cashflowDataset("44"));
  const fin = await continueProductRun(gate.processId, sessionRun);
  if (!fin.ok || fin.status !== "finish") fail("继续后应 finish");
  const runPaper = fin.paper as { kind?: string } | null | undefined;
  if (!runPaper || runPaper.kind !== "credit") fail("finish 应带 credit paper");
  const runBlob = JSON.stringify(runPaper);
  if (FORBIDDEN_DEFAULT.test(runBlob)) fail("product-run paper 含演示默认");
  if (!runBlob.includes("44")) fail("product-run paper 须含本次导入 44");

  console.log("OK  data-desk paper ↔ import sync (empty/bad/null, 77 vs 33, product-run 44)");
  console.log("\nAll data-desk paper sync checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
