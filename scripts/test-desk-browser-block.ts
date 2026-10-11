/** 五办事 desk 禁止浏览器 runSkill（须 product-run） */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enrichSkillCatalog, hydrateSkill } from "../src/lib/skillMarkdown.ts";
import { CUSTOMER_SKILL_IDS, runSkill, type AgentSkill } from "../src/lib/agentSkills.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, "..", "src", "skills");

function loadDeskSkills(): AgentSkill[] {
  return CUSTOMER_SKILL_IDS.map((id) => {
    const raw = fs.readFileSync(path.join(SKILLS_DIR, id, "SKILL.md"), "utf8");
    return hydrateSkill(raw, { id, skillPath: `src/skills/${id}/SKILL.md` });
  }) as AgentSkill[];
}

async function main() {
  for (const skill of loadDeskSkills()) {
    let threw = false;
    try {
      await runSkill(skill, "smoke", undefined, { productWorkbench: true });
    } catch (e) {
      threw = true;
      const msg = e instanceof Error ? e.message : String(e);
      if (!/product-run|禁止浏览器/.test(msg)) {
        console.error(`FAIL ${skill.id}: 应拒绝浏览器 runSkill，实际: ${msg}`);
        process.exit(1);
      }
    }
    if (!threw) {
      console.error(`FAIL ${skill.id}: 浏览器 runSkill 应抛错但未抛`);
      process.exit(1);
    }
    console.log(`OK  ${skill.id} blocked in browser runSkill`);
  }
  console.log("All desk skills blocked from browser mock path.");
}

main();
