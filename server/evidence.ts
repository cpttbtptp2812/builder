/**
 * 证据包签发：从一次已结束运行的事件流取材料哈希、每步参数与结果哈希、交付文件哈希，
 * 再给办结结论里的每个关键数字找来源（交付表单元格 / 列合计 / 计数 / 材料 / 引擎步骤），
 * 建 RFC 6962 Merkle 树，用 Ed25519 签根。任何关键数字找不到来源 → 不签发。
 */
import type { Hono } from "hono";
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { dbGet, dbRun, nowIso } from "./db.ts";
import { getArtifact, runSkillSnapshot, runView } from "./runEventStore.ts";
import { gridToCsv } from "../src/lib/productDataStore.ts";
import { engineFactsFromReport } from "../src/lib/llmProductBrief.ts";
import {
  EVIDENCE_FORMAT,
  countWhere,
  jcs,
  merkleRoot,
  numOf,
  sameNumber,
  sha256Hex,
  signedMessage,
  sumWhere,
  type ClaimSource,
  type Where,
  type EvidenceBundle,
  type EvidenceClaim,
  type EvidenceLeaf,
  type EvidenceOutput,
} from "../src/lib/evidenceBundle.ts";

const KEY_CONFIG = "evidence.ed25519.pkcs8";

let cachedKey: { priv: KeyObject; publicKey: string; keyId: string } | null = null;

function loadSigningKey() {
  if (cachedKey) return cachedKey;
  let priv: KeyObject;
  const env = process.env.OWNAGENT_SIGNING_KEY?.trim();
  if (env) {
    priv = env.includes("BEGIN") ? createPrivateKey(env) : createPrivateKey({ key: Buffer.from(env, "base64"), format: "der", type: "pkcs8" });
  } else {
    const row = dbGet<{ value: string }>("SELECT value FROM app_config WHERE key=?", [KEY_CONFIG]);
    if (row) priv = createPrivateKey(row.value);
    else {
      priv = generateKeyPairSync("ed25519").privateKey;
      dbRun("INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?)", [KEY_CONFIG, priv.export({ format: "pem", type: "pkcs8" }).toString(), nowIso()]);
    }
  }
  if (priv.asymmetricKeyType !== "ed25519") throw new Error("OWNAGENT_SIGNING_KEY 必须是 Ed25519 私钥");
  const jwk = createPublicKey(priv).export({ format: "jwk" }) as { x: string };
  const raw = Buffer.from(jwk.x, "base64url");
  const publicKey = raw.toString("base64");
  cachedKey = { priv, publicKey, keyId: "" };
  return cachedKey;
}

export async function publicKeyInfo() {
  const k = loadSigningKey();
  if (!k.keyId) k.keyId = (await sha256Hex(Buffer.from(k.publicKey, "base64"))).slice(0, 16);
  return { algorithm: "Ed25519" as const, keyId: k.keyId, publicKey: k.publicKey };
}

type Grid = { columns: string[]; rows: string[][] };
export type BundleFile = { name: string; mediaType: string; text: string };

function asGrid(v: unknown): Grid | null {
  const g = v as Grid | undefined;
  return g && Array.isArray(g.columns) && Array.isArray(g.rows) ? g : null;
}

/** 结论里出现的每个数字（含个位数的笔数），带各自的前后文 */
function numbersIn(text: string): { value: string; before: string; context: string }[] {
  const flat = text.replace(/(\d),(?=\d{3})/g, "$1");
  const out: { value: string; before: string; context: string }[] = [];
  for (const m of flat.matchAll(/\d+(?:\.\d+)?/g)) {
    const at = m.index ?? 0;
    const before = flat.slice(Math.max(0, at - 14), at);
    out.push({ value: m[0], before, context: `${before}${m[0]}${flat.slice(at + m[0].length, at + m[0].length + 8)}`.replace(/\s+/g, " ") });
  }
  return out;
}

/** 前文里离数字最近的分组名优先（“出纳3单”→ 出纳那一组） */
function nearness(before: string, src: ClaimSource): number {
  const where = "where" in src ? src.where : undefined;
  const w = where?.equals ?? where?.prefix;
  if (!w) return 99;
  const at = before.lastIndexOf(w);
  return at < 0 ? 99 : before.length - (at + w.length);
}

/** 文字列上能分的组：整格取值（≤40 种），以及首词前缀（出现 ≥2 次且与整格不同） */
function groupsOf(g: Grid): Where[] {
  const out: Where[] = [];
  g.columns.forEach((column, ci) => {
    const cells = g.rows.map((r) => r[ci] ?? "");
    if (cells.some((c) => numOf(c) !== null)) return;
    const vals = new Set(cells);
    if (vals.size > 1 && vals.size <= 40) for (const v of vals) out.push({ column, equals: v });
    const heads = new Map<string, number>();
    for (const c of cells) {
      const h = c.split(/\s+/)[0] ?? "";
      if (h && h !== c) heads.set(h, (heads.get(h) ?? 0) + 1);
    }
    for (const [h, n] of heads) if (n >= 2 && !vals.has(h)) out.push({ column, prefix: h });
  });
  return out;
}

