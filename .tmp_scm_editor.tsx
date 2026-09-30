import { useMemo, useState } from "react";
import {
  caseFromSkillSteps,
  deleteCustomCase,
  listAllCasesForSkill,
  saveCustomCase,
  type CustomSkillTraceCase,
} from "../../lib/skillTraceCaseStore";
import { SKILL_TRACE_CASES, type SkillTraceCase } from "../../lib/provingGround";
import type { OutcomeGrader } from "../../lib/scmOutcome";
import { allRunnableSkills, getSkill, type AgentSkill, type SkillTraceStep } from "../../lib/agentSkills";
import { routeQuery, skillLabel } from "../../lib/skillRouter";
import { catalogWith } from "../../lib/skillImpact";
import { parseSkillMarkdown } from "../../lib/skillMarkdown";
import {
  catchPhrase,
  draftCatches,
  graspAgainst,
  rivalName,
  weekQueriesForSkill,
  type GraspSide,
} from "../../lib/skillSentence";
import { suggestCaseFromTrace, applyTraceSuggestion } from "../../lib/traceCaseSuggest";

const GRADERS: { id: OutcomeGrader["kind"]; label: string }[] = [
  { id: "skeleton", label: "姝ラ瑕佸涓? },
  { id: "all_ok", label: "姣忔閮芥垚鍔? },
  { id: "release_overall", label: "鎬荤粨鏋滈€氳繃" },
  { id: "min_steps", label: "鑷冲皯璧板畬鍑犳" },
];

function graderLabel(kind: OutcomeGrader["kind"] | undefined) {
  return GRADERS.find((g) => g.id === kind)?.label ?? "姝ラ瑕佸涓?;
}

function isCustom(row: SkillTraceCase): row is CustomSkillTraceCase {
  return "custom" in row && row.custom === true;
}

function urlIn(query: string) {
  const hit = query.match(/https?:\/\/[^\s]+/i)?.[0];
  return hit?.replace(/[),銆傦紝銆乚+$/u, "");
}

export function ScmCaseEditor({
  skillId,
  onChanged,
  onAsk,
  onClaim,
  draftRaw,
  fromTrace,
}: {
  skillId: string;
  onChanged: () => void;
  /** 甯︾潃杩欏彞鍘诲璇濋噷闂?*/
  onAsk?: (query: string) => void;
  /** 鎶婃娊鍑虹殑璇存硶鍐欒繘鎶€鑳借崏绋?*/
  onClaim?: (phrase: string) => void;
  draftRaw?: string;
  fromTrace?: { query: string; trace: SkillTraceStep[] };
}) {
  const skill = getSkill(skillId);
  const catalog = useMemo(() => {
    const live = allRunnableSkills();
    return draftRaw ? catalogWith(skillId, draftRaw, live) : live;
  }, [skillId, draftRaw]);
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [showRule, setShowRule] = useState(false);
  const [grader, setGrader] = useState<OutcomeGrader["kind"]>("skeleton");
  const [minSteps, setMinSteps] = useState(2);
  const cases = useMemo(() => listAllCasesForSkill(skillId, SKILL_TRACE_CASES), [skillId, tick]);
  const mine = cases.filter(isCustom).length;
  const week = useMemo(
    () => weekQueriesForSkill(skillId).filter((q) => !cases.some((c) => c.query.trim() === q)),
    [skillId, cases],
  );

  function buildGrader(kind = grader, count = minSteps): OutcomeGrader {
    if (kind === "release_overall") return { kind: "release_overall", min: "pass" };
    if (kind === "min_steps") return { kind: "min_steps", count };
    if (kind === "all_ok") return { kind: "all_ok" };
    return { kind: "skeleton" };
  }

  function bump(message: string) {
    setTick((n) => n + 1);
    setHint(message);
    onChanged();
  }

  function addFromTrace() {
    if (!fromTrace) return;
    const suggestion = suggestCaseFromTrace(skillId, fromTrace.query, fromTrace.trace);
    if (!suggestion) {
      setHint("杩欐澶勭悊璁板綍閲屾病鏈夎兘鍙樻垚闂鐨勯棶娉?);
      return;
    }
    applyTraceSuggestion(skillId, suggestion);
    bump("宸叉妸鍒氭墠閭ｆ闂硶鍔犺繘鏉?);
  }

  function addCase() {
    const text = query.trim();
    if (!text) return;
    if (!skill?.steps.length) {
      setHint("杩欎釜鎶€鑳借繕娌℃湁姝ラ銆傚厛鍒般€岀紪杈戙€嶅啓濂斤紝鍐嶅姞闂銆?);
      return;
    }
    if (cases.some((c) => c.query.trim() === text)) {
      setHint("杩欏彞宸茬粡鍦ㄤ笅闈簡");
      return;
    }
    const row = caseFromSkillSteps(
      skillId,
      text,
      skill.steps.map((s) => ({ id: s.id, tool: s.tool })),
      { grader: buildGrader(), probeUrl: urlIn(text) },
    );
    saveCustomCase(row);
    setQuery("");
    bump(claimMessage(text));
  }

  function claimMessage(text: string) {
    const triggers = parseSkillMarkdown(draftRaw ?? skill?.manifest ?? "").triggers;
    if (draftCatches(text, skillId, catalog)) return "宸插姞涓娿€傝繖鍙ュ綊杩欎釜鎶€鑳斤紝鍙戠増鏃朵細闂€?;
    const rival = rivalName(text, skillId, catalog);
    if (rival) return `宸插姞涓娿€傝繖鍙ヨ瘽鐜板湪鏇翠細浜ょ粰銆?{rival}銆嶃€傛瘮涓€姣旇皝绛斿緱杩囷紝鍐嶅喅瀹氭帴涓嶆帴浣忋€俙;
    const phrase = catchPhrase(text, triggers);
    if (phrase && onClaim) {
      onClaim(phrase);
      return `宸插姞涓婏紝骞跺啓杩涜娉曘€?{phrase}銆嶃€傝繖鍙ョ幇鍦ㄥ綊杩欎釜鎶€鑳姐€俙;
    }
    return "宸插姞涓娿€備笅娆″彂鐗堟鏌ヤ細闂繖鍙ャ€?;
  }

  function adoptWeek(text: string) {
    if (!skill?.steps.length) return;
    if (cases.some((c) => c.query.trim() === text)) return;
    const row = caseFromSkillSteps(
      skillId,
      text,
      skill.steps.map((s) => ({ id: s.id, tool: s.tool })),
      { grader: buildGrader(), probeUrl: urlIn(text) },
    );
    saveCustomCase(row);
    bump(claimMessage(text));
  }

  function changeRule(row: CustomSkillTraceCase, kind: OutcomeGrader["kind"], count?: number) {
    saveCustomCase({ ...row, grader: buildGrader(kind, count ?? minSteps) });
    setTick((n) => n + 1);
    onChanged();
  }

  return (
    <div className="own-qbank">
      <form
        className="own-qbank-add"
        onSubmit={(e) => {
          e.preventDefault();
          addCase();
        }}
      >
        <label htmlFor={`qbank-${skillId}`}>鍐欎竴鍙ュ鎴蜂細闂殑璇?/label>
        <div className="own-qbank-compose">
          <input
            id={`qbank-${skillId}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="渚嬪锛氬府鎴戝贰妫€ https://example.com 鑳藉惁涓婄嚎"
          />
          <button type="submit" disabled={!query.trim()}>
            鍔犱笂
          </button>
        </div>
        <div className="own-qbank-tools">
          <button type="button" className="own-qbank-quiet" onClick={() => setShowRule((v) => !v)}>
            {showRule ? "鏀惰捣绛斿鏍囧噯" : "鎬庢牱绠楃瓟瀵?}
          </button>
          {fromTrace?.trace.length ? (
            <button type="button" className="own-qbank-quiet" onClick={addFromTrace}>
              鐢ㄥ垰鎵嶉偅娆￠棶娉?            </button>
          ) : null}
        </div>
        {showRule ? (
          <div className="own-qbank-rule">
            <span>鏂板姞鐨勯锛岃繖鏍风畻绛斿</span>
            <select value={grader} onChange={(e) => setGrader(e.target.value as OutcomeGrader["kind"])}>
              {GRADERS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
            {grader === "min_steps" ? (
              <input
                type="number"
                min={1}
                value={minSteps}
                aria-label="鏈€灏戞鏁?
                onChange={(e) => setMinSteps(Number(e.target.value))}
              />
            ) : null}
          </div>
        ) : null}
      </form>

      {hint ? <p className="own-qbank-hint">{hint}</p> : null}

      <p className="own-qbank-count">
        鍙戠増鏃朵細闂繖 {cases.length} 鍙mine ? `锛屽叾涓?${mine} 鍙ユ槸浣犲姞鐨刞 : ""}銆傝繖鍛ㄥ鎴风湡闂繃銆佽繕娌¤涓嬬殑锛屼篃浼氭尅鍙戝竷銆?      </p>

      {week.length ? (
        <div className="own-week">
          <p>杩欏懆瀹㈡埛闂繃锛岃繕娌℃敹杩涘繀闂?/p>
          <ul>
            {week.map((q) => (
              <li key={q}>
                <span>{q}</span>
                <button type="button" onClick={() => adoptWeek(q)}>鏀惰繘蹇呴棶</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {cases.length ? (
        <ul className="own-qbank-list">
          {cases.map((row) => (
            <QuestionRow
              key={row.id}
              skillId={skillId}
              catalog={catalog}
              triggers={parseSkillMarkdown(draftRaw ?? skill?.manifest ?? "").triggers}
              row={row}
              onAsk={onAsk}
              onClaim={onClaim}
              onDelete={() => {
                deleteCustomCase(skillId, row.id);
                bump("宸插垹鎺夈€傚彂鐗堟鏌ヤ笉鍐嶉棶杩欏彞銆?);
              }}
              onRule={(kind, count) => {
                if (!isCustom(row)) return;
                changeRule(row, kind, count);
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="own-qbank-empty">杩樻病鏈夐棶棰樸€傚啓涓€鍙ュ鎴蜂細闂殑璇濓紝鍙戠増鏃跺氨鐢ㄥ畠妫€鏌ャ€?/p>
      )}
    </div>
  );
}

function QuestionRow({
  skillId,
  catalog,
  triggers,
  row,
  onAsk,
  onClaim,
  onDelete,
  onRule,
}: {
  skillId: string;
  catalog: AgentSkill[];
  triggers: string[];
  row: SkillTraceCase;
  onAsk?: (query: string) => void;
  onClaim?: (phrase: string) => void;
  onDelete: () => void;
  onRule: (kind: OutcomeGrader["kind"], count?: number) => void;
}) {
  const who = routeQuery(row.query, catalog);
  const mine = isCustom(row);
  const kind = row.grader?.kind ?? "skeleton";
  const matched = who.kind === "skill" && who.skillId === skillId;
  const elsewhere = who.kind === "skill" && who.skillId !== skillId;
  const phrase = matched ? null : catchPhrase(row.query, triggers);
  const [racing, setRacing] = useState(false);
  const [race, setRace] = useState<GraspSide[] | null>(null);

  async function compare() {
    setRacing(true);
    try {
      setRace(await graspAgainst(row.query, skillId, catalog));
    } finally {
      setRacing(false);
    }
  }

  return (
    <li className={mine ? "is-mine" : "is-builtin"}>
      <div className="own-qbank-top">
        <p>{row.query}</p>
        {onAsk ? (
          <button type="button" onClick={() => onAsk(row.query)}>
            鍘诲璇濋噷闂?          </button>
        ) : null}
      </div>
      {!matched && phrase && onClaim ? (
        <button type="button" className="own-qbank-claim" onClick={() => onClaim(phrase)}>
          鐢ㄣ€寋phrase}銆嶆帴浣忚繖鍙?        </button>
      ) : null}
      <button type="button" className="own-qbank-quiet" disabled={racing} onClick={() => void compare()}>
        {racing ? "姝ｅ湪涓よ竟鍚勮窇涓€閬嶁€? : "姣斾竴姣旇皝鏇磋兘绛斿"}
      </button>
      {race ? (
        <ul className="own-grasp">
          {race.map((s) => (
            <li key={s.id} className={s.pass ? "is-pass" : ""}>
              <strong>{s.label}</strong>
              <span>{s.total ? `${s.ok}/${s.total} 姝ユ垚鍔焋 : "璺戜笉璧锋潵"}{s.pass ? " 路 杩欏彞鑳借繃" : " 路 杩欏彞杩囦笉浜?}</span>
              {s.here && !matched && phrase && onClaim ? (
                <button type="button" onClick={() => onClaim(phrase)}>褰掕繖涓妧鑳?/button>
              ) : null}
              {s.here && matched ? <em>灏辨槸鐜板湪杩欏</em> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="own-qbank-meta">
        <span>{mine ? "浣犲姞鐨? : "鑷甫"}</span>
        {mine ? (
          <select
            aria-label="鎬庢牱绠楃瓟瀵?
            value={kind}
            onChange={(e) => onRule(e.target.value as OutcomeGrader["kind"], row.grader?.kind === "min_steps" ? row.grader.count : undefined)}
          >
            {GRADERS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        ) : (
          <span>{graderLabel(kind)}</span>
        )}
        {elsewhere ? <span>鐜板湪浼氫氦缁檣who.label}</span> : null}
        {who.kind !== "skill" ? <span>杩樻病鏈夋妧鑳戒細鎺?/span> : null}
        {mine ? (
          <button type="button" onClick={onDelete}>
            鍒犻櫎
          </button>
        ) : null}
      </div>
      {elsewhere ? <small>鐜板湪浼氫氦缁檣skillLabel(who.skill ?? { name: who.label, description: who.label })}銆傛瘮瀹屽啀鍐冲畾瑕佷笉瑕佺敤涓€鍙ヨ瘽鎺ュ洖鏉ャ€?/small> : null}
      {who.kind !== "skill" ? <small>杩樻病鏈夋妧鑳戒細鎺ャ€傜敤涓婇潰鎶藉嚭鐨勮娉曟帴浣忥紝鍙戠増鎵嶄細闂埌杩欏彞銆?/small> : null}
    </li>
  );
}
