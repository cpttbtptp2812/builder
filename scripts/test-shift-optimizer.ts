/**
 * HiGHS 最优排班（材料全部走客户导入路径，规则来自现用 shift-desk）：
 * 1) 一批按种子生成的门店材料：最优解空缺 ≤ 引擎贪心空缺，且至少有一份严格更少；
 * 2) 最优解交回引擎后「复核规则」0 违规（引擎没放行就不算解）；
 * 3) 排不满的材料：HiGHS 给出代价最小的放宽方案并证明最优；照方案改材料后重排，真的排满；
 * 4) 同时在岗需求超过总人数：明确判定放宽也排不满。
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const { newLabSession, saveLabDataset } = await import("../server/labSession.ts");
const { deleteServerDataset } = await import("../server/productDataStore.ts");
const { optimizeShifts } = await import("../server/shiftOptimizer.ts");

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}
function expect(cond: unknown, msg: string): void {
  if (!cond) fail(msg);
}

const raw = readFileSync(path.join(process.cwd(), "src/skills/shift-desk/SKILL.md"), "utf8");
const sessions: string[] = [];

async function run(staffCsv: string, demandCsv: string, title: string) {
  const sid = newLabSession();
  sessions.push(sid);
  const a = saveLabDataset(sid, { csv: staffCsv, title: `${title}-员工表.csv`, slot: "staff-roster" });
  expect(a.ok, `员工表导入失败：${"error" in a ? a.error : ""}`);
  const b = saveLabDataset(sid, { csv: demandCsv, title: `${title}-班次需求.csv`, slot: "shift-demand" });
  expect(b.ok, `班次需求导入失败：${"error" in b ? b.error : ""}`);
  return optimizeShifts(sid, raw);
}

let seed = 20261019;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;

const DATES = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
const SHIFTS = [
  ["早班", "07:00", "15:00"],
  ["中班", "11:00", "19:00"],
  ["晚班", "14:00", "22:00"],
] as const;

function randomStore(n: number) {
  const roles = ["收银", "理货", "咖啡"];
  const staff = ["员工,岗位技能,用工类型,周工时上限,可上班星期,最早,最晚,时薪,不可用日期"];
  for (let i = 1; i <= n; i += 1) {
    const skills = [...new Set([pick(roles), pick(roles), ...(i <= 2 ? ["值班长"] : rand() < 0.2 ? ["值班长"] : [])])];
    const full = rand() < 0.6;
    const days = pick(["周一至周五", "周一至周日", "周三至周日", "周六|周日|周一", "周二至周六"]);
    const leave = rand() < 0.3 ? pick(DATES) : "";
    staff.push(`店员${String(i).padStart(2, "0")},${skills.join("|")},${full ? "全职" : "兼职"},,${days},07:00,22:00,${pick([22, 24, 26, 28])},${leave}`);
  }
  const demand = ["日期,班次,开始,结束,岗位,人数"];
  for (const date of DATES) {
    demand.push(`${date},早班,07:00,15:00,值班长,1`);
    demand.push(`${date},晚班,14:00,22:00,值班长,1`);
    for (const role of roles) {
      const [shift, s, e] = pick(SHIFTS);
      demand.push(`${date},${shift},${s},${e},${role},${pick([1, 1, 2])}`);
    }
  }
  return { staff: staff.join("\n"), demand: demand.join("\n") };
}

try {
  /* ---------- 1/2. 随机门店：最优 vs 贪心 ---------- */
  let strict = 0;
  let totalGreedy = 0;
  let totalOpt = 0;
  let keyBetter = 0;
  for (let k = 0; k < 12; k += 1) {
    const store = randomStore(7 + (k % 4));
    const rep = await run(store.staff, store.demand, `门店${k + 1}`);
    expect(rep.ok, `门店${k + 1} 求解失败：${rep.error}`);
    expect(rep.stages[0]?.proved, `门店${k + 1} 空缺最少这一阶段没证明最优：${rep.stages[0]?.status}`);
    const g = rep.greedy!;
    const o = rep.optimal!;
    expect(o.violations === 0, `门店${k + 1} 最优解被引擎复核出 ${o.violations} 处违规`);
    expect(o.stoppedAt === null || o.stoppedAt !== "verify", `门店${k + 1} 最优解在复核步停下`);
    expect(o.unfilled <= g.unfilled, `门店${k + 1} 最优空缺 ${o.unfilled} 多于贪心 ${g.unfilled}`);
    if (o.unfilled === g.unfilled) expect(o.keyholderMisses <= g.keyholderMisses, `门店${k + 1} 空缺相同但开闭店缺钥匙人更多`);
    if (o.unfilled < g.unfilled) strict += 1;
    if (o.unfilled === g.unfilled && o.keyholderMisses < g.keyholderMisses) keyBetter += 1;
    totalGreedy += g.unfilled;
    totalOpt += o.unfilled;
    expect(/^min$/m.test(rep.lp) && /^st$/m.test(rep.lp) && /^bin$/m.test(rep.lp), "缺可审阅的 LP 模型文本");
  }
  expect(strict > 0, "12 份材料里最优解没有一次比贪心少空缺，测试材料不够刁钻或模型有问题");
  console.log(`PASS  12 份门店材料：贪心共空 ${totalGreedy} 人次，HiGHS 最优共空 ${totalOpt} 人次；${strict} 份严格更少、${keyBetter} 份开闭店更完整；最优解全部通过引擎复核`);

  /* ---------- 3. 排不满 → 最省放宽 → 照改 → 排满 ---------- */
  const staffA = [
    "员工,岗位技能,用工类型,周工时上限,可上班星期,最早,最晚,时薪,不可用日期",
    "王芳,收银|值班长,全职,40,周一至周五,07:00,22:00,28,",
    "李强,理货|值班长,全职,40,周一至周六,07:00,22:00,26,",
    "赵敏,收银,兼职,,周三至周六,09:00,21:00,22,",
  ];
  const demandA = [
    "日期,班次,开始,结束,岗位,人数",
    "2026-10-19,早班,07:00,15:00,收银,1",
    "2026-10-20,早班,07:00,15:00,收银,1",
    "2026-10-23,晚班,14:00,22:00,理货,1",
    "2026-10-25,早班,07:00,15:00,收银,1",
  ].join("\n");
  const tight = await run(staffA.join("\n"), demandA, "周日缺人");
  expect(tight.ok, `求解失败：${tight.error}`);
  expect(tight.optimal!.unfilled === 1, `应只缺周日 1 人次，实际 ${tight.optimal!.unfilled}`);
  const rx = tight.relax!;
  expect(rx.status === "relaxed" && rx.proved, `放宽方案应已证明最优：${rx.status} ${rx.note}`);
  expect(rx.items.length === 1 && rx.items[0]!.kind === "可上班", `最省放宽应是一条「可上班」：${JSON.stringify(rx.items.map((i) => i.label))}`);
  const who = rx.items[0]!.person;
  expect(rx.items[0]!.enables.some((e) => e.includes("10-25")), `放宽应补上周日的班：${rx.items[0]!.enables.join("；")}`);
  console.log(`PASS  排不满：HiGHS 证明最省放宽 = ${rx.items.map((i) => `${i.label}（代价 ${i.weight}）`).join("、")}，补上 ${rx.items[0]!.enables.join("、")}`);

  const fixedStaff = staffA.map((line) => (line.startsWith(`${who},`) ? line.replace(/,周[^,]+,/, ",周一至周日,") : line)).join("\n");
  const fixed = await run(fixedStaff, demandA, "周日缺人-已调整");
  expect(fixed.ok && fixed.optimal!.unfilled === 0 && fixed.optimal!.violations === 0, `照方案调整后仍没排满：${fixed.optimal?.unfilled}`);
  expect(fixed.relax?.status === "full", "调整后应不再需要放宽");
  console.log(`PASS  照方案把 ${who} 改成周一至周日后重排：空缺 0，引擎复核 0 违规`);

  /* ---------- 4. 人数绝对不够 ---------- */
  const tiny = await run(
    ["员工,岗位技能,用工类型,周工时上限,可上班星期,最早,最晚,时薪,不可用日期", "孙丽,收银|值班长,全职,40,周一至周日,07:00,22:00,25,"].join("\n"),
    ["日期,班次,开始,结束,岗位,人数", "2026-10-19,早班,07:00,15:00,收银,2"].join("\n"),
    "单人门店",
  );
  expect(tiny.ok && tiny.relax?.status === "impossible", `应判定放宽也排不满：${tiny.relax?.status}`);
  console.log(`PASS  同时在岗需求超过总人数：${tiny.relax!.note}`);
} finally {
  for (const sid of sessions) {
    deleteServerDataset(sid, "staff-roster");
    deleteServerDataset(sid, "shift-demand");
  }
}

console.log("PASS  test-shift-optimizer");
process.exit(0);
