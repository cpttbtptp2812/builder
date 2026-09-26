import { useEffect, useMemo, useState } from "react";
import {
  getConformalRouter,
  getRouteAlpha,
  readRouteFeedback,
  ROUTER_EVENT,
  semanticStatus,
  setRouteAlpha,
  upgradeToSemantic,
  type ConformalRouter,
  type RouteVerdict,
  type RouterStats,
} from "../../lib/conformalRouter";
import { SKILL_PUBLISH_EVENT } from "../../lib/skillCompareStore";

const ALPHAS = [0.2, 0.1, 0.05];
const pct = (x: number) => `${Math.round(x * 100)}%`;

const STATUS_TEXT: Record<RouteVerdict["status"], string> = {
  confident: "直接交给它",
  ambiguous: "先反问用户",
  unsure: "候选太多，走通用流程",
  ood: "不像任何一类，走通用流程",
};

/** 路由把握度 — 共形预测给出「交给谁」的候选集，并实测它是否兑现了承诺的覆盖率 */
export function RouteConfidencePanel() {
  const [open, setOpen] = useState(false);
  const [router, setRouter] = useState<ConformalRouter | null>(null);
  const [alpha, setAlpha] = useState(getRouteAlpha);
  const [model, setModel] = useState(semanticStatus);
  const [probe, setProbe] = useState("");
  const [verdict, setVerdict] = useState<RouteVerdict | null>(null);

  useEffect(() => {
    let alive = true;
    const sync = () => {
      setModel({ ...semanticStatus() });
      void getConformalRouter().then((r) => alive && setRouter(r));
    };
    sync();
    window.addEventListener(ROUTER_EVENT, sync);
    window.addEventListener(SKILL_PUBLISH_EVENT, sync);
    return () => {
      alive = false;
      window.removeEventListener(ROUTER_EVENT, sync);
      window.removeEventListener(SKILL_PUBLISH_EVENT, sync);
    };
  }, []);

  const stats: RouterStats | null = useMemo(() => (router ? router.stats(alpha) : null), [router, alpha]);

  useEffect(() => {
    if (!router || !probe.trim()) {
      setVerdict(null);
      return;
    }
    let alive = true;
    const t = window.setTimeout(() => {
      void router.decide(probe.trim(), alpha).then((v) => alive && setVerdict(v));
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [router, probe, alpha]);

  function pickAlpha(a: number) {
    setRouteAlpha(a);
    setAlpha(a);
  }

  const semantic = router?.embedderKind === "semantic";
  const loadPct =
    model.status === "loading" && model.progress?.total ? Math.round((model.progress.loaded / model.progress.total) * 100) : null;
  const feedbackN = readRouteFeedback().length;

  return (
    <section className="own-evo own-rc">
      <button type="button" className="own-evo-head" onClick={() => setOpen((v) => !v)}>
        <span className="own-evo-dot own-rc-dot" />
        <strong>路由把握度</strong>
        <span className="own-evo-sub">
          {stats
            ? `${semantic ? "语义模型" : "字符模型"} · 实测覆盖 ${pct(stats.coverage)}（承诺 ≥ ${pct(1 - alpha)}） · 直接执行 ${pct(stats.singletonRate)}`
            : "正在校准…"}
        </span>
        <span className="own-evo-toggle">{open ? "收起" : "查看"}</span>
      </button>

      {open && stats ? (
        <div className="own-evo-body">
          <p className="own-rc-lead">
            每句话会得到一组「可能的去向」，并保证正确去向落在这组里的概率不低于你设的目标。只剩一个就直接执行，剩两三个就先反问，而不是凭一个分数硬猜。
          </p>

          <div className="own-rc-row">
            <span>目标</span>
            <div className="own-rc-seg">
              {ALPHAS.map((a) => (
                <button key={a} type="button" className={a === alpha ? "is-on" : ""} onClick={() => pickAlpha(a)}>
                  {pct(1 - a)}
                </button>
              ))}
            </div>
            <span className="own-rc-model">
              {semantic ? (
                "语义模型 bge-small-zh · 本机运行"
              ) : model.status === "loading" ? (
                `语义模型下载中${loadPct != null ? ` ${loadPct}%` : "…"}`
              ) : (
                <>
                  字符模型（只认字面）
                  <button type="button" className="own-skm-batch-btn" onClick={() => void upgradeToSemantic()}>
                    {model.status === "error" ? "重试加载语义模型" : "加载语义模型 · 24MB"}
                  </button>
                </>
              )}
            </span>
          </div>

          <div className="own-rc-grid">
            <div>
              <b className={stats.coverage + 0.02 >= 1 - alpha ? "is-ok" : "is-warn"}>{pct(stats.coverage)}</b>
              <span>实测覆盖率</span>
              <small>正确去向在候选里的比例，承诺 ≥ {pct(1 - alpha)}</small>
            </div>
            <div>
              <b>{pct(stats.singletonRate)}</b>
              <span>直接执行</span>
              <small>其中做对 {pct(stats.singletonAccuracy)}</small>
            </div>
            <div>
              <b>{stats.avgSetSize.toFixed(1)}</b>
              <span>平均候选数</span>
              <small>越接近 1 越果断</small>
            </div>
            <div>
              <b>{pct(stats.oodDetected)}</b>
              <span>拦下无关问题</span>
              <small>误拦正常问题 {pct(stats.oodFalseAlarm)}</small>
            </div>
          </div>

          <p className="own-rc-note">
            对照：如果只看最高分 ≥ {pct(1 - alpha)} 就执行，能执行 {pct(stats.naiveConfidentRate)} 的问题，做对{" "}
            {pct(stats.naiveConfidentAccuracy)}；只选最高分则做对 {pct(stats.top1Accuracy)}。数据：{stats.n} 句校准
            {feedbackN ? ` · 其中 ${feedbackN} 句来自用户在反问里的选择` : ""}，随机切分 200 次取平均。
          </p>

          <div className="own-rc-try">
            <input value={probe} onChange={(e) => setProbe(e.target.value)} placeholder="试一句，看看会交给谁" />
            {verdict ? (
              <div className="own-rc-verdict">
                <strong>{STATUS_TEXT[verdict.status]}</strong>
                <ul>
                  {(verdict.set.length ? verdict.set : [verdict.top]).map((c) => (
                    <li key={c.id}>
                      <span>{c.label}</span>
                      <i style={{ width: `${Math.max(2, c.p * 100)}%` }} />
                      <em>{pct(c.p)}</em>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
