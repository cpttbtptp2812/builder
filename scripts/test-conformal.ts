/**
 * 共形路由的“诚实”部分：
 * 1) 有限样本覆盖带：Beta 分位数对闭式解（l=1 时 CDF = x^a）逐位一致；蒙特卡洛模拟 4000 次分割共形，落在 90% 带内的比例 ≈ 90%，均值 ≥ 1-α；
 * 2) 真实路由器（字符模型，校准集 + 技能目录）：反复切分的实测覆盖率 ≥ 1-α（容差 2 个百分点），按去向列出样本是否够；
 * 3) 发版必问句当留出集（分布不同、不参与校准）：给出实测覆盖率与被问率，不假装满足保证；
 * 4) 决策规则：只有预测集恰好一个且不是离群才直接执行，其余都转反问/人工。
 */
const cr = await import("../src/lib/conformalRouter.ts");
const { lexicalEmbedder } = await import("../src/lib/embedder.ts");

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}
function expect(cond: unknown, msg: string): void {
  if (!cond) fail(msg);
}

/* ---------- 1. 覆盖带 ---------- */
const b9 = cr.coverageBand(9, 0.1);
expect(Math.abs(b9.lo - 0.05 ** (1 / 9)) < 1e-6 && Math.abs(b9.hi - 0.95 ** (1 / 9)) < 1e-6, `n=9 覆盖带与闭式解不符：${b9.lo} ${b9.hi}`);
expect(cr.coverageBand(5, 0.1).lo === 1 && cr.coverageBand(5, 0.1).minUseful === 9, "样本不足时应标明集合退化为全部去向");

let seed = 7;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
for (const n of [20, 60, 200]) {
  const band = cr.coverageBand(n, 0.1);
  let inside = 0;
  let sum = 0;
  const trials = 4000;
  for (let t = 0; t < trials; t++) {
    const scores = Array.from({ length: n }, rand);
    const qhat = cr.conformalQuantile(scores, 0.1);
    // 分数服从 U(0,1) 时，单次校准后的真实覆盖率就是 qhat
    sum += qhat;
    if (qhat >= band.lo && qhat <= band.hi) inside += 1;
  }
  const frac = inside / trials;
  expect(frac > 0.87 && frac < 0.93, `n=${n} 模拟落在 90% 覆盖带内的比例 ${frac.toFixed(3)}，带算错了`);
  expect(sum / trials >= 0.9 - 0.005, `n=${n} 平均覆盖率 ${(sum / trials).toFixed(3)} < 90%`);
  console.log(`PASS  n=${n}：覆盖带 [${(band.lo * 100).toFixed(1)}%, ${(band.hi * 100).toFixed(1)}%]，模拟 4000 次落带内 ${(frac * 100).toFixed(1)}%，平均覆盖 ${((sum / trials) * 100).toFixed(1)}%`);
}

/* ---------- 2. 真实路由器 ---------- */
const { currentSkillCatalog } = await import("../server/skills.ts");
const { isCustomerSkill } = await import("../src/lib/agentSkills.ts");
const catalog = currentSkillCatalog().filter((s) => s.runnable && isCustomerSkill(s.id));
const router = await cr.ConformalRouter.build(lexicalEmbedder, catalog);
for (const id of ["ledger-desk", "ticket-desk", "shift-desk"]) {
  expect(router.classes.some((c) => c.id === id), `路由器里没有 ${id}`);
}
const alpha = 0.1;
const stats = router.stats(alpha);
const band = cr.coverageBand(Math.floor(stats.n / 2), alpha);
expect(stats.n >= 30, `校准句太少：${stats.n}`);
expect(stats.coverage >= 1 - alpha - 0.02, `实测覆盖率 ${(stats.coverage * 100).toFixed(1)}% 低于 ${(1 - alpha) * 100}%`);
const classes = router.classCoverage(alpha);
const thin = classes.filter((c) => !c.enough);
console.log(
  `PASS  路由器（字符模型）：${stats.n} 句校准，反复对半切分实测覆盖 ${(stats.coverage * 100).toFixed(1)}%（承诺 ≥ 90%；半数 ${band.n} 句时单次校准的 90% 带 [${(band.lo * 100).toFixed(1)}%, ${(band.hi * 100).toFixed(1)}%]），直接执行 ${(stats.singletonRate * 100).toFixed(0)}% 其中做对 ${(stats.singletonAccuracy * 100).toFixed(0)}%`,
);
console.log(`      按去向：${classes.length} 类，${thin.length} 类校准句少于 ${cr.coverageBand(1, alpha).minUseful} 句、单独看没有保证${thin.length ? `（${thin.map((c) => `${c.label} ${c.n} 句`).join("、")}）` : ""}`);

/* ---------- 3. 留出集 ---------- */
const { loadGateCases } = await import("../server/skillGate.ts");
const gate = cr.gateQuestionCases(router.classes.filter((c) => !c.id.startsWith("@")).flatMap((c) => loadGateCases(c.id)));
const held = await router.heldOut(gate, alpha);
expect(held.n >= 1, "发版必问句一句都没有");
const enoughHeld = held.n >= cr.coverageBand(1, alpha).minUseful;
console.log(
  `PASS  发版必问句当留出集：${held.n} 句，命中 ${(held.coverage * 100).toFixed(0)}%，${(held.asked * 100).toFixed(0)}% 会先反问${enoughHeld ? "" : `；不足 ${cr.coverageBand(1, alpha).minUseful} 句，这个数字不作结论`}`,
);

/* ---------- 4. 决策规则 ---------- */
const { ROUTE_CALIBRATION } = await import("../src/data/routeCalibration.ts");
let checked = 0;
for (const c of [...gate, ...ROUTE_CALIBRATION]) {
  const v = await router.decide(c.q, alpha);
  checked += 1;
  if (v.status === "confident") expect(v.set.length === 1 && v.inScopeP >= 0.05, "直接执行的句子预测集不止一个或像离群");
  else expect(v.set.length !== 1 || v.inScopeP < 0.05, "预测集只有一个且不离群却没有直接执行");
}
console.log(`PASS  决策规则：${checked} 句里，只有预测集恰好一个且不离群才直接执行，其余转反问`);

console.log("PASS  test-conformal");
process.exit(0);
