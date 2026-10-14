/** 这一单真实步骤的协作图：失败或被拦住的步骤可以回到回放里单独改。 */

import { reviewRun } from "../../lib/runReview";
import { capabilityLabel } from "./gatewayLabel";
import { useRunStream } from "./MissionControl";
import type { RunApi } from "./labApi";
import { reduceRun } from "../../lib/runReducer";
import { useMemo } from "react";

export function RunCollaboration({ api, runId, onFocus }: { api: RunApi; runId: string; onFocus: (index: number) => void }) {
  const track = useRunStream(api, runId);
  const view = useMemo(() => (track?.events.length ? reduceRun(track.events) : null), [track]);
  if (!view) return <p className="pl-note">正在读取这一单的步骤…</p>;
  const { lanes, rejects } = reviewRun(view.nodes);
  return (
    <div className="rg">
      <p className="pl-note">这些是这一单真正跑过的步骤，按取证、执行、审阅分开。没有模型时不会另外编一段分工。</p>
      <div className="rg-lanes">
        {(["取证", "执行", "审阅"] as const).map((role) => (
          <section key={role}>
            <h3>{role}</h3>
            {lanes[role].length ? (
              <ol>
                {lanes[role].map((node) => (
                  <li key={node.stepId} className={node.status === "failed" ? "is-bad" : ""}>
                    <strong>{node.name}</strong>
                    <span>
                      {node.ms != null ? `${node.ms} ms` : node.status}
                      {node.gateway ? ` · ${node.gateway.allowed ? capabilityLabel(node.gateway.capability) : "未授权"} · 限时 ${Math.round(node.gateway.timeoutMs / 1000)} 秒` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>这一单没有归到这里的步骤。</p>
            )}
          </section>
        ))}
      </div>
      {rejects.length ? (
        <div className="pl-adopt">
          <span>审阅没有通过的步骤：{rejects.map((item) => `${item.name}（${item.reason}）`).join("；")}</span>
          <button type="button" className="pl-btn pl-btn--primary" onClick={() => onFocus(rejects[0]!.index)}>
            去回放里只改这一步
          </button>
        </div>
      ) : (
        <p className="pl-note">审阅没有发现失败或被拦住的步骤。</p>
      )}
    </div>
  );
}
