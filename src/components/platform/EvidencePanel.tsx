import { useEffect, useMemo, useState } from "react";
import {
  merkleProof,
  parseCsv,
  verifyBundle,
  verifyMerkleProof,
  type ClaimSource,
  type EvidenceBundle,
  type EvidenceClaim,
  type EvidenceLeaf,
  type VerifyReport,
} from "../../lib/evidenceBundle";
import { GridPreview } from "./MissionControl";
import { downloadText, LAB_SKILLS, labFetch, labRunApi, useLabSession, type IssuedEvidence, type RunApi } from "./labApi";

type RunRow = { runId: string; label: string; status: string };

const where = (w?: { column: string; equals?: string; prefix?: string }) =>
  w ? `（${w.column}${w.equals === "" ? " 为空" : w.equals !== undefined ? ` = ${w.equals}` : ` 以「${w.prefix}」开头`}）` : "";

export function describeSource(s: ClaimSource): string {
  switch (s.kind) {
    case "output-cell":
      return `${s.file} 第 ${s.row} 行「${s.column}」`;
    case "output-sum":
      return `${s.file}「${s.column}」列求和${where(s.where)}`;
    case "output-count":
      return `${s.file} 行数${where(s.where)}`;
    case "material-cell":
      return `材料 ${s.material} 第 ${s.row} 行「${s.column}」`;
    case "material-sum":
      return `材料 ${s.material}「${s.column}」列求和${where(s.where)}`;
    case "engine-step":
      return `引擎步骤 ${s.stepId} 的输出（只能凭签名采信，无法从文件重算）`;
  }
}

const LEAF_LABEL: Record<EvidenceLeaf["t"], string> = { header: "运行", material: "材料", step: "步骤", output: "文件", claim: "数字" };

function short(h: string, n = 12) {
  return `${h.slice(0, n)}…`;
}

