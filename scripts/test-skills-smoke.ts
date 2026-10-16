/**
 * 非办事 desk 技能冒烟 — 服务端 runSkillOnServer，隔离 DB
 */
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(os.tmpdir(), `ownagent-smoke-${randomUUID()}.sqlite`);

import { getSkill, runSkillOnServer } from "../server/skills.ts";
import { mustRunServerProcessSkill } from "../src/lib/customerSkillKernel.ts";

const CASES: { skillId: string; query: string; minOkSteps?: number }[] = [
  { skillId: "agent-copilot", query: "Agent Copilot 综合诊断本站", minOkSteps: 5 },
  { skillId: "policy-desk", query: "满一年年假有几天" },
  { skillId: "knowledge-lookup", query: "OwnAgent 是什么" },
  { skillId: "site-analyzer", query: "检查本站能不能打开" },
  { skillId: "dom-probe", query: "分析当前页 DOM 结构" },
  { skillId: "workflow-orchestrator", query: "workflow 入队执行" },
  { skillId: "product-faq", query: "OwnAgent 怎么用" },
];

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}

async function main() {
  console.log("skills smoke (server, non-desk)…");
  for (const { skillId, query, minOkSteps = 1 } of CASES) {
    if (mustRunServerProcessSkill(skillId)) {
      fail(`${skillId} 不应出现在 smoke，须 product-run`);
    }
    const skill = getSkill(skillId);
    if (!skill?.runnable) {
      console.log(`SKIP ${skillId} (not runnable)`);
      continue;
    }
    const sessionId = `smoke-${skillId}-${randomUUID()}`;
    try {
      const { trace } = await runSkillOnServer(skillId, query, sessionId, {});
      const okSteps = trace.filter((t) => t.ok).length;
      if (okSteps < minOkSteps) {
        fail(`${skillId}: 期望至少 ${minOkSteps} 步 ok，得 ${okSteps}/${trace.length}`);
      }
      console.log(`OK  smoke ${skillId} (${okSteps}/${trace.length} steps ok)`);
    } catch (e) {
      fail(`${skillId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log("\nAll non-desk skill smoke checks passed.");
}

main();
