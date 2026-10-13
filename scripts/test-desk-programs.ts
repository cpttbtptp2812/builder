/**
 * 工单分派、门店排班：用材料跑当前版与随附历史版，结论与每一步数字按手算核对；
 * 缺步骤、缺材料、无人在岗时要停在对的地方。
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(os.tmpdir(), `ownagent-desks-${randomUUID()}.sqlite`);

const { saveServerDataset } = await import("../server/productRun.ts");
const { runInlineSkill } = await import("../server/skillTryRun.ts");
const { summarizeTryRun, compareTryRuns } = await import("../src/lib/skillTryRun.ts");
const { shippedVersionsFromFiles } = await import("../src/lib/shippedSkillVersions.ts");
const { parseSkillMarkdown } = await import("../src/lib/skillMarkdown.ts");

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}
function expect(cond: unknown, msg: string): void {
  if (!cond) fail(msg);
}

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

type Summary = ReturnType<typeof summarizeTryRun>;

async function run(skillId: string, raw: string, sessionId: string, query: string): Promise<Summary> {
  const out = await runInlineSkill({ skillId, raw, query, sessionId, productWorkbench: true });
  if (!out.ok) fail(`${skillId} 跑不起来：${out.error}`);
  return summarizeTryRun(out.result as Parameters<typeof summarizeTryRun>[0]);
}

function step(s: Summary, id: string): string {
  const hit = s.steps.find((x) => x.stepId === id);
  if (!hit) fail(`没有「${id}」这一步；实际：${s.steps.map((x) => x.stepId).join(",")}`);
  return hit.detail;
}

/* ---------------- 随附版本 ---------------- */

const shipped = shippedVersionsFromFiles({
  "../skills/ticket-desk/versions/0.09.md": read("src/skills/ticket-desk/versions/0.09.md"),
  "../skills/shift-desk/versions/0.09.md": read("src/skills/shift-desk/versions/0.09.md"),
  "../skills/shift-desk/SKILL.md": "x",
});
expect(shipped.length === 2 && shipped.every((v) => v.version === "0.09"), `随附版本识别不对：${JSON.stringify(shipped.map((v) => [v.skillId, v.version]))}`);
for (const id of ["ticket-desk", "shift-desk"]) {
  const lines = read(`src/skills/${id}/SKILL.md`).split(/\r?\n/).length;
  expect(lines >= 600, `${id} 的 SKILL 只有 ${lines} 行`);
  const cur = parseSkillMarkdown(read(`src/skills/${id}/SKILL.md`));
  const old = parseSkillMarkdown(read(`src/skills/${id}/versions/0.09.md`));
  expect(cur.steps.length >= 18 && old.steps.length >= 14, `${id} 步骤解析不全：${cur.steps.length} / ${old.steps.length}`);
  console.log(`PASS  ${id}：SKILL ${lines} 行，当前版 ${cur.steps.length} 步，0.09 ${old.steps.length} 步`);
}

/* ---------------- 工单分派 ---------------- */

const TICKET_Q = "把这批工单分派一下，看看时效";
const ticketNow = read("src/skills/ticket-desk/SKILL.md");
const ticketOld = read("src/skills/ticket-desk/versions/0.09.md");

const ticketCols = ["工单编号", "用户账号", "提交时间", "首次回复时间", "关闭时间", "来源", "会员等级", "主题", "问题描述", "状态"];
const ticketRows = [
  ["T1", "客户A", "2026-10-12 09:00", "2026-10-12 09:10", "2026-10-12 10:00", "在线", "普通", "退款还没到账", "上周申请的退款还没到账", "已解决"],
  ["T2", "客户B", "2026-10-12 10:00", "2026-10-12 11:30", "", "电话", "VIP", "账号被盗了", "有人异地登录把余额转走了", "处理中"],
  ["T3", "客户C", "2026-10-12 20:30", "", "", "在线", "普通", "发票抬头开错了", "需要重开发票", "待处理"],
  ["T4", "客户C", "2026-10-13 09:30", "", "", "在线", "普通", "发票抬头开错", "还是没重开", "待处理"],
  ["T5", "客户D", "2026-10-12 15:00", "2026-10-12 15:20", "", "在线", "普通", "APP 闪退打不开", "更新后一打开就闪退", "处理中"],
  ["T6", "客户E", "2026-10-13 08:00", "", "", "在线", "普通", "快递一直没收到", "下单五天了没收到快递", "待处理"],
  ["T7", "客户F", "2026-10-13 10:00", "2026-10-13 10:05", "2026-10-13 12:00", "在线", "普通", "如何修改头像", "请问在哪里改", "已解决"],
];
const agentCols = ["坐席", "技能组", "在岗", "当前待办", "上限"];
const agentRows = [
  ["坐席01", "账号组|技术组", "在岗", "2", "4"],
  ["坐席02", "账号组", "在岗", "0", "4"],
  ["坐席03", "账务组|综合组", "在岗", "1", "5"],
  ["坐席04", "物流组", "否", "0", "5"],
  ["坐席05", "技术组", "是", "4", "4"],
];

