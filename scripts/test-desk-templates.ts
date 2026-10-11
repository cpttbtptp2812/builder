/**
 * 五 desk「下载模板」必须与 productSkillInputs 同源且可直接导入过 parseCsvText。
 */
import { parseCsvText } from "../src/lib/productDataStore.ts";
import { allDeskTemplateRequirements } from "../src/lib/productSkillInputs.ts";

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}

function main() {
  for (const { skillId, req } of allDeskTemplateRequirements()) {
    if (/12800|4200|张三|员工甲|示例部|待填/.test(req.templateCsv)) {
      fail(`${skillId} 模板含禁用占位或旧 demo 片段`);
    }
    const parsed = parseCsvText(req.templateCsv, req.filename, req.slot);
    if ("error" in parsed) {
      fail(`${skillId} 下载模板不可导入: ${parsed.error}\n---\n${req.templateCsv}`);
    }
    if (!parsed.rows.length) fail(`${skillId} 模板解析后无数据行`);
    console.log(`OK  template  ${skillId}  ${req.filename}  ${parsed.rows.length} 行`);
  }
  console.log("\nAll desk download templates are importable.");
}

main();