function numericColumns(g: Grid): string[] {
  return g.columns.filter((_, ci) => g.rows.some((r) => numOf(r[ci] ?? "") !== null));
}

function candidatesFor(
  value: string,
  before: string,
  context: string,
  outputs: { name: string; grid: Grid }[],
  materials: { title: string; grid: Grid }[],
  steps: { stepId: string; text: string }[],
): { found: ClaimSource[]; alternatives: number } {
  const want = numOf(value);
  if (want === null) return { found: [], alternatives: 0 };
  const isInt = Number.isInteger(want);
  const countish = isInt && new RegExp(`${value.replace(".", "\\.")}\\s*(行|条|笔|人|个|张|项|单|名|次|位)`).test(context);
  const cells: ClaimSource[] = [];
  const sums: ClaimSource[] = [];
  const counts: ClaimSource[] = [];
  const mats: ClaimSource[] = [];
  for (const o of outputs) {
    o.grid.rows.forEach((r, ri) =>
      r.forEach((cell, ci) => {
        const n = numOf(cell);
        if (n !== null && sameNumber(n, want)) cells.push({ kind: "output-cell", file: o.name, row: ri + 1, column: o.grid.columns[ci]! });
      }),
    );
    const groups = groupsOf(o.grid);
    for (const col of numericColumns(o.grid)) {
      const total = sumWhere(o.grid, col);
      if (total !== null && sameNumber(total, want) && o.grid.rows.length > 1) sums.push({ kind: "output-sum", file: o.name, column: col });
      for (const where of groups) {
        const s = sumWhere(o.grid, col, where);
        if (s !== null && sameNumber(s, want) && (countWhere(o.grid, where) ?? 0) > 1) sums.push({ kind: "output-sum", file: o.name, column: col, where });
      }
    }
    if (isInt) {
      if (o.grid.rows.length === want) counts.push({ kind: "output-count", file: o.name });
      for (const where of groups) {
        if (countWhere(o.grid, where) === want) counts.push({ kind: "output-count", file: o.name, where });
      }
    }
  }
  for (const m of materials) {
    m.grid.rows.forEach((r, ri) =>
      r.forEach((cell, ci) => {
        const n = numOf(cell);
        if (n !== null && sameNumber(n, want)) mats.push({ kind: "material-cell", material: m.title, row: ri + 1, column: m.grid.columns[ci]! });
      }),
    );
    for (const col of numericColumns(m.grid)) {
      const total = sumWhere(m.grid, col);
      if (total !== null && sameNumber(total, want) && m.grid.rows.length > 1) mats.push({ kind: "material-sum", material: m.title, column: col });
    }
  }
  const byNear = (xs: ClaimSource[]) => xs.map((s, i) => ({ s, i, d: nearness(before, s) })).sort((a, b) => a.d - b.d || a.i - b.i).map((x) => x.s);
  const engine = steps.filter((s) => s.text.replace(/,/g, "").includes(value)).map((s): ClaimSource => ({ kind: "engine-step", stepId: s.stepId }));
  const ordered = countish
    ? [...byNear(counts), ...byNear(sums), ...cells, ...mats]
    : [...cells, ...byNear(sums), ...byNear(counts), ...mats];
  // 小整数（如 3）在表里随处可见：没有“几单/几条”的语境，又对不上前文的分组名，就只认引擎步骤
  const trusted = isInt && want < 100 && !countish ? ordered.filter((s) => nearness(before, s) < 99) : ordered;
  return { found: [...trusted, ...engine], alternatives: Math.max(0, trusted.length - 1) };
}