const tSid = `desk-ticket-${randomUUID()}`;
saveServerDataset(tSid, { slot: "service-tickets", title: "十月工单导出.csv", columns: ticketCols, rows: ticketRows });
saveServerDataset(tSid, { slot: "service-agents", title: "坐席排班.csv", columns: agentCols, rows: agentRows });

const t10 = await run("ticket-desk", ticketNow, tSid, TICKET_Q);
expect(t10.ok, `工单当前版停在 ${t10.failedStep?.stepId}：${t10.failedStep?.detail}`);
expect(step(t10, "intake").includes("十月工单导出.csv") && step(t10, "intake").includes("7"), `读入应带材料名和 7 张：${step(t10, "intake")}`);
expect(/1 张工单并入 1 张主单/.test(step(t10, "dedupe")), `T4 应并入 T3：${step(t10, "dedupe")}`);
const assignDetail = step(t10, "assign");
expect(/4/.test(assignDetail), `应派出 4 张：${assignDetail}`);
const expectedT10 =
  "共 7 张工单，未结 4 张，合并重复 1 张，已分派 4 张，超时未结 1 张、临期 1 张，升级 1 张，首响达标率 75.0%，解决达标率 66.7%";
expect(t10.conclusion.includes(expectedT10), `工单结论不对：\n  期望含：${expectedT10}\n  实际：${t10.conclusion}`);
expect(t10.conclusion.includes("十月工单导出.csv"), `结论应写材料名：${t10.conclusion}`);
console.log(`PASS  工单当前版：${t10.conclusion.split("\n")[0]}`);

const t09 = await run("ticket-desk", ticketOld, tSid, TICKET_Q);
expect(t09.ok, `工单 0.09 停在 ${t09.failedStep?.stepId}：${t09.failedStep?.detail}`);
expect(!t09.steps.some((x) => x.stepId === "dedupe"), "0.09 不该有合并重复");
expect(t09.conclusion.includes("未结 5 张") && t09.conclusion.includes("派不出去 1 张") && !t09.conclusion.includes("合并重复"), `0.09 不合并、不转兜底组：${t09.conclusion}`);
expect(t09.conclusion !== t10.conclusion, "两版结论应不同");
const tCmp = compareTryRuns(t10, t09);
expect(tCmp.changedCount > 0, "两版对比应有不同的步骤");
console.log(`PASS  工单 0.09：${t09.conclusion.split("\n")[0]}`);
console.log(`PASS  工单两版对比：${tCmp.changedCount} 步不同（${tCmp.rows.filter((r) => r.changed).map((r) => r.stepId).join("、")}）`);

const tNoAgentSid = `desk-ticket-off-${randomUUID()}`;
saveServerDataset(tNoAgentSid, { slot: "service-tickets", title: "工单.csv", columns: ticketCols, rows: ticketRows });
saveServerDataset(tNoAgentSid, {
  slot: "service-agents",
  title: "坐席.csv",
  columns: agentCols,
  rows: agentRows.map((r) => [r[0]!, r[1]!, "否", r[3]!, r[4]!]),
});
const tOff = await run("ticket-desk", ticketNow, tNoAgentSid, TICKET_Q);
expect(!tOff.ok && tOff.failedStep?.stepId === "agents", `没人在岗应停在读入坐席：${tOff.failedStep?.stepId} ${tOff.conclusion}`);
console.log(`PASS  工单无人在岗：停在「读入坐席」— ${tOff.failedStep?.detail.slice(0, 50)}`);

const tEmpty = await run("ticket-desk", ticketNow, `desk-ticket-empty-${randomUUID()}`, TICKET_Q);
expect(!tEmpty.ok && tEmpty.failedStep?.stepId === "intake", `没材料应停在读入工单：${tEmpty.failedStep?.stepId}`);
expect(!/客户[A-F]|T\d|service-tickets/.test(tEmpty.conclusion), `没材料时不该出现数据或内部编号：${tEmpty.conclusion}`);
console.log(`PASS  工单无材料：${tEmpty.conclusion.slice(0, 60)}`);

const tSkip = ticketNow.replace(/  - id: classify[\s\S]*?(?=  - id: priority)/, "");
expect(tSkip !== ticketNow, "删分类步骤没删掉");
const tSkipRun = await run("ticket-desk", tSkip, tSid, TICKET_Q);
expect(!tSkipRun.ok && tSkipRun.failedStep?.stepId === "priority", `删掉分类后应停在定优先级：${tSkipRun.failedStep?.stepId}`);
expect(/问题分类/.test(tSkipRun.failedStep?.detail ?? ""), `应提示先完成问题分类：${tSkipRun.failedStep?.detail}`);
console.log(`PASS  工单删步骤：${tSkipRun.failedStep?.detail.slice(0, 50)}`);

/* ---------------- 门店排班 ---------------- */

