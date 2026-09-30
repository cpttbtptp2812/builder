import type { PageWalkResult } from "./PageToolWalk";
import type { RouteFuzzReport } from "../../lib/skillRouteFuzz";
import type { ShadowReplayReport } from "../../lib/skillShadowReplay";
import { skillQueryStats } from "../../lib/skillQueryLog";
import { PageToolWalk } from "./PageToolWalk";

export function ReleaseCheckExtras({
  checking,
  shadow,
  fuzz,
  pageWalk,
  skillId,
  draftRaw,
  defaultOpen = false,
  flat = false,
}: {
  checking: boolean;
  shadow: ShadowReplayReport | null;
  fuzz: RouteFuzzReport | null;
  pageWalk?: PageWalkResult | null;
  skillId: string;
  draftRaw?: string;
  defaultOpen?: boolean;
  /** 发版工作台内：不再套一层 details */
  flat?: boolean;
}) {
  const stats = skillQueryStats(skillId, 14);
  if (checking) return null;
  if (!shadow && !fuzz && !pageWalk) return null;

  const badShadow = shadow && shadow.routeDriftCount + shadow.executionRegressCount > 0;
  const badFuzz = fuzz && fuzz.lostCount > 0;
  const badPage = pageWalk && !pageWalk.ok;
  const summaryParts: string[] = [];
  if (shadow?.queried) summaryParts.push(`回流 ${shadow.queried} 句`);
  else if (shadow?.emptyReason) summaryParts.push("回流暂无");
  if (fuzz) summaryParts.push(`邻域 ${fuzz.lostCount} 抢路`);
  if (pageWalk) summaryParts.push(pageWalk.ok ? "本页试跑通过" : "本页试跑未过");

  const body = (
      <div className={flat ? "own-release-extras own-release-extras--flat" : "own-release-extras"}>
        {pageWalk && draftRaw ? (
          <section className="own-release-extra">
            <h3>本页工具试跑</h3>
            <PageToolWalk skillId={skillId} draftRaw={draftRaw} embedded result={pageWalk} />
          </section>
        ) : null}

        {shadow ? (
          <section className="own-release-extra">
            <h3>真实回流</h3>
            <p className="own-release-extra-lead">
              {shadow.queried === 0 ? (
                <>
                  {shadow.emptyReason}
                  {stats.handled === 0 ? (
                    <span className="own-release-extra-tip">
                      {" "}
                      请先在「对话」完成一次带链接的巡检（如 `/inspect https://example.com`）。
                    </span>
                  ) : (
                    <span className="own-release-extra-tip"> 已记录 {stats.handled} 条，请刷新后重试检查。</span>
                  )}
                </>
              ) : (
                `近 ${shadow.windowDays} 天 ${shadow.queried} 条真实问句：${shadow.routeDriftCount} 条路由变了，${shadow.executionRegressCount} 条新版执行失败。`
              )}
            </p>
            {shadow.rows.length ? (
              <ul className="own-release-extra-list">
                {shadow.rows.map((r) => (
                  <li key={r.query} className={r.routeDrift || r.executionRegressed ? "is-bad" : "is-ok"}>
                    <span>{r.query}</span>
                    {r.routeDrift ? (
                      <em>
                        {r.baselineRouteLabel} → {r.candidateRouteLabel}
                      </em>
                    ) : r.executionRegressed ? (
                      <em>新版执行失败</em>
                    ) : (
                      <em>一致</em>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {fuzz ? (
          <section className="own-release-extra">
            <h3>路由邻域扫描</h3>
            <p className="own-release-extra-lead">
              {fuzz.variantsTested} 种变体 · 被抢走 {fuzz.lostCount} · 新抢到 {fuzz.gainedCount}
            </p>
            {fuzz.rows.length ? (
              <ul className="own-release-extra-list">
                {fuzz.rows.map((r) => (
                  <li key={r.variant} className={r.lostRoute ? "is-bad" : r.gainedRoute ? "is-warn" : undefined}>
                    <span>
                      {r.variant} <small>({r.kind})</small>
                    </span>
                    <em>
                      {r.baselineLabel} → {r.candidateLabel}
                    </em>
                  </li>
                ))}
              </ul>
            ) : fuzz.lostCount === 0 && fuzz.gainedCount === 0 ? (
              <p className="own-release-extra-ok">变体路由与现用版一致。</p>
            ) : null}
          </section>
        ) : null}
      </div>
  );

  if (flat) return body;

  return (
    <details className="own-release-extras-fold" open={defaultOpen || Boolean(badShadow || badFuzz || badPage)}>
      <summary>补充信号{summaryParts.length ? ` · ${summaryParts.join(" · ")}` : ""}</summary>
      {body}
    </details>
  );
}
