/**
 * ownagent-evidence/1：可离线验真的证据包。服务端签发与浏览器验真共用本文件。
 * - 规范化：RFC 8785（JCS）—— 键按 UTF-16 码元排序，数字按 ECMAScript 序列化；
 * - 聚合：RFC 6962 Merkle 树（叶子前缀 0x00、内部节点前缀 0x01），可单独公开一条证据并证明它属于整包；
 * - 签名：Ed25519，签的是 JCS({format, runId, createdAt, root})；
 * - 哈希只用 WebCrypto（浏览器与 Node 都内置），验真全程不发网络请求。
 */
import { verifyAsync } from "@noble/ed25519";

export const EVIDENCE_FORMAT = "ownagent-evidence/1";

export type EvidenceHeader = {
  t: "header";
  runId: string;
  skillId: string;
  skillVersion: string;
  manifestSha256: string;
  query: string;
  status: string;
  model: { provider: string; model: string } | null;
};
export type EvidenceMaterial = { t: "material"; slot: string; title: string; sha256: string; rows: number; columns: string[] };
export type EvidenceStep = { t: "step"; index: number; stepId: string; tool: string; ok: boolean; argsSha256: string; resultSha256: string };
export type EvidenceOutput = { t: "output"; name: string; mediaType: string; sha256: string; bytes: number; fromStep: string };

/** 分组条件：equals 整格相等；prefix 取格子第一个词（如「拦截 发票差额 2.50」→「拦截」） */
export type Where = { column: string; equals?: string; prefix?: string };

export function whereHolds(cell: string | undefined, w: Where): boolean {
  const s = cell ?? "";
  if (w.equals !== undefined) return s === w.equals;
  if (w.prefix !== undefined) return s.split(/\s+/)[0] === w.prefix;
  return false;
}

/** 一条关键数字从哪来 */
export type ClaimSource =
  | { kind: "output-cell"; file: string; row: number; column: string }
  | { kind: "output-sum"; file: string; column: string; where?: Where }
  | { kind: "output-count"; file: string; where?: Where }
  | { kind: "material-cell"; material: string; row: number; column: string }
  | { kind: "material-sum"; material: string; column: string; where?: Where }
  | { kind: "engine-step"; stepId: string };

export type EvidenceClaim = {
  t: "claim";
  id: string;
  value: string;
  context: string;
  source: ClaimSource;
  /** 同一数字还能对上的其他来源个数（越多越可能是巧合） */
  alternatives: number;
  transform: string[];
};

export type EvidenceLeaf = EvidenceHeader | EvidenceMaterial | EvidenceStep | EvidenceOutput | EvidenceClaim;

export type EvidenceBundle = {
  format: typeof EVIDENCE_FORMAT;
  createdAt: string;
  runId: string;
  status: "signed" | "unverified";
  unverifiedClaims: string[];
  leaves: EvidenceLeaf[];
  merkle: { algorithm: "sha256-rfc6962"; size: number; root: string };
  signature: { algorithm: "Ed25519"; keyId: string; publicKey: string; value: string } | null;
};

/* ───────────── JCS ───────────── */

export function jcs(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new TypeError("JCS 不接受 NaN / Infinity");
      return JSON.stringify(value);
    case "string":
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) return `[${value.map(jcs).join(",")}]`;
      const keys = Object.keys(value as object)
        .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      return `{${keys.map((k) => `${JSON.stringify(k)}:${jcs((value as Record<string, unknown>)[k])}`).join(",")}}`;
    }
    default:
      throw new TypeError(`JCS 不接受 ${typeof value}`);
  }
}

/* ───────────── 哈希 ───────────── */

const enc = new TextEncoder();