const SHIFT_Q = "按员工表和班次需求排一下班";
const shiftNow = read("src/skills/shift-desk/SKILL.md");
const shiftOld = read("src/skills/shift-desk/versions/0.09.md");

const staffCols = ["姓名", "岗位", "类型", "时薪"];
const staffRows = [
  ["员工A", "收银|值班长", "全职", "30"],
  ["员工B", "收银", "全职", "25"],
  ["员工C", "收银|理货", "全职", "20"],
  ["员工D", "理货", "兼职", "18"],
];
const demandCols = ["日期", "班次", "开始", "结束", "岗位", "人数"];
const demandRows = [
  ["2026-10-19", "晚班", "14:00", "22:00", "收银", "1"],
  ["2026-10-20", "早班", "06:00", "14:00", "收银", "1"],
  ["2026-10-20", "晚班", "14:00", "22:00", "收银", "1"],
  ["2026-10-23", "早班", "07:00", "15:00", "收银", "2"],
  ["2026-10-23", "早班", "07:00", "15:00", "理货", "1"],
];

const sSid = `desk-shift-${randomUUID()}`;
saveServerDataset(sSid, { slot: "staff-roster", title: "店员名单.csv", columns: staffCols, rows: staffRows });
saveServerDataset(sSid, { slot: "shift-demand", title: "下周班次.csv", columns: demandCols, rows: demandRows });

const s10 = await run("shift-desk", shiftNow, sSid, SHIFT_Q);
expect(s10.ok, `排班当前版停在 ${s10.failedStep?.stepId}：${s10.failedStep?.detail}`);
expect(step(s10, "staff").includes("店员名单.csv"), `读入员工应带材料名：${step(s10, "staff")}`);
expect(/1/.test(step(s10, "repair")), `应调换 1 次补上缺口：${step(s10, "repair")}`);
expect(s10.conclusion.includes("共需 6 人次，排上 6 人次（覆盖率 100.0%），其中调换补上 1 个"), `当前版应 6 人次全部排满且调换 1 次：${s10.conclusion}`);
expect(s10.conclusion.includes("1,125.00"), `当前版成本应为 1,125.00：${s10.conclusion}`);
expect(/开.?闭店|开店|闭店/.test(step(s10, "keyholder")), `10-20 应提示开闭店没人带钥匙：${step(s10, "keyholder")}`);
expect(/32/.test(step(s10, "fairness")) || /保底|低于/.test(step(s10, "fairness")), `应提示全职低于保底工时：${step(s10, "fairness")}`);
console.log(`PASS  排班当前版：${s10.conclusion.split("\n")[0]}`);

const s09 = await run("shift-desk", shiftOld, sSid, SHIFT_Q);
expect(s09.ok, `排班 0.09 停在 ${s09.failedStep?.stepId}：${s09.failedStep?.detail}`);
expect(s09.conclusion.includes("825.00"), `0.09 成本应为 825.00：${s09.conclusion}`);
expect(s09.conclusion.includes("排上 5 人次（覆盖率 83.3%）") && s09.conclusion.includes("缺 1 人次"), `0.09 应缺 1 人次：${s09.conclusion}`);
expect(!s09.steps.some((x) => x.stepId === "repair"), "0.09 不该有调换补缺");
const gapDetail = step(s09, "gaps");
expect(gapDetail.includes("时段冲突") && gapDetail.includes("每日工时上限"), `0.09 缺口原因应是时段冲突与每日上限：${gapDetail}`);
const sCmp = compareTryRuns(s10, s09);
expect(sCmp.changedCount > 0, "排班两版对比应有不同");
console.log(`PASS  排班 0.09：${s09.conclusion.split("\n")[0]}`);
console.log(`PASS  排班两版对比：${sCmp.changedCount} 步不同（${sCmp.rows.filter((r) => r.changed).map((r) => r.stepId).join("、")}）`);

const sEmpty = await run("shift-desk", shiftNow, `desk-shift-empty-${randomUUID()}`, SHIFT_Q);
expect(!sEmpty.ok && sEmpty.failedStep?.stepId === "staff", `没材料应停在读入员工：${sEmpty.failedStep?.stepId}`);
expect(!/员工[A-D]|staff-roster|shift-demand/.test(sEmpty.conclusion), `没材料时不该出现数据或内部编号：${sEmpty.conclusion}`);
console.log(`PASS  排班无材料：${sEmpty.conclusion.slice(0, 60)}`);

const sSkip = shiftNow.replace(/  - id: eligibility[\s\S]*?(?=  - id: assign)/, "");
expect(sSkip !== shiftNow, "删筛人选步骤没删掉");
const sSkipRun = await run("shift-desk", sSkip, sSid, SHIFT_Q);
expect(!sSkipRun.ok && sSkipRun.failedStep?.stepId === "assign", `删掉筛人选后应停在初排：${sSkipRun.failedStep?.stepId}`);
console.log(`PASS  排班删步骤：${sSkipRun.failedStep?.detail.slice(0, 50)}`);

console.log("\ndesk programs OK");
