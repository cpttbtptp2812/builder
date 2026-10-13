import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(os.tmpdir(), `ownagent-live-${randomUUID()}.sqlite`);

const { publishLiveSkill, rollbackLiveSkill, liveSkill } = await import("../server/liveSkills.ts");
const { getSkill } = await import("../server/skills.ts");

function fail(message: string): never {
  console.error(`FAIL  ${message}`);
  process.exit(1);
}

const skillId = "ticket-desk";
const raw10 = readFileSync(path.join(process.cwd(), "src/skills/ticket-desk/SKILL.md"), "utf8");
const raw09 = readFileSync(path.join(process.cwd(), "src/skills/ticket-desk/versions/0.09.md"), "utf8");
const changed = raw10.replace(/  - 工单分派\r?\n/, "  - 工单分派\n  - 跨浏览器线上触发词\n");
if (changed === raw10) fail("测试没有改到触发词");

publishLiveSkill({ skillId, version: "0.11", raw: changed, gate: "PASS", actorId: "tester" });
const live = getSkill(skillId);
if (!live?.triggers.includes("跨浏览器线上触发词")) fail("服务端 getSkill 没有读取 live catalog");
if (liveSkill(skillId)?.version !== "0.11") fail("live 指针版本不对");
console.log("PASS  publish immediately drives server getSkill");

publishLiveSkill({ skillId, version: "0.09", raw: raw09, gate: "PASS", actorId: "tester" });
publishLiveSkill({ skillId, version: "0.12", raw: changed, gate: "PASS", actorId: "tester" });
const rolled = rollbackLiveSkill(skillId, "0.09", "tester", "0.13");
if (!rolled || rolled.version !== "0.13" || rolled.raw !== raw09) fail("回滚没有生成新的 live 版本");
if (getSkill(skillId)?.steps.some((s) => s.id === "dedupe")) fail("回滚到 0.09 后仍有当前版合并步骤");
console.log("PASS  rollback switches runtime and preserves a new version");

console.log("\nlive skill catalog OK");
