import { useEffect, useState } from "react";
import { getSkill, isCustomerSkill } from "../../lib/agentSkills";
import { skillLabel } from "../../lib/skillRouter";
import { loadBaselineTags } from "../../lib/teamGateClient";
import { listPendingApprovals } from "../../lib/teamStore";

export function BaselineEnvBoard({
  limit = 12,
  customerFacing = false,
}: {
  limit?: number;
  /** 办事产品：只展示办事技能中文名，隐藏 dom-probe 等 */
  customerFacing?: boolean;
}) {
  const [rows, setRows] = useState<{ id: string; label: string; staging?: string; prod?: string }[]>([]);
  const pending = listPendingApprovals();

  useEffect(() => {
    void loadBaselineTags().then((tags) => {
      const list = Object.entries(tags)
        .map(([id, t]) => ({
          id,
          label: skillLabel(getSkill(id) ?? { name: id, description: id }),
          staging: t.staging,
          prod: t.prod,
        }))
        .filter((r) => r.staging || r.prod)
        .filter((r) => (customerFacing ? isCustomerSkill(r.id) && !r.id.endsWith("-flow-desk") : true))
        .slice(0, limit);
      setRows(list);
    });
  }, [limit, customerFacing]);

  if (!rows.length && !pending.length) {
    return (
      <p className="oa-skill-baseline-empty">
        尚无环境版本标记。发版检查通过后，可在技能详情里标记预发/线上（需 API 服务）。
      </p>
    );
  }

  return (
    <div className="oa-baseline-board">
      {pending.length ? (
        <p className="oa-baseline-pending">待审批 {pending.length} 条（与团队队列并行，以服务端为准）。</p>
      ) : null}
      {rows.length ? (
        <table className="oa-baseline-table">
          <thead>
            <tr>
              <th>技能</th>
              <th>预发</th>
              <th>线上</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.label}</td>
                <td>{r.staging ? `v${r.staging}` : "—"}</td>
                <td>{r.prod ? `v${r.prod}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : customerFacing ? (
        <p className="oa-skill-baseline-empty">办事技能暂无环境标记（正常：先在发版检查里验证）。</p>
      ) : null}
    </div>
  );
}
