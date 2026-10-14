import { useCallback, useEffect, useState } from "react";
import { apiUrl, checkBackendHealth } from "../../../lib/apiClient";

/** 客户可见：按业务场景入口，不出现技能 ID / 技术名词 */
const SCENARIOS = [
  {
    id: "reconcile",
    title: "费用与对账",
    outcome: "汇总报销、对照发票，标出不一致项",
    example: "按部门汇总报销表，标出和发票对不上的",
  },
  {
    id: "ticket",
    title: "客服工单",
    outcome: "分派坐席、检查时效，列出临期与升级工单",
    example: "把这批工单分派一下，看看哪些快超时了",
  },
  {
    id: "shift",
    title: "门店排班",
    outcome: "按技能和用工规则排班，检查缺口并计算成本",
    example: "按员工表和班次需求排一下下周的班",
  },
] as const;

export function ProductSkillHome({
  onRun,
  disabled,
}: {
  onRun: (query: string) => void;
  disabled?: boolean;
}) {
  const [ready, setReady] = useState<boolean | null>(null);
  const healthUrl = apiUrl("/health");

  const refresh = useCallback(() => {
    setReady(null);
    void checkBackendHealth(true).then((h) => setReady(Boolean(h?.ok)));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const blocked = disabled || ready !== true;

  return (
    <div className="aw-root aw-product-home">
      <header className="aw-product-home-head">
        <h2>开始办事</h2>
        <p>用日常业务语言描述需求即可。若需要您的表或文件，系统会在办理过程中提示上传。</p>
        {ready === false ? (
          <p className="aw-product-api-warn" role="alert">
            办事服务未连通，入口已停用。检测地址 <code>{healthUrl}</code>
            。这和接入里的大模型 Key 不是同一条连接：Key 测通也不会代替这个接口。
            <button type="button" className="aw-product-api-retry" onClick={refresh}>
              重新检测
            </button>
          </p>
        ) : null}
      </header>
      <div className="aw-product-examples">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="aw-product-ex"
            aria-label={s.title}
            disabled={blocked}
            onClick={() => onRun(s.example)}
          >
            <strong>{s.title}</strong>
            <span className="aw-product-ex-outcome">{s.outcome}</span>
            <span className="aw-product-ex-sample">可以这样说：{s.example}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