export async function buildEvidenceBundle(runId: string): Promise<{ bundle: EvidenceBundle; files: BundleFile[] } | { error: string }> {
  const view = runView(runId);
  if (!view) return { error: "没有这次运行" };
  if (view.status !== "completed") return { error: `运行状态是 ${view.status}，只有办完的运行才能签发证据包` };
  const manifest = runSkillSnapshot(runId);
  if (!manifest) return { error: "这次运行没有技能快照" };

  const files: BundleFile[] = [];
  const outputs: { name: string; grid: Grid }[] = [];
  const outLeaves: EvidenceOutput[] = [];
  const used = new Set<string>();
  const uniq = (base: string, ext: string) => {
    let name = `${base}${ext}`;
    for (let i = 2; used.has(name); i += 1) name = `${base}-${i}${ext}`;
    used.add(name);
    return name;
  };
  const done = view.nodes.filter((n) => n.status === "completed" || n.status === "failed");
  for (const n of done) {
    if (!/_deliver_/.test(n.tool)) continue;
    const grid = asGrid((n.result as { grid?: unknown } | null)?.grid);
    if (!grid) continue;
    const name = uniq(n.label.replace(/[\\/:*?"<>|]/g, "_"), ".csv");
    const text = gridToCsv(grid.columns, grid.rows);
    files.push({ name, mediaType: "text/csv", text });
    outputs.push({ name, grid });
    outLeaves.push({ t: "output", name, mediaType: "text/csv", sha256: await sha256Hex(text), bytes: Buffer.byteLength(text), fromStep: n.stepId });
  }
  const report = [...done].reverse().find((n) => /_report__$/.test(n.tool));
  if (!report) return { error: "这次运行没有结论步骤，无法签发" };
  const reportResult = report.result as { markdown?: string; detail?: string; summary?: string } | null;
  const reportText = String(reportResult?.markdown ?? reportResult?.detail ?? "");
  const mdName = uniq("办结说明", ".md");
  files.push({ name: mdName, mediaType: "text/markdown", text: reportText });
  outLeaves.push({ t: "output", name: mdName, mediaType: "text/markdown", sha256: await sha256Hex(reportText), bytes: Buffer.byteLength(reportText), fromStep: report.stepId });

  const materials = view.materials.map((m) => {
    const body = JSON.parse(getArtifact(m.sha256) ?? "null") as Grid | null;
    return { title: m.title, grid: body ?? { columns: [], rows: [] } };
  });
  const stepTexts = done.map((n) => {
    const r = n.result as { detail?: string; summary?: string } | null;
    return { stepId: n.stepId, text: `${r?.detail ?? ""}\n${r?.summary ?? ""}` };
  });

  const facts = engineFactsFromReport(reportResult);
  const claims: EvidenceClaim[] = [];
  const unverified: string[] = [];
  for (const { value, before, context } of numbersIn(facts?.engineSummary ?? "")) {
    const { found, alternatives } = candidatesFor(value, before, context, outputs, materials, stepTexts);
    if (!found.length) {
      unverified.push(value);
      continue;
    }
    const source = found[0]!;
    const firstStep = stepTexts.find((s) => s.text.replace(/,/g, "").includes(value))?.stepId;
    const transform = done
      .slice(Math.max(0, done.findIndex((n) => n.stepId === (firstStep ?? report.stepId))))
      .filter((n) => n.index <= report.index && !/_deliver_/.test(n.tool))
      .map((n) => n.tool);
    claims.push({ t: "claim", id: `c${claims.length + 1}`, value, context, source, alternatives, transform });
  }

  const llm = done.find((n) => n.tool === "__llm_product_brief__")?.result as { meta?: { provider?: string; model?: string } } | undefined;
  const leaves: EvidenceLeaf[] = [
    {
      t: "header",
      runId,
      skillId: view.skillId,
      skillVersion: view.skillVersion,
      manifestSha256: await sha256Hex(manifest),
      query: view.query,
      status: view.status,
      model: llm?.meta?.provider && llm.meta.model ? { provider: llm.meta.provider, model: llm.meta.model } : null,
    },
    ...view.materials.map((m) => ({ t: "material" as const, slot: m.slot, title: m.title, sha256: m.sha256, rows: m.rows, columns: m.columns })),
    ...(await Promise.all(
      done.map(async (n) => ({
        t: "step" as const,
        index: n.index,
        stepId: n.stepId,
        tool: n.tool,
        ok: n.status === "completed",
        argsSha256: await sha256Hex(jcs(n.args ?? {})),
        resultSha256: await sha256Hex(jcs(n.result ?? null)),
      })),
    )),
    ...outLeaves,
    ...claims,
  ];
  const createdAt = nowIso();
  const root = await merkleRoot(leaves);
  const status = unverified.length ? "unverified" : "signed";
  let signature: EvidenceBundle["signature"] = null;
  if (status === "signed") {
    const key = loadSigningKey();
    const info = await publicKeyInfo();
    const value = sign(null, Buffer.from(signedMessage({ format: EVIDENCE_FORMAT, runId, createdAt, root })), key.priv).toString("base64");
    signature = { algorithm: "Ed25519", keyId: info.keyId, publicKey: info.publicKey, value };
  }
  const bundle: EvidenceBundle = {
    format: EVIDENCE_FORMAT,
    createdAt,
    runId,
    status,
    unverifiedClaims: unverified,
    leaves,
    merkle: { algorithm: "sha256-rfc6962", size: leaves.length, root },
    signature,
  };
  return { bundle, files };
}

export function registerEvidence(app: Hono) {
  app.get("/api/evidence/public-key", async (c) => c.json(await publicKeyInfo()));
  app.post("/api/evidence/bundle", async (c) => {
    const body = await c.req.json<{ runId?: string }>().catch(() => null);
    if (!body?.runId) return c.json({ error: "runId 必填" }, 400);
    const r = await buildEvidenceBundle(body.runId);
    if ("error" in r) return c.json(r, 400);
    return c.json(r);
  });
}
