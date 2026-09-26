/**
 * 共形路由 — 给「这句话该交给谁」一个有统计保证的把握度。
 *
 * 1. 每个去向（做事类技能 / @answer 答案类）用若干示例句表示，问题与示例句算向量余弦，取每类最高分
 * 2. 温度缩放：在校准集的一半上拟合温度 T，使 softmax 概率不过度自信
 * 3. 分割共形预测（LAC）：在另一半上取非一致性分数 1 - p(真实类) 的 ⌈(n+1)(1-α)⌉/n 分位数 q̂，
 *    预测集 = { c : p(c) ≥ 1 - q̂ }，保证真实去向落在集合内的概率 ≥ 1 - α（只要求数据可交换）
 * 4. 共形离群检测：问题与所有示例的最高相似度，若低于 95% 的正常问题，判为超出范围
 *
 * 集合只有 1 个 → 直接执行；2–3 个 → 反问用户；空集或超出范围 → 交给通用流程。
 */

import { allRunnableSkills, ANSWER_LAYER_SKILL_ID } from "./agentSkills";
import { cosine, lexicalEmbedder, loadSemanticEmbedder, type Embedder, type EmbedderKind, type LoadProgress } from "./embedder";
import { listKnowledgeDocs } from "./ownKnowledge";
import { PRODUCT_FAQ } from "../data/productFaq";
import { ROUTE_CALIBRATION, ROUTE_OOD, type CalibrationCase } from "../data/routeCalibration";
import { skillDisplayTitle, skillSubtitle } from "../components/ownagent/skillVerUi";

export const ANSWER_CLASS = "@answer";
export const ROUTER_EVENT = "ownagent:router-updated";
const FEEDBACK_KEY = "ownagent:route-feedback";
const ALPHA_KEY = "ownagent:route-alpha";
const OOD_ALPHA = 0.05;
const ANSWER_SKILLS = new Set([ANSWER_LAYER_SKILL_ID]);

export type RouteClass = { id: string; label: string; hint: string; exemplars: string[] };

export type RouteCandidate = { id: string; label: string; hint: string; p: number };

export type RouteVerdict = {
  status: "confident" | "ambiguous" | "unsure" | "ood";
  set: RouteCandidate[];
  top: RouteCandidate;
  alpha: number;
  embedder: EmbedderKind;
  /** 与正常问题相比的「像不像」p 值，越小越像超出范围 */
  inScopeP: number;
};

export type RouterStats = {
  alpha: number;
  embedder: EmbedderKind;
  temperature: number;
  n: number;
  coverage: number;
  avgSetSize: number;
  singletonRate: number;
  singletonAccuracy: number;
  top1Accuracy: number;
  /** 只看最高分概率 ≥ 1-α 时的实际准确率 —— 对照组，体现不校准的风险 */
  naiveConfidentAccuracy: number;
  naiveConfidentRate: number;
  oodDetected: number;
  oodFalseAlarm: number;
};

/* ───────── 数据 ───────── */

function readPlazaQuestions(): string[] {
  for (const key of ["oa-feed-local", "oa-feed-cache"]) {
    try {
      const rows = JSON.parse(localStorage.getItem(key) || "[]") as { question?: string }[];
      const qs = rows.map((r) => r.question?.trim() ?? "").filter(Boolean);
      if (qs.length) return qs;
    } catch {
      /* ignore */
    }
  }
  return [];
}

export function buildRouteClasses(): RouteClass[] {
  const skills = allRunnableSkills();
  const classes: RouteClass[] = skills
    .filter((s) => !ANSWER_SKILLS.has(s.id))
    .map((s) => ({
      id: s.id,
      label: skillDisplayTitle(s),
      hint: skillSubtitle(s),
      exemplars: [skillDisplayTitle(s), s.description, ...s.triggers].filter((t) => t.trim().length > 0),
    }));
  const answerSkillTriggers = skills.filter((s) => ANSWER_SKILLS.has(s.id)).flatMap((s) => s.triggers);
  classes.push({
    id: ANSWER_CLASS,
    label: "查现成答案",
    hint: "产品介绍、价格、使用问题、知识广场里的问答",
    exemplars: [
      ...PRODUCT_FAQ.map((f) => f.q),
      ...readPlazaQuestions(),
      ...listKnowledgeDocs().map((d) => d.title),
      ...answerSkillTriggers,
      "这个网站是干嘛的",
      "介绍一下你们",
    ],
  });
  return classes;
}

export function readRouteFeedback(): CalibrationCase[] {
  try {
    return (JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]") as CalibrationCase[]).filter((c) => c?.q && c?.label);
  } catch {
    return [];
  }
}

/** 用户在反问里选定的去向，成为新的校准数据（在线校准） */
export function recordRouteFeedback(q: string, label: string) {
  const rows = readRouteFeedback().filter((c) => c.q !== q);
  rows.push({ q, label });
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(rows.slice(-200)));
  invalidateRouter();
}

export function getRouteAlpha(): number {
  const v = Number(localStorage.getItem(ALPHA_KEY));
  return v > 0 && v < 0.5 ? v : 0.1;
}

