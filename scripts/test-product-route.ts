/** 办事对话路由回归 — 不启动浏览器，Node 侧与 pickSkill 同源 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enrichSkillCatalog, hydrateSkill } from "../src/lib/skillMarkdown.ts";
import { isCustomerSkill } from "../src/lib/agentSkills.ts";
import { routeQuery } from "../src/lib/skillRouter.ts";
import type { AgentSkill } from "../src/lib/agentSkills.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, "..", "src", "skills");

function loadCustomerCatalog(): AgentSkill[] {
  const cores = fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, d.name, "SKILL.md")))
    .map((d) => {
      const raw = fs.readFileSync(path.join(SKILLS_DIR, d.name, "SKILL.md"), "utf8");
      return hydrateSkill(raw, { id: d.name, skillPath: `src/skills/${d.name}/SKILL.md` });
    });
  return enrichSkillCatalog(cores, "server").filter(
    (s) => s.runnable && s.steps.length > 0 && isCustomerSkill(s.id),
  ) as AgentSkill[];
}

const GATE_QUERIES: { q: string; want: string }[] = [
  { q: "发票对不上", want: "ledger-desk" },
  { q: "报销表", want: "ledger-desk" },
  { q: "智能对账", want: "ledger-desk" },
  { q: "按部门汇总报销", want: "ledger-desk" },
];

const catalog = loadCustomerCatalog();
if (catalog.length !== 1 || catalog[0]?.id !== "ledger-desk") {
  console.error("FAIL customer catalog 应仅 ledger-desk，得:", catalog.map((s) => s.id).join(", "));
  process.exit(1);
}
const ledger = catalog[0]!;
if (!ledger.runnable) {
  console.error("FAIL ledger-desk not runnable");
  process.exit(1);
}

let failed = 0;
for (const { q, want } of GATE_QUERIES) {
  const d = routeQuery(q, catalog);
  const ok = d.kind === "skill" && d.skillId === want && d.score >= 2;
  const line = `${ok ? "OK" : "FAIL"}  q="${q}" → ${d.skillId ?? d.kind} (want ${want}) score=${d.score}`;
  console.log(line);
  if (!ok) failed += 1;
}

if (failed) process.exit(1);
console.log("OK  test-product-route");
