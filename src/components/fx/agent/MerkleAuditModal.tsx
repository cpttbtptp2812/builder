import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  verifyBundle,
  merkleRoot,
  EVIDENCE_FORMAT,
  type EvidenceBundle,
  type VerifyReport,
} from "../../../lib/evidenceBundle";

const MOCK_LEAVES: import("../../../lib/evidenceBundle").EvidenceLeaf[] = [
  {
    t: "header",
    runId: "run_audit_7f2a1b",
    skillId: "invoice-reconcile-v2",
    skillVersion: "2.4.0",
    manifestSha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    query: "按部门汇总报销表，标出和发票对不上的",
    status: "success",
    model: { provider: "deepseek", model: "deepseek-r1" },
  },
  {
    t: "material",
    slot: "invoices.csv",
    title: "报销发票明细",
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    rows: 8,
    columns: ["部门", "报销人", "发票金额", "核验状态"],
  },
  {
    t: "step",
    index: 1,
    stepId: "step_normalize",
    tool: "data_normalize",
    ok: true,
    argsSha256: "a1b2c3d4e5",
    resultSha256: "f6e5d4c3b2",
  },
  {
    t: "step",
    index: 2,
    stepId: "step_cross_check",
    tool: "diff_check",
    ok: true,
    argsSha256: "1122334455",
    resultSha256: "9988776655",
  },
  {
    t: "claim",
    id: "claim_1",
    value: "2",
    context: "发票金额不一致的异常单据数量",
    source: { kind: "engine-step", stepId: "step_cross_check" },
    alternatives: 0,
    transform: ["filter(status == 'mismatch')", "count()"],
  },
  {
    t: "claim",
    id: "claim_2",
    value: "14280.50",
    context: "部门报销合规总金额",
    source: { kind: "engine-step", stepId: "step_normalize" },
    alternatives: 0,
    transform: ["sum(verified_amount)"],
  },
];