export function hexOf(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function bytesOfHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
export function bytesOfBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function digest(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  return hexOf(await digest(typeof data === "string" ? enc.encode(data) : data));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export async function leafHash(leaf: EvidenceLeaf): Promise<Uint8Array> {
  return digest(concat(Uint8Array.of(0), enc.encode(jcs(leaf))));
}

async function nodeHash(l: Uint8Array, r: Uint8Array): Promise<Uint8Array> {
  return digest(concat(Uint8Array.of(1), l, r));
}

function splitPoint(n: number): number {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

async function mth(hashes: Uint8Array[]): Promise<Uint8Array> {
  if (hashes.length === 0) return digest(new Uint8Array());
  if (hashes.length === 1) return hashes[0]!;
  const k = splitPoint(hashes.length);
  return nodeHash(await mth(hashes.slice(0, k)), await mth(hashes.slice(k)));
}

export async function merkleRoot(leaves: EvidenceLeaf[]): Promise<string> {
  return hexOf(await mth(await Promise.all(leaves.map(leafHash))));
}

/** RFC 6962 审计路径：证明第 index 片叶子属于这棵树 */
export async function merkleProof(leaves: EvidenceLeaf[], index: number): Promise<string[]> {
  const hashes = await Promise.all(leaves.map(leafHash));
  const path = async (m: number, d: Uint8Array[]): Promise<Uint8Array[]> => {
    if (d.length <= 1) return [];
    const k = splitPoint(d.length);
    return m < k ? [...(await path(m, d.slice(0, k))), await mth(d.slice(k))] : [...(await path(m - k, d.slice(k))), await mth(d.slice(0, k))];
  };
  return (await path(index, hashes)).map(hexOf);
}

export async function verifyMerkleProof(leaf: EvidenceLeaf, index: number, size: number, proof: string[], root: string): Promise<boolean> {
  if (index < 0 || index >= size) return false;
  let fn = index;
  let sn = size - 1;
  let r = await leafHash(leaf);
  for (const hex of proof) {
    const p = bytesOfHex(hex);
    if (sn === 0) return false;
    if (fn % 2 === 1 || fn === sn) {
      r = await nodeHash(p, r);
      if (fn % 2 === 0) {
        while (fn % 2 === 0 && fn !== 0) {
          fn >>= 1;
          sn >>= 1;
        }
      }
    } else {
      r = await nodeHash(r, p);
    }
    fn >>= 1;
    sn >>= 1;
  }
  return sn === 0 && hexOf(r) === root;
}

export function signedMessage(b: Pick<EvidenceBundle, "format" | "runId" | "createdAt"> & { root: string }): Uint8Array {
  return enc.encode(jcs({ format: b.format, runId: b.runId, createdAt: b.createdAt, root: b.root }));
}

/* ───────────── CSV（验真时读拖进来的交付表） ───────────── */

export function parseCsv(text: string): { columns: string[]; rows: string[][] } {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i]!;
    if (q) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i += 1;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    out.push(row);
  }
  const [columns = [], ...rows] = out;
  return { columns, rows };
}

export function numOf(text: string): number | null {
  const t = String(text ?? "").replace(/[,，\s¥￥元]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

export function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

export function sumWhere(grid: { columns: string[]; rows: string[][] }, column: string, where?: Where): number | null {
  const ci = grid.columns.indexOf(column);
  const wi = where ? grid.columns.indexOf(where.column) : -1;
  if (ci < 0 || (where && wi < 0)) return null;
  let s = 0;
  for (const r of grid.rows) {
    if (where && !whereHolds(r[wi], where)) continue;
    const n = numOf(r[ci] ?? "");
    if (n !== null) s += n;
  }
  return Math.round(s * 100) / 100;
}

export function countWhere(grid: { columns: string[]; rows: string[][] }, where?: Where): number | null {
  if (!where) return grid.rows.length;
  const wi = grid.columns.indexOf(where.column);
  return wi < 0 ? null : grid.rows.filter((r) => whereHolds(r[wi], where)).length;
}

/* ───────────── 离线验真 ───────────── */

export type VerifyFile = { name: string; bytes: Uint8Array };
export type FileVerdict = {
  name: string;
  sha256: string;
  status: "match" | "tampered" | "unknown";
  /** 匹配到的证据包条目 */
  matched?: string;
};
export type ClaimVerdict = {
  id: string;
  value: string;
  context: string;
  source: ClaimSource;
  status: "recomputed" | "mismatch" | "attested" | "file-missing" | "file-tampered";
  note: string;
};
export type VerifyReport = {
  ok: boolean;
  format: boolean;
  rootMatches: boolean;
  signatureValid: boolean;
  keyTrusted: boolean | null;
  computedRoot: string;
  files: FileVerdict[];
  claims: ClaimVerdict[];
  problems: string[];
};

export async function verifyBundle(bundle: EvidenceBundle, files: VerifyFile[], trustedPublicKey?: string): Promise<VerifyReport> {
  const problems: string[] = [];
  const format = bundle?.format === EVIDENCE_FORMAT && Array.isArray(bundle.leaves);
  if (!format) {
    return { ok: false, format, rootMatches: false, signatureValid: false, keyTrusted: null, computedRoot: "", files: [], claims: [], problems: ["不是 ownagent-evidence/1 证据包"] };
  }
  const computedRoot = await merkleRoot(bundle.leaves);
  const rootMatches = computedRoot === bundle.merkle.root && bundle.merkle.size === bundle.leaves.length;
  if (!rootMatches) problems.push("证据条目与 Merkle 根对不上：包里的内容被改过");

  let signatureValid = false;
  if (!bundle.signature) problems.push(`证据包未签发：${bundle.unverifiedClaims.length} 个关键数字找不到来源`);
  else {
    try {
      signatureValid = await verifyAsync(
        bytesOfBase64(bundle.signature.value),
        signedMessage({ format: bundle.format, runId: bundle.runId, createdAt: bundle.createdAt, root: computedRoot }),
        bytesOfBase64(bundle.signature.publicKey),
      );
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) problems.push("签名校验失败");
  }
  const keyTrusted = trustedPublicKey ? bundle.signature?.publicKey === trustedPublicKey : null;
  if (keyTrusted === false) problems.push("签名公钥不是你信任的那把");

  const outputs = bundle.leaves.filter((l): l is EvidenceOutput => l.t === "output");
  const grids = new Map<string, { columns: string[]; rows: string[][] }>();
  const fileVerdicts: FileVerdict[] = [];
  for (const f of files) {
    const h = await sha256Hex(f.bytes);
    const byHash = outputs.find((o) => o.sha256 === h);
    if (byHash) {
      fileVerdicts.push({ name: f.name, sha256: h, status: "match", matched: byHash.name });
      if (byHash.mediaType === "text/csv") grids.set(byHash.name, parseCsv(new TextDecoder().decode(f.bytes)));
      continue;
    }
    const byName = outputs.find((o) => o.name === f.name);
    if (byName) {
      fileVerdicts.push({ name: f.name, sha256: h, status: "tampered", matched: byName.name });
      problems.push(`「${f.name}」和签发时不一样（哈希 ${h.slice(0, 12)}… ≠ ${byName.sha256.slice(0, 12)}…）`);
    } else fileVerdicts.push({ name: f.name, sha256: h, status: "unknown" });
  }

  const claims: ClaimVerdict[] = bundle.leaves
    .filter((l): l is EvidenceClaim => l.t === "claim")
    .map((c) => {
      const want = numOf(c.value);
      const base = { id: c.id, value: c.value, context: c.context, source: c.source };
      const s = c.source;
      if (s.kind === "output-cell" || s.kind === "output-sum" || s.kind === "output-count") {
        const g = grids.get(s.file);
        if (!g) {
          const tampered = fileVerdicts.some((v) => v.status === "tampered" && v.matched === s.file);
          return tampered
            ? { ...base, status: "file-tampered" as const, note: `「${s.file}」被改过，不能据它重算` }
            : { ...base, status: "file-missing" as const, note: `拖入「${s.file}」即可重算` };
        }
        let got: number | null = null;
        if (s.kind === "output-cell") {
          const ci = g.columns.indexOf(s.column);
          got = ci < 0 ? null : numOf(g.rows[s.row - 1]?.[ci] ?? "");
        } else if (s.kind === "output-sum") got = sumWhere(g, s.column, s.where);
        else got = countWhere(g, s.where);
        const ok = want !== null && got !== null && sameNumber(want, got);
        if (!ok) problems.push(`关键数字 ${c.value} 在「${s.file}」里重算得到 ${got ?? "空"}`);
        return { ...base, status: ok ? ("recomputed" as const) : ("mismatch" as const), note: ok ? `从「${s.file}」重算一致` : `重算得到 ${got ?? "空"}` };
      }
      return { ...base, status: "attested" as const, note: s.kind === "engine-step" ? `由引擎步骤「${s.stepId}」得出，结果哈希已签` : "来自材料，材料哈希已签" };
    });

  const tampered = fileVerdicts.some((f) => f.status === "tampered") || claims.some((c) => c.status === "mismatch");
  return {
    ok: format && rootMatches && signatureValid && keyTrusted !== false && !tampered,
    format,
    rootMatches,
    signatureValid,
    keyTrusted,
    computedRoot,
    files: fileVerdicts,
    claims,
    problems,
  };
}
