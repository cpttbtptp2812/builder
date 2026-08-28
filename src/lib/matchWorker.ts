const WORKER_SRC = `
const CATALOG = [
  { id: "w1", title: "批量改价上架", desc: "表格导入 SKU DOM 回放改价", channel: "电商运营", steps: 12 },
  { id: "w2", title: "异常订单排查", desc: "规则匹配 HTTP 拉取", channel: "电商运营", steps: 8 },
  { id: "w3", title: "会议纪要 → 待办", desc: "LLM 抽取 Action Items", channel: "办公自动化", steps: 5 },
  { id: "w4", title: "发布前检查", desc: "多环境 HTTP 探活 企业微信", channel: "DevOps", steps: 9 },
];

function tokens(s) {
  return s.toLowerCase().replace(/[^a-z0-9\\u4e00-\\u9fff]+/g, " ").split(/\\s+/).filter(Boolean);
}

function cosine(a, b) {
  const map = new Map();
  for (const t of b) map.set(t, (map.get(t) || 0) + 1);
  let dot = 0, na = 0, nb = 0;
  const seen = new Set([...a, ...b]);
  for (const t of seen) {
    const va = a.filter(x => x === t).length;
    const vb = map.get(t) || 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

self.onmessage = (e) => {
  const t0 = performance.now();
  const q = tokens(e.data.query);
  const results = CATALOG.map((w, i) => {
    const doc = tokens(w.title + " " + w.desc + " " + w.channel);
    const sim = cosine(q, doc);
    return { id: w.id, title: w.title, score: Math.min(0.98, 0.72 + sim * 0.28), channel: w.channel, steps: w.steps, desc: w.desc };
  }).sort((a, b) => b.score - a.score).slice(0, 3);
  self.postMessage({ results, workerMs: Math.round(performance.now() - t0) });
};
`;

let workerUrl: string | null = null;

export function createMatchWorker() {
  if (!workerUrl) {
    workerUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
  }
  return new Worker(workerUrl);
}

export type WorkerMatchResult = {
  id: string;
  title: string;
  score: number;
  channel?: string;
  steps?: number;
  desc?: string;
};

export function workerMatch(query: string): Promise<{ results: WorkerMatchResult[]; workerMs: number }> {
  return new Promise((resolve, reject) => {
    const w = createMatchWorker();
    w.onmessage = (e: MessageEvent<{ results: WorkerMatchResult[]; workerMs: number }>) => {
      w.terminate();
      resolve(e.data);
    };
    w.onerror = (err) => {
      w.terminate();
      reject(err);
    };
    w.postMessage({ query });
  });
}