/** 签发一次运行的证据包，点数字看审计路径和出处单元格，并能离线核对收到的文件 */
export function EvidenceIssuer({ api, runId, compact }: { api: RunApi; runId: string; compact?: boolean }) {
  const [issued, setIssued] = useState<IssuedEvidence | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimIdx, setClaimIdx] = useState<number | null>(null);
  const [proof, setProof] = useState<{ path: string[]; ok: boolean } | null>(null);
  const [trusted, setTrusted] = useState<{ keyId: string; publicKey: string } | null>(null);
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [verifyNote, setVerifyNote] = useState<string | null>(null);

  useEffect(() => {
    void api.publicKey().then((r) => r.ok && setTrusted(r.data));
  }, [api]);
  useEffect(() => {
    setIssued(null);
    setClaimIdx(null);
    setReport(null);
  }, [runId]);

  const claims = useMemo(() => (issued?.bundle.leaves ?? []).map((l, i) => ({ l, i })).filter((x): x is { l: EvidenceClaim; i: number } => x.l.t === "claim"), [issued]);

  async function issue() {
    setBusy(true);
    setError(null);
    setReport(null);
    setClaimIdx(null);
    const r = await api.evidence(runId);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setIssued(r.data);
  }

  async function pickClaim(leafIndex: number) {
    if (!issued) return;
    setClaimIdx(leafIndex);
    const path = await merkleProof(issued.bundle.leaves, leafIndex);
    const ok = await verifyMerkleProof(issued.bundle.leaves[leafIndex]!, leafIndex, issued.bundle.leaves.length, path, issued.bundle.merkle.root);
    setProof({ path, ok });
  }

  async function verifyFiles(list: FileList | null) {
    if (!list?.length) return;
    setVerifyNote(null);
    const all = [...list];
    const jsons = await Promise.all(all.filter((f) => /\.json$/i.test(f.name)).map(async (f) => ({ f, text: await f.text() })));
    let bundle: EvidenceBundle | null = null;
    for (const j of jsons) {
      try {
        const v = JSON.parse(j.text) as EvidenceBundle;
        if (v?.format && Array.isArray(v.leaves)) bundle = v;
      } catch {
        /* not a bundle */
      }
    }
    if (!bundle) return setVerifyNote("没找到证据包（.json）。把证据包和要核对的文件一起选上。");
    const files = await Promise.all(
      all.filter((f) => !jsons.some((j) => j.f === f && j.text.includes('"ownagent-evidence/'))).map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
    );
    setReport(await verifyBundle(bundle, files, trusted?.publicKey));
  }

  const claim = claimIdx != null ? (issued?.bundle.leaves[claimIdx] as EvidenceClaim | undefined) : undefined;
  const highlightFile = claim && claim.source.kind === "output-cell" ? issued?.files.find((f) => f.name === (claim.source as { file: string }).file) : undefined;

  return (
    <>
      {!issued ? (
        <div className="pl-actions">
          <button type="button" className="pl-btn pl-btn--primary" disabled={!runId || busy} onClick={() => void issue()}>
            {busy ? "签发中…" : "签发证据包"}
          </button>
          {compact ? <span className="pl-hint">材料、每一步、交付文件和结论里的每个数字做成 Merkle 树并签名，收件人离线就能核对。</span> : null}
        </div>
      ) : null}
      {error ? <p className="pl-error">{error}</p> : null}

      {issued ? (
        <div className="pl-evidence">
          <div className="pl-seal">
            <div className={`pl-seal-badge ${issued.bundle.status === "signed" ? "is-ok" : "is-warn"}`}>{issued.bundle.status === "signed" ? "已签名" : "未签名"}</div>
            <dl>
              <dt>Merkle 根</dt>
              <dd className="pl-mono">{issued.bundle.merkle.root}</dd>
              <dt>条目</dt>
              <dd>{issued.bundle.merkle.size}</dd>
              <dt>签名</dt>
              <dd className="pl-mono">{issued.bundle.signature ? `Ed25519 · 密钥 ${issued.bundle.signature.keyId}` : `有 ${issued.bundle.unverifiedClaims.length} 个数字找不到出处，不签名`}</dd>
            </dl>
            <div className="pl-actions">
              <button type="button" className="pl-btn" onClick={() => downloadText(`evidence-${issued.bundle.runId.slice(0, 8)}.json`, JSON.stringify(issued.bundle, null, 2), "application/json")}>
                下载证据包
              </button>
              {issued.files.map((f) => (
                <button key={f.name} type="button" className="pl-btn pl-btn--ghost" onClick={() => downloadText(f.name, f.text, f.mediaType)}>
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          <div className="pl-leaves" aria-label="证据条目">
            {issued.bundle.leaves.map((l, i) => (
              <button
                key={i}
                type="button"
                className={`pl-leaf is-${l.t}${claimIdx === i ? " is-sel" : ""}`}
                title={`${i}. ${LEAF_LABEL[l.t]}`}
                onClick={() => (l.t === "claim" ? void pickClaim(i) : undefined)}
              />
            ))}
            <span className="pl-leaves-legend">
              {(Object.keys(LEAF_LABEL) as EvidenceLeaf["t"][]).map((t) => (
                <i key={t} className={`is-${t}`}>
                  {LEAF_LABEL[t]} {issued.bundle.leaves.filter((l) => l.t === t).length}
                </i>
              ))}
            </span>
          </div>

          <div className="pl-claims">
            {claims.map(({ l, i }) => (
              <button key={i} type="button" className={`pl-claim${claimIdx === i ? " is-sel" : ""}${issued.bundle.unverifiedClaims.includes(l.id) ? " is-bad" : ""}`} onClick={() => void pickClaim(i)}>
                <b>{l.value}</b>
                <span>{l.context}</span>
                <small>{describeSource(l.source)}</small>
              </button>
            ))}
          </div>

          {claim && proof ? (
            <div className="pl-proof">
              <h3>
                「{claim.value}」的审计路径 <em className={proof.ok ? "is-ok" : "is-bad"}>{proof.ok ? `✓ ${proof.path.length} 步算回根` : "✗ 算不回根"}</em>
              </h3>
              <ol className="pl-mono">
                {proof.path.map((h, k) => (
                  <li key={k}>{short(h, 24)}</li>
                ))}
                <li className="is-root">根 {short(issued.bundle.merkle.root, 24)}</li>
              </ol>
              {highlightFile && claim.source.kind === "output-cell" ? (
                <GridPreview grid={parseCsv(highlightFile.text)} highlight={{ row: claim.source.row, column: claim.source.column }} />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="pl-verify">
        <h3>离线核对</h3>
        <p>选择证据包 .json 和收到的文件（可多选）。核对完全在本机浏览器里算，不连服务器；信任的公钥是本服务的 {trusted ? <code>{trusted.keyId}</code> : "（未取到）"}。</p>
        <label className="pl-drop">
          <input type="file" multiple accept=".json,.csv,.md,.txt" onChange={(e) => void verifyFiles(e.target.files)} />
          <span>选择或拖入文件</span>
        </label>
        {verifyNote ? <p className="pl-error">{verifyNote}</p> : null}
        {report ? (
          <div className={`pl-report ${report.ok ? "is-ok" : "is-bad"}`}>
            <div className="pl-report-row">
              <span className={report.rootMatches ? "is-ok" : "is-bad"}>{report.rootMatches ? "✓" : "✗"} 条目和 Merkle 根一致</span>
              <span className={report.signatureValid ? "is-ok" : "is-bad"}>{report.signatureValid ? "✓" : "✗"} 签名有效</span>
              <span className={report.keyTrusted ? "is-ok" : report.keyTrusted === false ? "is-bad" : ""}>
                {report.keyTrusted ? "✓ 签名密钥可信" : report.keyTrusted === false ? "✗ 不是本服务的密钥" : "· 未指定信任密钥"}
              </span>
            </div>
            <ul>
              {report.files.map((f) => (
                <li key={f.name} className={`is-${f.status}`}>
                  {f.status === "match" ? "✓" : f.status === "tampered" ? "✗ 被改过" : "? 不在证据包里"} {f.name}
                </li>
              ))}
              {report.claims.map((c) => (
                <li key={c.id} className={`is-${c.status}`}>
                  {c.status === "recomputed" ? "✓ 重算一致" : c.status === "mismatch" ? "✗ 对不上" : c.status === "attested" ? "· 凭签名" : c.status === "file-tampered" ? "✗ 文件被改" : "? 缺文件"} {c.value} — {c.note}
                </li>
              ))}
            </ul>
            {report.problems.length ? <p className="pl-error">{report.problems.join("；")}</p> : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

export function EvidencePanel({ sharedRuns }: { sharedRuns: RunRow[] }) {
  const lab = useLabSession();
  const [listed, setListed] = useState<RunRow[]>([]);
  const [runId, setRunId] = useState("");

  useEffect(() => {
    if (!lab.sessionId) return setListed([]);
    void labFetch<{ runs: { runId: string; skillId: string; status: string; createdAt: string; parentRunId: string | null }[] }>(
      `/api/runs?sessionIds=${encodeURIComponent(lab.sessionId)}`,
    ).then((r) => {
      if (!r.ok) return;
      setListed(
        r.data.runs.map((x) => ({
          runId: x.runId,
          status: x.status,
          label: `${LAB_SKILLS.find((s) => s.id === x.skillId)?.label ?? x.skillId} · ${new Date(x.createdAt).toLocaleTimeString()}`,
        })),
      );
    });
  }, [lab.sessionId, sharedRuns]);

  const runs = useMemo(() => {
    const seen = new Set<string>();
    return [...sharedRuns, ...listed].filter((r) => !seen.has(r.runId) && seen.add(r.runId) && r.status === "completed");
  }, [sharedRuns, listed]);
  useEffect(() => {
    if (!runId && runs[0]) setRunId(runs[0].runId);
  }, [runs, runId]);

  return (
    <section className="pl-panel">
      <header className="pl-panel-head">
        <div>
          <h2>证据验真</h2>
          <p>把一次运行的材料、每一步、交付文件和结论里的每个数字做成 Merkle 树，用 Ed25519 签名。收件人离线就能核对：文件改过一个字节、数字和表对不上，都会被指出来。</p>
        </div>
        <div className="pl-actions">
          <select value={runId} onChange={(e) => setRunId(e.target.value)} className="pl-select">
            {runs.length ? null : <option value="">先在运行台办完一次</option>}
            {runs.map((r) => (
              <option key={r.runId} value={r.runId}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </header>
      {runId ? <EvidenceIssuer api={labRunApi} runId={runId} /> : null}
    </section>
  );
}