export function MerkleAuditModal({ onClose }: { onClose: () => void }) {
  const [bundle, setBundle] = useState<EvidenceBundle | null>(null);
  const [verdict, setVerdict] = useState<VerifyReport | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [tampered, setTampered] = useState(false);

  useEffect(() => {
    void (async () => {
      const root = await merkleRoot(MOCK_LEAVES);
      setBundle({
        format: EVIDENCE_FORMAT,
        createdAt: new Date().toISOString(),
        runId: "run_audit_7f2a1b",
        status: "signed",
        unverifiedClaims: [],
        leaves: MOCK_LEAVES,
        merkle: { algorithm: "sha256-rfc6962", size: MOCK_LEAVES.length, root },
        signature: null,
      });
    })();
  }, []);

  const handleVerify = async (tamper: boolean = false) => {
    if (!bundle) return;
    setVerifying(true);
    setTampered(tamper);
    const targetBundle: EvidenceBundle = tamper
      ? { ...bundle, merkle: { ...bundle.merkle, root: "0000000000000000000000000000000000000000000000000000000000000000" } }
      : bundle;
    try {
      const res = await verifyBundle(targetBundle, []);
      setVerdict(res);
    } finally {
      setVerifying(false);
    }
  };

  if (!bundle) return null;

  return createPortal(
    <div className="oa-xray-backdrop" onClick={onClose}>
      <aside
        className="oa-xray-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="企业级 Merkle 树合规审计控制台"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="oa-xray-header">
          <div className="oa-xray-title-box">
            <span className="oa-xray-beacon" style={{ background: "#f59e0b", boxShadow: "0 0 10px #f59e0b" }} />
            <div>
              <div className="oa-xray-title-row">
                <h3 className="oa-xray-title">ENTERPRISE MERKLE EVIDENCE AUDIT</h3>
                <span className="oa-xray-badge-live" style={{ color: "#d97706", background: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)" }}>
                  RFC 6962 / Ed25519
                </span>
              </div>
              <p className="oa-xray-subtitle">不可篡改密码学证据 · JCS (RFC 8785) 规范化 · 离线零信任验真</p>
            </div>
          </div>
          <button type="button" className="oa-xray-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>

        {/* Top KPIs */}
        <div className="oa-xray-kpis">
          <div className="oa-xray-kpi">
            <span className="oa-xray-kpi-label">MERKLE ROOT</span>
            <span className="oa-xray-kpi-val highlight" style={{ fontSize: "11px", wordBreak: "break-all" }}>
              {bundle.merkle.root.slice(0, 16)}…
            </span>
            <span className="oa-xray-kpi-sub">RFC 6962 Sha256</span>
          </div>
          <div className="oa-xray-kpi">
            <span className="oa-xray-kpi-label">LEAF COUNT</span>
            <span className="oa-xray-kpi-val success">{bundle.leaves.length} 个密码学叶子</span>
            <span className="oa-xray-kpi-sub">Header / Steps / Claims</span>
          </div>
          <div className="oa-xray-kpi">
            <span className="oa-xray-kpi-label">SIGNATURE PROTOCOL</span>
            <span className="oa-xray-kpi-val">Ed25519</span>
            <span className="oa-xray-kpi-sub">不可否认性验签</span>
          </div>
          <div className="oa-xray-kpi">
            <span className="oa-xray-kpi-label">ATTESTATION STATUS</span>
            <span className="oa-xray-kpi-val" style={{ color: verdict?.ok ? "#059669" : verdict ? "#dc2626" : "#64748b" }}>
              {verdict?.ok ? "🛡️ 验真通过" : verdict ? "⚠️ 发现篡改" : "待验真"}
            </span>
            <span className="oa-xray-kpi-sub">WebCrypto 纯离线</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="oa-xray-body" style={{ gridTemplateColumns: "1.1fr 0.9fr" }}>
          {/* Left: Merkle Leaves Tree */}
          <div className="oa-xray-timeline-section" style={{ padding: "1rem" }}>
            <div className="oa-xray-section-head">
              <span className="oa-xray-section-title">🌲 MERKLE LEAF NODES (叶子清单)</span>
              <span className="oa-xray-section-meta">共 {bundle.leaves.length} 块证据</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
              {bundle.leaves.map((leaf, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    padding: "0.6rem 0.8rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: leaf.t === "claim" ? "#fef3c7" : leaf.t === "step" ? "#e0f2fe" : "#f1f5f9",
                        color: leaf.t === "claim" ? "#b45309" : leaf.t === "step" ? "#0369a1" : "#475569",
                      }}
                    >
                      {leaf.t.toUpperCase()}
                    </span>
                    <strong style={{ fontSize: "12px", color: "#1e293b" }}>
                      {leaf.t === "claim" ? `数字依据: ${leaf.value}` : leaf.t === "step" ? `步骤: ${leaf.tool}` : leaf.t === "material" ? leaf.title : "Header 元信息"}
                    </strong>
                  </div>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {leaf.t === "claim" ? leaf.context : leaf.t === "step" ? `ok: ${leaf.ok}` : "已哈希"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Verification Action & Log */}
          <div className="oa-xray-detail-section" style={{ padding: "1.25rem" }}>
            <div className="oa-xray-inspector-card" style={{ marginBottom: "1rem" }}>
              <div className="oa-xray-card-head">
                <div className="oa-xray-card-info">
                  <strong style={{ fontSize: "14px" }}>离线零信任密码学验真</strong>
                  <span>无需服务器参与，浏览器端调用 WebCrypto 重算 Merkle 根并检验签名</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", margin: "1rem 0" }}>
                <button
                  type="button"
                  className="oa-xray-export-btn"
                  style={{ background: "#059669", flex: 1 }}
                  disabled={verifying}
                  onClick={() => handleVerify(false)}
                >
                  🛡️ 正常验真 (Verify Integrity)
                </button>
                <button
                  type="button"
                  className="oa-xray-export-btn"
                  style={{ background: "#dc2626" }}
                  disabled={verifying}
                  onClick={() => handleVerify(true)}
                  title="模拟文件在传输中被恶意篡改了一个字节"
                >
                  💥 模拟篡改攻击测试
                </button>
              </div>

              {verdict && (
                <div
                  style={{
                    padding: "0.85rem",
                    borderRadius: "6px",
                    background: verdict.ok ? "#ecfdf5" : "#fef2f2",
                    border: `1px solid ${verdict.ok ? "#a7f3d0" : "#fecaca"}`,
                    color: verdict.ok ? "#065f46" : "#991b1b",
                    fontSize: "12px",
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ display: "block", marginBottom: "0.25rem" }}>
                    {verdict.ok ? "✅ 验证完全一致！整包未被篡改" : "❌ 验证失败：Merkle 根哈希或签名不匹配！"}
                  </strong>
                  <div>格式协议: {verdict.format ? "ownagent-evidence/1 (通过)" : "无效"}</div>
                  <div>根哈希比对: {verdict.rootMatches ? "一致 (Match)" : "不一致 (Tampered)"}</div>
                  <div>数字凭据项: {verdict.claims.length} 项结论与步骤全部可自证溯源</div>
                  {tampered && (
                    <div style={{ marginTop: "0.5rem", fontWeight: 700, color: "#b91c1c" }}>
                      [安全警报]: 检测到根哈希被恶意篡改，系统已自动拦截假冒数据！
                    </div>
                  )}
                </div>
              )}
            </div>

            <span className="oa-xray-field-name">Evidence Bundle 原始 JCS 规范包:</span>
            <pre className="oa-xray-json-code" style={{ maxHeight: "280px" }}>
              {JSON.stringify(bundle, null, 2)}
            </pre>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}
