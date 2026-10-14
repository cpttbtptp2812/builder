/**
 * 技能变异测试：
 * 1) 现用 ledger-desk 在真实发版检查下得到真实得分（变异体逐个走 evaluateSkillGate + 服务端执行）；
 * 2) 证明器判定等价的变异体不计入分母；
 * 3) 没被抓住的变异体得到补充 case：在原版上通过、在真实检查里抓住它；
 * 4) 把补充 case 写进检查集后重跑，得分上升，且原版自检结论不变。
 * 检查集写在临时目录，不碰仓库里的 .ownagent。
 */
import { mkdtempSync, rmSync, readFileSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const configDir = mkdtempSync(path.join(tmpdir(), "ownagent-mutation-"));
if (existsSync(path.join(process.cwd(), ".ownagent", "policy.yml"))) {
  cpSync(path.join(process.cwd(), ".ownagent", "policy.yml"), path.join(configDir, "policy.yml"));
}
process.env.OWNAGENT_CONFIG_DIR = configDir;
process.env.OWNAGENT_Z3_ISOLATE = "1";

const { runMutationSuite } = await import("../server/skillMutation.ts");
const { appendGateCases, loadGateCases } = await import("../server/skillGate.ts");

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  rmSync(configDir, { recursive: true, force: true });
  process.exit(1);
}
function expect(cond: unknown, msg: string): void {
  if (!cond) fail(msg);
}

const raw = readFileSync(path.join(process.cwd(), "src/skills/ledger-desk/SKILL.md"), "utf8");

const first = await runMutationSuite("ledger-desk", raw, "repo");
expect(first.ok, `变异测试失败：${first.error}`);
console.log(`INFO  原版自检 ${first.selfGate}；${first.mutants.length} 个变异体，${(first.ms / 1000).toFixed(1)}s`);
for (const k of first.byKind) console.log(`      ${k.label}：抓住 ${k.killed}/${k.total}`);
for (const s of first.suggestions) console.log(`      补充 ${s.case.id}：${s.why}；抓住 ${s.kills.length} 个`);
console.log(`INFO  补充后 ${first.after ? `${first.after.killed}/${first.after.total}（${first.after.pct}%）` : "无"}`);

const eq = first.mutants.filter((m) => m.status === "equivalent").map((m) => m.id).sort();
expect(JSON.stringify(eq) === JSON.stringify(["directorAt-down", "directorAt-up"]), `等价变异体应是总监线两档（总监队列本就不可达），实际 ${eq.join(",")}`);
expect(first.score.killed + first.score.survived === first.mutants.length - eq.length, "等价变异体不应计入分母");
expect(first.suggestions.length > 0 && first.after, "应生成补充 case");
for (const s of first.suggestions) {
  expect(s.case.expect.observe && s.case.expect.observe.length > 0, `${s.case.id} 没有输出指纹`);
  expect(s.kills.length > 0, `${s.case.id} 没抓住任何变异体`);
}
const csvCases = first.suggestions.filter((s) => s.csv);
expect(csvCases.length > 0, "数值变异应由证明器给出区分单据");
console.log(`PASS  初始得分 ${first.score.killed}/${first.score.killed + first.score.survived}，证明等价 ${eq.length} 个不计分母；补充 ${first.suggestions.length} 条 case（${csvCases.length} 条来自证明器单据）`);

appendGateCases("ledger-desk", first.suggestions.map((s) => s.case));
expect(loadGateCases("ledger-desk").length === 1 + first.suggestions.length, "补充 case 没写进检查集");
const second = await runMutationSuite("ledger-desk", raw, "repo");
expect(second.ok, `重跑失败：${second.error}`);
expect(second.selfGate === first.selfGate, `加 case 后原版自检从 ${first.selfGate} 变成 ${second.selfGate}`);
expect(second.score.killed === first.after!.killed, `重跑得分 ${second.score.killed} 与预估 ${first.after!.killed} 不一致`);
expect(second.score.pct > first.score.pct, "补测试后得分没有上升");
console.log(`PASS  写入检查集后重跑：${second.score.killed}/${second.score.killed + second.score.survived}（${second.score.pct}%），原版自检仍为 ${second.selfGate}`);

rmSync(configDir, { recursive: true, force: true });
console.log("PASS  test-skill-mutation");
process.exit(0);
