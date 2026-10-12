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
    id: "credit",
    title: "授信与额度",
    outcome: "按规则测算可批额度与要点说明",
    example: "测算这笔授信额度",
  },
  {
    id: "contract",
    title: "合同审查",
    outcome: "抽取条款、对照制度给出风险提示",
    example: "审查这份借款合同",
  },
  {
    id: "flow",
    title: "流程查询",
    outcome: "查询单据当前环节与待办",
    example: "市场部9600报销单现在走到哪",
  },
  {
    id: "image",
    title: "单据识读",
    outcome: "从影像提取字段并结构化",
    example: "识别这份借款凭证影像",
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
            disabled={blocked}
            onClick={() => onRun(s.example)}
          >
            <strong>{s.title}</strong>
            <span className="aw-product-ex-outcome">{s.outcome}</span>
            <span className="aw-product-ex-sample">示例：{s.example}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
