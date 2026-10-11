import { useEffect, useState } from "react";
import { loadBaselineTags } from "../../lib/teamGateClient";
import { listPendingApprovals } from "../../lib/teamStore";

export function BaselineEnvBoard({ limit = 12 }: { limit?: number }) {
  const [rows, setRows] = useState<{ id: string; staging?: string; prod?: string }[]>([]);
  const pending = listPendingApprovals();

  useEffect(() => {
    void loadBaselineTags().then((tags) => {
      const list = Object.entries(tags)
        .map(([id, t]) => ({ id, staging: t.staging, prod: t.prod }))
        .filter((r) => r.staging || r.prod)
        .slice(0, limit);
      setRows(list);
    });
  }, [limit]);

  if (!rows.length && !pending.length) {
    return (
      <p className="oa-skill-baseline-empty">
        尚无服务端 baseline 标记。发版检查通过后，在技能详情可将版本标为 staging / prod（需连接 API 服务）。
      </p>
    );
  }

  return (
    <div className="oa-baseline-board">
      {pending.length ? (
        <p className="oa-baseline-pending">
          浏览器待审批 {pending.length} 条（与团队审批队列并行，以服务端为准）。
        </p>
      ) : null}
      {rows.length ? (
        <table className="oa-baseline-table">
          <thead>
            <tr>
              <th>Skill</th>
              <th>Staging</th>
              <th>Prod</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <code>{r.id}</code>
                </td>
                <td>{r.staging ? `v${r.staging}` : "—"}</td>
                <td>{r.prod ? `v${r.prod}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
