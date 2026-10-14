/**
 * 证据包（材料走客户导入路径，运行走运行台真实引擎）：
 * 1) JCS 用 RFC 8785 官方样例校验；RFC 6962 审计路径对每片叶子都成立，换位置就不成立；
 * 2) 报销台账办完 → 签发：结论里每个关键数字都有来源，交付表能重算的全部重算一致；
 * 3) 改交付 CSV 一个字节 → 立刻指出哪个文件不对；改包里一个数字 → Merkle 根与签名都失败；换公钥 → 不受信；
 * 4) 验真过程禁网（fetch 直接抛错）仍能完成。
 */
const { newLabSession, saveLabDataset } = await import("../server/labSession.ts");
const { deleteServerDataset } = await import("../server/productDataStore.ts");
const store = await import("../server/runEventStore.ts");
const { buildEvidenceBundle, publicKeyInfo } = await import("../server/evidence.ts");
const { dbRun, db } = await import("../server/db.ts");
const ev = await import("../src/lib/evidenceBundle.ts");

function fail(msg: string): never {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}
function expect(cond: unknown, msg: string): void {
  if (!cond) fail(msg);
}

/* ---------- 1. 规范化与 Merkle ---------- */
const rfcInput = JSON.parse(
  '{"numbers":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001],"string":"\\u20ac$\\u000F\\u000aA\'\\u0042\\u0022\\u005c\\\\\\"\\/","literals":[null,true,false]}',
);
const rfcExpected = '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}';
expect(ev.jcs(rfcInput) === rfcExpected, `JCS 与 RFC 8785 样例不一致：${ev.jcs(rfcInput)}`);
console.log("PASS  JCS 与 RFC 8785 §3.2.3 样例逐字节一致");

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

