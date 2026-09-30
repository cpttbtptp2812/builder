import type { InspectCheckStatus } from "../../lib/releaseInspect";
import type { ReleaseDependencyProof } from "../../lib/releaseDependencyProof";

function overallLabel(o: InspectCheckStatus) {
  if (o === "pass") return "可发布";
  if (o === "warn") return "建议看一眼";
  return "暂不可发布";
}

function viaLabel(via?: string) {
  if (via === "server") return "服务端探活";
  if (via === "demo") return "演示环境（未连 API，example.com 等预制 URL）";
  if (via === "browser") return "浏览器直连";
  return "实时探活";
}

function checkIcon(status: InspectCheckStatus) {
  if (status === "pass") return "✓";
  if (status === "warn") return "!";
  return "×";
}

/** 给客户看的「线上验收快照」— 不展示 probe.ok 等内部字段名 */
export function ReleaseDependencyCard({ proof }: { proof: ReleaseDependencyProof | null }) {
  if (!proof) return null;
  const tone = proof.overall;

  let host = proof.targetUrl;
  try {
    host = new URL(proof.targetUrl).hostname;
  } catch {
    /* keep url */
  }

  return (
    <section className={`own-accept-snap own-accept-snap--${tone}`} aria-label="线上验收快照">
      <header className="own-accept-snap-head">
        <div>
          <p className="own-accept-snap-kicker">线上验收快照</p>
          <h3>{host}</h3>
          <p className="own-accept-snap-lead">{proof.headline}</p>
        </div>
        <div className="own-accept-snap-verdict">
          <span className={`own-accept-snap-badge is-${tone}`}>{overallLabel(tone)}</span>
          <small>{viaLabel(proof.via)}</small>
        </div>
      </header>

      <div className="own-accept-snap-metrics">
        {proof.metrics.map((m) => (
          <article key={m.id} className={`own-accept-metric is-${m.status}`}>
            <span className="own-accept-metric-label">{m.label}</span>
            <strong>{m.value}</strong>
          </article>
        ))}
      </div>

      {proof.pagePreview ? (
        <div className="own-accept-snap-preview">
          <span>页面摘要</span>
          <p>{proof.pagePreview}</p>
        </div>
      ) : null}

      <ul className="own-accept-snap-checks">
        {proof.checks.map((c) => (
          <li key={c.id} className={`is-${c.status}`}>
            <i aria-hidden>{checkIcon(c.status)}</i>
            <div>
              <strong>{c.label}</strong>
              <p>{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      {proof.auditHash ? (
        <details className="own-accept-snap-audit">
          <summary>技术审计（可选）</summary>
          <p>
            验收指纹 <code>{proof.auditHash}</code> · 结论由上述 HTTP/页面字段计算，非模型口述。
          </p>
        </details>
      ) : null}
    </section>
  );
}