export function setRouteAlpha(alpha: number) {
  localStorage.setItem(ALPHA_KEY, String(alpha));
  window.dispatchEvent(new CustomEvent(ROUTER_EVENT));
}

/* ───────── 数学 ───────── */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function softmax(logits: number[], T: number): number[] {
  const m = Math.max(...logits);
  const e = logits.map((l) => Math.exp((l - m) / T));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

/** 分割共形分位数：第 ⌈(n+1)(1-α)⌉ 小的分数；样本不够时返回 1（集合包含全部类） */
export function conformalQuantile(scores: number[], alpha: number): number {
  const n = scores.length;
  const k = Math.ceil((n + 1) * (1 - alpha));
  if (k > n || n === 0) return 1;
  return [...scores].sort((a, b) => a - b)[k - 1]!;
}

/* ───────── 路由器 ───────── */

type Scored = { logits: number[]; maxSim: number };
type LabeledScored = Scored & { y: number };

export class ConformalRouter {
  readonly embedderKind: EmbedderKind;
  readonly temperature: number;
  private readonly conf: LabeledScored[];
  private readonly qhatCache = new Map<number, number>();
  private readonly inScopeRef: number[];

  constructor(
    private readonly embedder: Embedder,
    readonly classes: RouteClass[],
    private readonly exemplarVecs: Float32Array[][],
    fit: LabeledScored[],
    conf: LabeledScored[],
    private readonly ood: Scored[],
  ) {
    this.embedderKind = embedder.kind;
    this.temperature = ConformalRouter.fitTemperature(fit);
    this.conf = conf;
    this.inScopeRef = conf.map((c) => c.maxSim).sort((a, b) => a - b);
  }

  /** 温度缩放：网格搜索使校准集负对数似然最小 */
  static fitTemperature(rows: LabeledScored[]): number {
    if (!rows.length) return 0.05;
    let best = { T: 0.05, nll: Infinity };
    for (let i = 0; i <= 48; i++) {
      const T = 0.004 * Math.pow(100, i / 48);
      let nll = 0;
      for (const r of rows) nll -= Math.log(Math.max(1e-12, softmax(r.logits, T)[r.y]!));
      if (nll < best.nll) best = { T, nll };
    }
    return best.T;
  }

  /** exclude：拟合温度时排除句子自身，避免拿自己比自己导致过度自信 */
  scoreVec(v: Float32Array, exclude?: Float32Array): Scored {
    const logits = this.exemplarVecs.map((vecs) => {
      let best = -1;
      for (const e of vecs) if (e !== exclude) best = Math.max(best, cosine(v, e));
      return best;
    });
    return { logits, maxSim: Math.max(...logits) };
  }

  private qhat(alpha: number): number {
    let q = this.qhatCache.get(alpha);
    if (q == null) {
      q = conformalQuantile(
        this.conf.map((c) => 1 - softmax(c.logits, this.temperature)[c.y]!),
        alpha,
      );
      this.qhatCache.set(alpha, q);
    }
    return q;
  }

  private inScopeP(maxSim: number): number {
    const below = this.inScopeRef.filter((s) => s <= maxSim).length;
    return (1 + below) / (this.inScopeRef.length + 1);
  }

  verdictFor(s: Scored, alpha: number): RouteVerdict {
    const p = softmax(s.logits, this.temperature);
    const cands = this.classes
      .map((c, i) => ({ id: c.id, label: c.label, hint: c.hint, p: p[i]! }))
      .sort((a, b) => b.p - a.p);
    const q = this.qhat(alpha);
    const set = cands.filter((c) => 1 - c.p <= q);
    const inScopeP = this.inScopeP(s.maxSim);
    const status: RouteVerdict["status"] =
      inScopeP < OOD_ALPHA ? "ood" : set.length === 1 ? "confident" : set.length >= 2 && set.length <= 3 ? "ambiguous" : "unsure";
    return { status, set, top: cands[0]!, alpha, embedder: this.embedderKind, inScopeP };
  }

  async decide(query: string, alpha = getRouteAlpha()): Promise<RouteVerdict> {
    const [v] = await this.embedder.embed([query]);
    return this.verdictFor(this.scoreVec(v!), alpha);
  }

  /** 反复随机切分校准集 → 测试集上的实测覆盖率等指标 */
  stats(alpha: number, rounds = 200): RouterStats {
    const rand = mulberry32(7);
    const T = this.temperature;
    const acc = { cov: 0, size: 0, single: 0, singleOk: 0, singleN: 0, top1: 0, naiveOk: 0, naiveN: 0, total: 0 };
    for (let r = 0; r < rounds; r++) {
      const rows = shuffle(this.conf, rand);
      const half = Math.floor(rows.length / 2);
      const cal = rows.slice(0, half);
      const test = rows.slice(half);
      const q = conformalQuantile(cal.map((c) => 1 - softmax(c.logits, T)[c.y]!), alpha);
      for (const t of test) {
        const p = softmax(t.logits, T);
        const set = p.map((x, i) => [x, i] as const).filter(([x]) => 1 - x <= q);
        const top = p.indexOf(Math.max(...p));
        acc.total += 1;
        acc.cov += set.some(([, i]) => i === t.y) ? 1 : 0;
        acc.size += set.length;
        acc.top1 += top === t.y ? 1 : 0;
        if (set.length === 1) {
          acc.singleN += 1;
          acc.singleOk += set[0]![1] === t.y ? 1 : 0;
        }
        if (p[top]! >= 1 - alpha) {
          acc.naiveN += 1;
          acc.naiveOk += top === t.y ? 1 : 0;
        }
      }
    }
    const ratio = (a: number, b: number) => (b ? a / b : 0);
    return {
      alpha,
      embedder: this.embedderKind,
      temperature: T,
      n: this.conf.length,
      coverage: ratio(acc.cov, acc.total),
      avgSetSize: ratio(acc.size, acc.total),
      singletonRate: ratio(acc.singleN, acc.total),
      singletonAccuracy: ratio(acc.singleOk, acc.singleN),
      top1Accuracy: ratio(acc.top1, acc.total),
      naiveConfidentAccuracy: ratio(acc.naiveOk, acc.naiveN),
      naiveConfidentRate: ratio(acc.naiveN, acc.total),
      oodDetected: ratio(this.ood.filter((o) => this.inScopeP(o.maxSim) < OOD_ALPHA).length, this.ood.length),
      oodFalseAlarm: ratio(this.conf.filter((c) => this.inScopeP(c.maxSim) < OOD_ALPHA).length, this.conf.length),
    };
  }

  static async build(embedder: Embedder): Promise<ConformalRouter> {
    const classes = buildRouteClasses();
    const index = new Map(classes.map((c, i) => [c.id, i]));
    const exemplarVecs: Float32Array[][] = [];
    for (const c of classes) exemplarVecs.push(await embedder.embed(c.exemplars));

    const labeled = [...ROUTE_CALIBRATION, ...readRouteFeedback()].filter((c) => index.has(c.label));
    const vecs = await embedder.embed(labeled.map((c) => c.q));
    const oodVecs = await embedder.embed(ROUTE_OOD);

    // 分层切分：40% 作训练（补充为示例句 + 拟合温度），60% 做共形校准，两份互不重叠
    const rand = mulberry32(42);
    const train: { v: Float32Array; y: number }[] = [];
    const calib: { v: Float32Array; y: number }[] = [];
    for (let y = 0; y < classes.length; y++) {
      const rows = shuffle(
        labeled.map((c, i) => ({ v: vecs[i]!, y: index.get(c.label)! })).filter((r) => r.y === y),
        rand,
      );
      const k = Math.round(rows.length * 0.4);
      train.push(...rows.slice(0, k));
      calib.push(...rows.slice(k));
    }
    for (const t of train) exemplarVecs[t.y]!.push(t.v);

    const tmp = new ConformalRouter(embedder, classes, exemplarVecs, [], [], []);
    const fit = train.map((t) => ({ ...tmp.scoreVec(t.v, t.v), y: t.y }));
    const conf = calib.map((c) => ({ ...tmp.scoreVec(c.v), y: c.y }));
    return new ConformalRouter(embedder, classes, exemplarVecs, fit, conf, oodVecs.map((v) => tmp.scoreVec(v)));
  }
}

/* ───────── 单例 ───────── */

let current: Promise<ConformalRouter> | null = null;
let semanticState: { status: "idle" | "loading" | "ready" | "error"; progress?: LoadProgress; error?: string } = { status: "idle" };

export function semanticStatus() {
  return semanticState;
}

function activeEmbedder(): Promise<Embedder> {
  return semanticState.status === "ready" ? loadSemanticEmbedder() : Promise.resolve(lexicalEmbedder);
}

export function getConformalRouter(): Promise<ConformalRouter> {
  current ??= activeEmbedder().then((e) => ConformalRouter.build(e));
  current.catch(() => {
    current = null;
  });
  return current;
}

export function invalidateRouter() {
  current = null;
  window.dispatchEvent(new CustomEvent(ROUTER_EVENT));
}

/** 加载语义模型（约 24MB，首次下载后浏览器缓存），成功后路由器自动切换 */
export function upgradeToSemantic(): Promise<void> {
  if (semanticState.status === "ready" || semanticState.status === "loading") return Promise.resolve();
  semanticState = { status: "loading" };
  window.dispatchEvent(new CustomEvent(ROUTER_EVENT));
  return loadSemanticEmbedder((progress) => {
    semanticState = { status: "loading", progress };
    window.dispatchEvent(new CustomEvent(ROUTER_EVENT));
  })
    .then(() => {
      semanticState = { status: "ready" };
      invalidateRouter();
      void getConformalRouter();
    })
    .catch((e: unknown) => {
      semanticState = { status: "error", error: e instanceof Error ? e.message : "加载失败" };
      window.dispatchEvent(new CustomEvent(ROUTER_EVENT));
    });
}