const sessionId = newLabSession();
const extraSessions: string[] = [];
const enc = new TextEncoder();
try {
  const saved = saveLabDataset(sessionId, { csv: LEDGER, title: "九月差旅报销台账.csv", slot: "expense-ledger" });
  expect(saved.ok, "导入失败");
  const run = store.startConsoleRun(sessionId, "ledger-desk", "核对九月差旅报销");
  if ("error" in run) fail(run.error);
  await run.done;

  /* ---------- 2. 签发 ---------- */
  const built = await buildEvidenceBundle(run.runId);
  if ("error" in built) fail(built.error);
  const { bundle, files } = built;
  expect(bundle.status === "signed" && bundle.signature, `应已签发，实际 ${bundle.status}；无来源：${bundle.unverifiedClaims.join("、")}`);
  const claims = bundle.leaves.filter((l): l is import("../src/lib/evidenceBundle.ts").EvidenceClaim => l.t === "claim");
  expect(claims.length >= 3, `关键数字太少：${claims.length}`);
  for (const [word, n] of [["出纳", "3"], ["财务复核", "5"], ["部门负责人", "2"], ["拦截", "4"]] as const) {
    const c = claims.find((x) => x.value === n && x.context.includes(word));
    expect(c, `结论里「${word}${n}」没有对应证据`);
    const where = "where" in c!.source ? c!.source.where : undefined;
    expect((where?.equals ?? where?.prefix) === word, `「${word}${n}」的来源指到了 ${JSON.stringify(c!.source)}，不是「${word}」那一组`);
  }
  const outputs = bundle.leaves.filter((l) => l.t === "output");
  expect(outputs.length === files.length && files.some((f) => f.mediaType === "text/csv"), "交付文件和证据条目对不上");

  for (let i = 0; i < bundle.leaves.length; i += 1) {
    const proof = await ev.merkleProof(bundle.leaves, i);
    expect(await ev.verifyMerkleProof(bundle.leaves[i]!, i, bundle.leaves.length, proof, bundle.merkle.root), `第 ${i} 片叶子审计路径不成立`);
    if (i > 0) expect(!(await ev.verifyMerkleProof(bundle.leaves[i]!, i - 1, bundle.leaves.length, proof, bundle.merkle.root)), `第 ${i} 片叶子换位置也通过了`);
  }
  console.log(`PASS  RFC 6962 审计路径：${bundle.leaves.length} 片叶子各自成立，挪位置即失败`);

  const fileBytes = files.map((f) => ({ name: f.name, bytes: enc.encode(f.text) }));
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("验真过程不许联网");
  }) as typeof fetch;
  const key = await publicKeyInfo();
  const good = await ev.verifyBundle(JSON.parse(JSON.stringify(bundle)), fileBytes, key.publicKey);
  expect(good.ok && good.signatureValid && good.rootMatches && good.keyTrusted === true, `原样验真应通过：${good.problems.join("；")}`);
  expect(good.files.every((f) => f.status === "match"), "原样文件应全部匹配");
  const recomputed = good.claims.filter((c) => c.status === "recomputed");
  expect(recomputed.length > 0 && good.claims.every((c) => c.status !== "mismatch"), "交付表应能重算出关键数字");
  console.log(
    `PASS  报销台账签发 ${claims.length} 个关键数字（${claims.map((c) => `${c.value}←${c.source.kind}`).join("，")}）；断网验真通过：${recomputed.length} 个从交付表重算一致，${good.claims.length - recomputed.length} 个由签名担保`,
  );

  /* ---------- 3. 篡改 ---------- */
  const csv = fileBytes.find((f) => f.name.endsWith(".csv"))!;
  const flipped = csv.bytes.slice();
  const at = flipped.findIndex((b, i) => i > 20 && b >= 0x30 && b <= 0x38);
  flipped[at] = flipped[at]! + 1;
  const t1 = await ev.verifyBundle(JSON.parse(JSON.stringify(bundle)), fileBytes.map((f) => (f === csv ? { ...f, bytes: flipped } : f)), key.publicKey);
  expect(!t1.ok && t1.files.find((f) => f.name === csv.name)?.status === "tampered", "改一个字节没被发现");
  expect(t1.signatureValid, "文件被改不该影响包本身的签名");
  console.log(`PASS  「${csv.name}」改 1 个字节：验真指出该文件被改，其他文件仍匹配`);

  const forged = JSON.parse(JSON.stringify(bundle)) as typeof bundle;
  const fc = forged.leaves.find((l) => l.t === "claim") as { value: string };
  fc.value = String(Number(fc.value) + 1);
  const t2 = await ev.verifyBundle(forged, fileBytes, key.publicKey);
  expect(!t2.ok && !t2.rootMatches && !t2.signatureValid, "改包里的数字后 Merkle 根或签名竟然还通过");
  console.log("PASS  改证据包里一个关键数字：Merkle 根对不上、签名失败");

  const resigned = JSON.parse(JSON.stringify(bundle)) as typeof bundle;
  const sig = Buffer.from(resigned.signature!.value, "base64");
  sig[5] = sig[5]! ^ 0x01;
  resigned.signature!.value = sig.toString("base64");
  const t3 = await ev.verifyBundle(resigned, fileBytes, key.publicKey);
  expect(!t3.signatureValid && !t3.ok, "签名翻一位仍通过");
  const t4 = await ev.verifyBundle(JSON.parse(JSON.stringify(bundle)), fileBytes, Buffer.alloc(32, 7).toString("base64"));
  expect(t4.keyTrusted === false && !t4.ok, "换成别的信任公钥应判不受信");
  console.log("PASS  签名翻 1 位失败；信任公钥不一致判不受信");
  globalThis.fetch = realFetch;

  /* ---------- 其余两项办事技能也要能签 ---------- */
  const others = [
    {
      skill: "shift-desk",
      query: "排十月第四周的班",
      materials: [
        {
          slot: "staff-roster",
          title: "十月第四周员工表.csv",
          csv: [
            "员工,岗位技能,用工类型,周工时上限,可上班星期,最早,最晚,时薪,不可用日期",
            "王芳,收银|值班长,全职,40,周一至周日,07:00,22:00,28,",
            "李强,理货|值班长,全职,40,周一至周六,07:00,22:00,26,",
            "赵敏,收银|咖啡,兼职,24,周三至周日,09:00,21:00,22,",
            "陈晨,咖啡|理货,兼职,20,周一至周五,07:00,15:00,23,2026-10-21",
            "刘洋,收银|理货,全职,40,周二至周日,07:00,22:00,25,",
          ].join("\n"),
        },
        {
          slot: "shift-demand",
          title: "十月第四周班次需求.csv",
          csv: [
            "日期,班次,开始,结束,岗位,人数",
            "2026-10-19,早班,07:00,15:00,值班长,1",
            "2026-10-19,晚班,14:00,22:00,收银,1",
            "2026-10-20,早班,07:00,15:00,理货,1",
            "2026-10-21,早班,07:00,15:00,咖啡,1",
            "2026-10-22,晚班,14:00,22:00,值班长,1",
            "2026-10-23,早班,07:00,15:00,收银,2",
            "2026-10-24,中班,11:00,19:00,咖啡,1",
            "2026-10-25,早班,07:00,15:00,值班长,1",
          ].join("\n"),
        },
      ],
    },
    {
      skill: "ticket-desk",
      query: "把这批工单分派一下，看看时效",
      materials: [
        {
          slot: "service-tickets",
          title: "十月第二周客服工单.csv",
          csv: [
            "工单号,客户,创建时间,首次响应时间,解决时间,标题,内容,状态",
            "T1001,杭州某贸易公司,2026-10-12 09:05,2026-10-12 09:30,,退款没到账,上周申请的退款还没到账,处理中",
            "T1002,宁波某餐饮店,2026-10-12 10:12,,,APP 闪退,一打开收银页面就闪退,待处理",
            "T1003,温州某零售店,2026-10-12 11:00,2026-10-12 11:04,2026-10-12 11:40,如何改密码,请问在哪里改登录密码,已解决",
            "T1004,杭州某贸易公司,2026-10-12 14:20,2026-10-12 15:10,,发票开错抬头,发票抬头写成了旧公司名,处理中",
            "T1005,绍兴某工厂,2026-10-13 08:40,,,打印机连不上,小票打印机突然连不上,待处理",
            "T1006,嘉兴某药店,2026-10-13 09:15,2026-10-13 09:18,2026-10-13 10:02,账单金额不对,本月账单多扣了一笔,已解决",
          ].join("\n"),
        },
        {
          slot: "service-agents",
          title: "客服坐席排班.csv",
          csv: ["坐席,技能组,在岗", "周婷,账务组|综合组,是", "吴磊,技术组,是", "郑浩,综合组|技术组,是"].join("\n"),
        },
      ],
    },
  ];
  for (const o of others) {
    const sid = newLabSession();
    extraSessions.push(sid);
    for (const m of o.materials) expect(saveLabDataset(sid, m).ok, `${o.skill} 材料导入失败`);
    const r = store.startConsoleRun(sid, o.skill, o.query);
    if ("error" in r) fail(r.error);
    await r.done;
    const b = await buildEvidenceBundle(r.runId);
    if ("error" in b) fail(`${o.skill}：${b.error}`);
    expect(b.bundle.status === "signed", `${o.skill} 有关键数字找不到来源：${b.bundle.unverifiedClaims.join("、")}`);
    const rep = await ev.verifyBundle(b.bundle, b.files.map((f) => ({ name: f.name, bytes: enc.encode(f.text) })), key.publicKey);
    expect(rep.ok, `${o.skill} 验真失败：${rep.problems.join("；")}`);
    const cs = rep.claims;
    console.log(
      `PASS  ${o.skill}：签发 ${cs.length} 个关键数字、${b.files.length} 个交付文件；验真通过（${cs.filter((c) => c.status === "recomputed").length} 个从交付表重算，${cs.filter((c) => c.status === "attested").length} 个由签名担保）`,
    );
  }
} finally {
  for (const sid of extraSessions) {
    for (const slot of ["staff-roster", "shift-demand", "service-tickets", "service-agents"] as const) deleteServerDataset(sid, slot);
    const ids = (db.prepare("SELECT run_id FROM agent_runs WHERE session_id=?").all(sid) as { run_id: string }[]).map((r) => r.run_id);
    for (const id of ids) {
      dbRun("DELETE FROM run_events WHERE run_id=?", [id]);
      dbRun("DELETE FROM agent_runs WHERE run_id=?", [id]);
    }
  }
  deleteServerDataset(sessionId, "expense-ledger");
  const ids = (db.prepare("SELECT run_id FROM agent_runs WHERE session_id=?").all(sessionId) as { run_id: string }[]).map((r) => r.run_id);
  for (const id of ids) {
    dbRun("DELETE FROM run_events WHERE run_id=?", [id]);
    dbRun("DELETE FROM agent_runs WHERE run_id=?", [id]);
  }
}

console.log("PASS  test-evidence");
process.exit(0);
