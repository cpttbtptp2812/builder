import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { apiUrl, checkBackendHealth } from "../../../lib/apiClient";

/** 客户可见：按业务场景入口，不出现技能 ID / 技术名词 */
const SCENARIOS = [
  {
    id: "reconcile",
    title: "费用与对账",
    outcome: "汇总报销、对照发票，标出不一致项",
    example: "按部门汇总报销表，标出和发票对不上的",
    accent: "#818cf8",
    glyph: "账",
  },
  {
    id: "ticket",
    title: "客服工单",
    outcome: "分派坐席、检查时效，列出临期与升级工单",
    example: "把这批工单分派一下，看看哪些快超时了",
    accent: "#38bdf8",
    glyph: "单",
  },
  {
    id: "shift",
    title: "门店排班",
    outcome: "按技能和用工规则排班，检查缺口并计算成本",
    example: "按员工表和班次需求排一下下周的班",
    accent: "#34d399",
    glyph: "班",
  },
] as const;

const PIPELINE = [
  { label: "受理", detail: "用业务语言描述需求" },
  { label: "材料", detail: "按门闩上传 CSV" },
  { label: "办理", detail: "服务端按技能执行" },
  { label: "交付", detail: "文书与多表明细" },
] as const;

const CAPABILITIES = ["报销对账", "工单分派", "排班核算"] as const;

export function ProductSkillHome({
  onRun,
  disabled,
  trial = false,
}: {
  onRun: (query: string) => void;
  disabled?: boolean;
  /** 客户自己试：点一下只把句子放进输入框 */
  trial?: boolean;
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
      {trial ? (
        <header className="aw-product-try" aria-labelledby="aw-product-title">
          <h1 id="aw-product-title">你想办哪一件？</h1>
          <p>点一项，句子放进输入框。改完再发送。没有你的表，会先请你上传。</p>
        </header>
      ) : (
        <section className="aw-product-hero" aria-labelledby="aw-product-title">
          <div className="aw-product-hero-inner">
            <div className="aw-product-hero-copy">
              <p className="aw-product-brand">OwnAgent</p>
              <h1 id="aw-product-title" className="aw-product-title">
                企业办事运行时
              </h1>
              <p className="aw-product-lead">
                自然语言受理，材料齐整后服务端执行；交付为多表文书，合计与结论随材料变化。
              </p>
              <ul className="aw-product-capabilities" aria-label="已上线办事类型">
                {CAPABILITIES.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="aw-product-hero-visual" aria-hidden>
              <ol className="aw-product-pipeline">
                {PIPELINE.map((p, i) => (
                  <li key={p.label}>
                    <span className="aw-product-pipeline-idx">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{p.label}</strong>
                      <span>{p.detail}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}

      {ready === null ? (
        <p className="aw-product-api-hint" aria-live="polite">
          {trial ? "正在连接…连上之后才能点。" : "正在连接办事服务…第一次打开会稍等，连上后才能开始办理。"}
        </p>
      ) : null}
      {ready === false ? (
        <p className="aw-product-api-warn" role="alert">
          {trial ? (
            "暂时连不上，先不能点。这和你的模型密钥不是一回事。"
          ) : (
            <>
              办事服务未连通，入口已停用。检测地址 <code>{healthUrl}</code>
              。这与接入配置中的大模型 Key 无关。
            </>
          )}
          <button type="button" className="aw-product-api-retry" onClick={refresh}>
            重新检测
          </button>
        </p>
      ) : null}

      <section className="aw-product-scenarios" aria-labelledby={trial ? "aw-product-title" : "aw-product-scenarios-title"}>
        {trial ? null : (
          <header className="aw-product-scenarios-head">
            <h2 id="aw-product-scenarios-title">业务入口</h2>
            <p>选择类型后，示例会填入下方输入框，可编辑再发送。</p>
          </header>
        )}
        <div className="aw-product-examples">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="aw-product-ex"
              style={{ "--ex-accent": s.accent } as CSSProperties}
              aria-label={s.title}
              disabled={blocked}
              onClick={() => onRun(s.example)}
            >
              <span className="aw-product-ex-glyph">{s.glyph}</span>
              <span className="aw-product-ex-body">
                <strong>{s.title}</strong>
                <span className="aw-product-ex-outcome">{s.outcome}</span>
                <span className="aw-product-ex-sample">{s.example}</span>
              </span>
              <span className="aw-product-ex-go" aria-hidden>
                {trial ? "放入" : "→"}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
