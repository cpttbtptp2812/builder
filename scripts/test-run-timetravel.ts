/**
 * 时间旅行运行台（材料走客户导入路径，引擎是现用技能）：
 * 1) 报销台账跑一次：事件 seq 连续无缺口，节点数 = 技能步数，每步耗时、检查点齐全；任意 seq 可归约出当时状态；
 * 2) 在「对账」把容差 0 → 100 分叉：分叉之后每一步的结果与“直接用这个参数整单重跑”逐字节一致，原运行不动；
 * 3) 排班（有状态引擎，状态里有 Map/Set）在「调换补缺」改参数分叉：同样与直接重跑一致 —— 检查点编码没丢结构；
 * 4) 子进程跑到第 3 步完成的事务中途被杀（exit 137）：恢复后接着跑完，seq 连续、无重复，结果与不中断的运行一致；
 * 5) 分叉不能改内部参数（__sessionId 之类）。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { newLabSession, saveLabDataset } = await import("../server/labSession.ts");
const { deleteServerDataset } = await import("../server/productDataStore.ts");
const store = await import("../server/runEventStore.ts");
const { getSkill, runSkillManifestOnServer } = await import("../server/skills.ts");
const { db, dbGet, dbRun } = await import("../server/db.ts");
const { reduceRun } = await import("../src/lib/runReducer.ts");
import type { AgentSkill } from "../src/lib/agentSkills.ts";

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}
function expect(cond: unknown, msg: string): void {
  if (!cond) fail(msg);
}

const LEDGER = [
  "部门,报销人,报销金额,税额,发票金额",
  "销售部,张伟,3200,0,3200",
  "市场部,李娜,4580.5,0,4578",
  "研发部,王强,12000,0,11990",
  "行政部,赵敏,860,0,860",
  "销售部,陈晨,6400,384,6400",
  "研发部,刘洋,9150,0,9150",
  "市场部,周婷,2280,0,2205",
  "财务部,吴磊,540,0,540",
  "研发部,郑浩,5020,0,5000.4",
  "销售部,孙悦,7990,0,7990",
].join("\n");

const STAFF = [
  "员工,岗位技能,用工类型,周工时上限,可上班星期,最早,最晚,时薪,不可用日期",
  "王芳,收银|值班长,全职,40,周一至周日,07:00,22:00,28,",
  "李强,理货|值班长,全职,40,周一至周六,07:00,22:00,26,",
  "赵敏,收银|咖啡,兼职,24,周三至周日,09:00,21:00,22,",
  "陈晨,咖啡|理货,兼职,20,周一至周五,07:00,15:00,23,2026-10-21",
  "刘洋,收银|理货,全职,40,周二至周日,07:00,22:00,25,",
].join("\n");
const DEMAND = [
  "日期,班次,开始,结束,岗位,人数",
  "2026-10-19,早班,07:00,15:00,值班长,1",
  "2026-10-19,晚班,14:00,22:00,收银,1",
  "2026-10-20,早班,07:00,15:00,理货,1",
  "2026-10-21,早班,07:00,15:00,咖啡,1",
  "2026-10-22,晚班,14:00,22:00,值班长,1",
  "2026-10-23,早班,07:00,15:00,收银,2",
  "2026-10-24,中班,11:00,19:00,咖啡,1",
  "2026-10-25,早班,07:00,15:00,值班长,1",
].join("\n");

/* ---------- 子进程：跑到一半被杀 ---------- */
if (process.argv[2] === "--crash-child") {
  const sessionId = process.argv[3]!;
  // 只在本连接上挂临时触发器：第 3 个完成事件写进事务、还没提交时直接退出进程
  db.function("crash_now", () => process.exit(137));
  db.exec(`CREATE TEMP TRIGGER crash_mid AFTER INSERT ON run_events
           WHEN NEW.type = 'node.completed' AND (SELECT COUNT(*) FROM run_events WHERE run_id = NEW.run_id AND type = 'node.completed') >= 3
           BEGIN SELECT crash_now(); END;`);
  const r = store.startConsoleRun(sessionId, "ledger-desk", "核对九月差旅报销");
  if ("error" in r) {
    console.error(r.error);
    process.exit(2);
  }
  console.log(`RUN ${r.runId}`);
  await r.done;
  process.exit(3);
}

const sessions: string[] = [];
const lab = (csvs: { csv: string; title: string; slot: string }[]) => {
  const sid = newLabSession();
  sessions.push(sid);
  for (const m of csvs) {
    const s = saveLabDataset(sid, m);
    expect(s.ok, `导入失败：${"error" in s ? s.error : ""}`);
  }
  return sid;
};

function contiguous(runId: string) {
  const ev = store.listEvents(runId);
  ev.forEach((e, i) => expect(e.seq === i + 1, `${runId} seq 不连续：第 ${i + 1} 个事件 seq=${e.seq}`));
  const nodeIds = ev.filter((e) => e.nodeId).map((e) => `${e.type}|${e.nodeId}`);
  expect(new Set(nodeIds).size === nodeIds.length, `${runId} 有重复节点事件`);
  return ev;
}

