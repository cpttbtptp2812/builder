import { useMemo, useState } from "react";
import { getLiveCatalog } from "../../lib/agentSkills";
import { routeQuery, skillLabel } from "../../lib/skillRouter";
import { OaBtn, OaPage } from "./OaUi";

/** 发版前试一句：对话会把这句话交给哪个技能 */
export function RouteForkPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const [probe, setProbe] = useState("上线");
  const [asked, setAsked] = useState("");

  const presets = useMemo(
    () => [
      "上线",
      "帮我看看 https://example.com 能不能上线",
      "怎么收费",
      "满一年年假几天",
    ],
    [],
  );

  const decision = asked.trim() ? routeQuery(asked.trim()) : null;
  const ranked = decision?.ranked.filter((row) => row.score > 0).slice(0, 3) ?? [];
  const catalog = getLiveCatalog();

  return (
    <OaPage
      chrome={!embedded}
      title="这句话交给谁"
      desc="发版前试一句客户会说的话。这里的判断和对话是同一套：能接就告诉你是哪个技能，接不上就去那个技能里补上这句说法。"
    >
      <div className="oa-fork-probe">
        <label>
          客户会怎么问
          <textarea
            rows={2}
            value={probe}
            onChange={(e) => setProbe(e.target.value)}
            placeholder="例如：这个地址能不能上线"
          />
        </label>
        <div className="oa-fork-chips">
          {presets.map((p) => (
            <button key={p} type="button" className={probe === p ? "on" : ""} onClick={() => setProbe(p)}>
              {p}
            </button>
          ))}
        </div>
        <OaBtn onClick={() => setAsked(probe.trim())} disabled={!probe.trim()}>
          查看会交给谁
        </OaBtn>
      </div>

      {decision ? (
        <section className={`oa-fork-answer${decision.kind === "skill" ? " is-hit" : " is-miss"}`}>
          {decision.kind === "skill" ? (
            <>
              <p className="oa-fork-answer-kicker">对话会交给</p>
              <h2>{decision.label}</h2>
              <p>{decision.rule}</p>
            </>
          ) : (
            <>
              <p className="oa-fork-answer-kicker">还没有技能会接</p>
              <h2>这句话进了对话，不会交给下面任何一个技能</h2>
              <p>
                {ranked[0]
                  ? `「${skillLabel(ranked[0].skill)}」听到了「${ranked[0].hits.join("、")}」，但还不够把它接过去。把客户会说的整句写到该技能的触发说法里。`
                  : "到对应技能里，把客户会说的这句加进触发说法，然后再来试一次。"}
              </p>
            </>
          )}
          {ranked.length > 1 ? (
            <ul className="oa-fork-also">
              {ranked.map((row) => (
                <li key={row.skill.id}>
                  <strong>{skillLabel(row.skill)}</strong>
                  <span>听到 {row.hits.join("、")}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="oa-fork-catalog">
        <h3>现在可以接手的技能（{catalog.length}）</h3>
        <ul>
          {catalog.map((s) => (
            <li key={s.id}>
              <strong>{skillLabel(s)}</strong>
              <span>{s.triggers.slice(0, 6).join("、")}</span>
            </li>
          ))}
        </ul>
      </section>
    </OaPage>
  );
}