const canon = (v: unknown) => JSON.stringify(v);

/** 直接重跑：同一份材料、同样从 index 起改参数，跑完整单 */
async function directRerun(skillId: string, sessionId: string, index: number, changes: Record<string, unknown>) {
  const base = getSkill(skillId)!;
  const skill: AgentSkill = {
    ...base,
    steps: base.steps.map((s, j) => {
      const args = s.args as Record<string, unknown>;
      if (j < index) return s;
      const own = j === index ? changes : Object.fromEntries(Object.entries(changes).filter(([k]) => k in args));
      return { ...s, args: { ...args, ...own } };
    }),
  };
  return (await runSkillManifestOnServer(skill, "核对九月差旅报销", sessionId, { productWorkbench: true })).trace;
}

try {
  /* ---------- 1. 报销台账：完整记录 ---------- */
  const ledgerSession = lab([{ csv: LEDGER, title: "九月差旅报销台账.csv", slot: "expense-ledger" }]);
  const started = store.startConsoleRun(ledgerSession, "ledger-desk", "核对九月差旅报销");
  if ("error" in started) fail(started.error);
  await started.done;
  const ev = contiguous(started.runId);
  const view = reduceRun(ev);
  const steps = getSkill("ledger-desk")!.steps;
  expect(view.nodes.length === steps.length, `节点数 ${view.nodes.length} ≠ 技能步数 ${steps.length}`);
  expect(view.status === "completed", `运行状态 ${view.status}：${view.error}`);
  const core = view.nodes.filter((n) => n.tool !== "__llm_product_brief__");
  expect(core.every((n) => n.status === "completed" && (n.ms ?? 0) >= 1 && n.checkpoint), "有步骤没完成或缺耗时/检查点");
  expect(view.materials.length === 1 && view.materials[0]!.rows === 10 && /^[0-9a-f]{64}$/.test(view.materials[0]!.sha256), "材料快照不对");
  const recIdx = view.nodes.findIndex((n) => n.stepId === "recon");
  const mid = reduceRun(ev, view.nodes[recIdx]!.endedSeq!);
  expect(mid.nodes[recIdx]!.status === "completed" && mid.nodes[recIdx + 1]!.status === "pending" && mid.status === "running", "拖回「对账」那一刻的状态不对");
  console.log(`PASS  报销台账：${ev.length} 个事件 seq 连续，${view.nodes.length} 步全记录（核心 ${core.length} 步都有检查点），材料哈希 ${view.materials[0]!.sha256.slice(0, 12)}…；拖回「对账」= seq ${mid.seq}`);

  /* ---------- 2. 对账容差分叉 ---------- */
  const fork = store.forkRun(started.runId, "recon", { tolerance: 100 });
  if ("error" in fork) fail(fork.error);
  sessions.push(fork.sessionId);
  await fork.done;
  const fev = contiguous(fork.runId);
  const fview = reduceRun(fev);
  expect(fview.status === "completed", `分叉运行状态 ${fview.status}：${fview.error}`);
  expect(fview.nodes.slice(0, recIdx).every((n) => n.inherited), "分叉点之前的步骤应原样继承");
  expect(canon(fview.nodes[recIdx]!.args?.tolerance) === "100", "分叉步骤没用新容差");
  const direct = await directRerun("ledger-desk", fork.sessionId, recIdx, { tolerance: 100 });
  for (const n of fview.nodes.slice(recIdx)) {
    if (n.tool === "__llm_product_brief__") continue;
    const d = direct.find((t) => t.stepId === n.stepId);
    expect(d && canon(d.result) === canon(n.result), `分叉步骤「${n.label}」结果与直接重跑不一致`);
  }
  const before = String((view.nodes[recIdx]!.result as { detail?: string }).detail);
  const after = String((fview.nodes[recIdx]!.result as { detail?: string }).detail);
  expect(before !== after, "容差 0→100 对账结果没变，分叉没起作用");
  const parentAgain = reduceRun(store.listEvents(started.runId));
  expect(parentAgain.branches.some((b) => b.childRunId === fork.runId), "原运行没记下分叉");
  expect(canon(parentAgain.nodes.map((n) => n.result)) === canon(view.nodes.map((n) => n.result)), "分叉改动了原运行");
  console.log(`PASS  在「对账」把容差 0→100 分叉：后续 ${fview.nodes.length - recIdx} 步与直接整单重跑逐字节一致；对账从「${before.slice(0, 40)}…」变成「${after.slice(0, 40)}…」，原运行不变`);

  /* ---------- 3. 有状态引擎：排班分叉 ---------- */
  const shiftSession = lab([
    { csv: STAFF, title: "十月第四周员工表.csv", slot: "staff-roster" },
    { csv: DEMAND, title: "十月第四周班次需求.csv", slot: "shift-demand" },
  ]);
  const sRun = store.startConsoleRun(shiftSession, "shift-desk", "排十月第四周的班");
  if ("error" in sRun) fail(sRun.error);
  await sRun.done;
  const sview = reduceRun(contiguous(sRun.runId));
  expect(sview.status === "completed", `排班运行 ${sview.status}：${sview.error}`);
  const assignIdx = sview.nodes.findIndex((n) => n.stepId === "assign");
  expect(sview.nodes.slice(0, assignIdx).every((n) => n.checkpoint), "排班前几步缺检查点");
  const sFork = store.forkRun(sRun.runId, "assign", { tieBreak: "cost" });
  if ("error" in sFork) fail(sFork.error);
  sessions.push(sFork.sessionId);
  await sFork.done;
  const sfview = reduceRun(contiguous(sFork.runId));
  expect(sfview.status === "completed", `排班分叉 ${sfview.status}：${sfview.error}`);
  const sDirect = await directRerun("shift-desk", sFork.sessionId, assignIdx, { tieBreak: "cost" });
  for (const n of sfview.nodes.slice(assignIdx)) {
    if (n.tool === "__llm_product_brief__") continue;
    const d = sDirect.find((t) => t.stepId === n.stepId);
    expect(d && canon(d.result) === canon(n.result), `排班分叉「${n.label}」与直接重跑不一致 —— 检查点还原出的引擎状态有偏差`);
  }
  console.log(`PASS  排班（状态含 Map/Set）在「初排」改 tieBreak=cost 分叉：后续 ${sfview.nodes.length - assignIdx} 步与直接重跑一致`);

  /* ---------- 4. 跑到一半杀进程 → 恢复 ---------- */
  const crashSession = lab([{ csv: LEDGER, title: "九月差旅报销台账.csv", slot: "expense-ledger" }]);
  const self = fileURLToPath(import.meta.url);
  const tsx = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const child = spawnSync(process.execPath, [tsx, self, "--crash-child", crashSession], { encoding: "utf8", env: process.env });
  expect(child.status === 137, `子进程应在中途被杀（137），实际 ${child.status}：${child.stderr}`);
  const crashedId = child.stdout.match(/RUN ([0-9a-f-]{36})/)?.[1];
  expect(crashedId, "子进程没报 runId");
  const crashedView = reduceRun(store.listEvents(crashedId!));
  const doneBefore = crashedView.nodes.filter((n) => n.status === "completed").length;
  expect(doneBefore === 2 && crashedView.status === "running", `杀进程时第 3 个完成事件应随事务回滚：完成 ${doneBefore} 步，状态 ${crashedView.status}`);
  expect(dbGet<{ status: string }>("SELECT status FROM agent_runs WHERE run_id=?", [crashedId])?.status === "running", "被杀的运行应仍是 running");
  const resumed = store.resumeRun(crashedId!);
  if ("error" in resumed) fail(resumed.error);
  expect(resumed.fromIndex === 2, `应从第 3 步恢复，实际从第 ${resumed.fromIndex + 1} 步`);
  await resumed.done;
  const rev = contiguous(crashedId!);
  const rview = reduceRun(rev);
  expect(rview.status === "completed" && rview.resumes.length === 1, `恢复后应跑完：${rview.status}`);
  expect(rview.nodes[2]!.attempt === 2, `第 3 步应是第 2 次尝试，实际 ${rview.nodes[2]!.attempt}`);
  for (const n of rview.nodes) {
    if (n.tool === "__llm_product_brief__") continue;
    expect(canon(n.result) === canon(view.nodes[n.index]!.result), `恢复后「${n.label}」与不中断的运行不一致`);
  }
  console.log(`PASS  子进程在第 3 步写完成事件的事务里被杀（exit 137）：恢复从第 3 步起（第 2 次尝试），${rev.length} 个事件 seq 连续无重复，结果与不中断运行一致`);

  /* ---------- 5. 不能借分叉注入内部参数 ---------- */
  const bad = store.forkRun(started.runId, "recon", { __sessionId: "lab:00000000-0000-0000-0000-000000000000" });
  expect("error" in bad, "分叉接受了 __sessionId");
  const bad2 = store.forkRun(started.runId, "recon", { notAnArg: 1 });
  expect("error" in bad2, "分叉接受了未声明的参数");
  console.log("PASS  分叉只接受该步已声明的标量参数");
} finally {
  for (const sid of sessions) {
    for (const slot of ["expense-ledger", "staff-roster", "shift-demand"] as const) deleteServerDataset(sid, slot);
    const ids = (db.prepare("SELECT run_id FROM agent_runs WHERE session_id=?").all(sid) as { run_id: string }[]).map((r) => r.run_id);
    for (const id of ids) {
      dbRun("DELETE FROM run_events WHERE run_id=?", [id]);
      dbRun("DELETE FROM agent_runs WHERE run_id=?", [id]);
    }
  }
}

console.log("PASS  test-run-timetravel");
process.exit(0);
