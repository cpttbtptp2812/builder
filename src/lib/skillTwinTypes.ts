/** 数字孪生（改规则前在历史办理上重放）服务端与界面共用的报告结构 */

export type TwinOutcome = { kind: "done" | "stopped" | "failed"; at?: string; note?: string };

export type TwinGridDiff = {
  name: string;
  columns: string[];
  rowsBefore: number;
  rowsAfter: number;
  added: number;
  removed: number;
  sample: { before: string[] | null; after: string[] | null }[];
};

export type TwinCase = {
  runId: string;
  at: string;
  query: string;
  materials: string[];
  recordedVersion: string;
  /** 当时用的就是现在的线上版，才能拿重放和当时记录逐步比对 */
  faithChecked: boolean;
  faithful: boolean;
  unfaithfulSteps: string[];
  before: TwinOutcome;
  after: TwinOutcome;
  summaryBefore: string;
  summaryAfter: string;
  steps: { stepId: string; label: string; before: string; after: string }[];
  grids: TwinGridDiff[];
  changed: boolean;
};

export type TwinReport = {
  ok: boolean;
  error?: string;
  skillId: string;
  onlineVersion: string;
  cases: TwinCase[];
  skipped: { runId: string; reason: string }[];
  totals: { replayed: number; changed: number; newlyStopped: number; newlyPassed: number; unfaithful: number };
  ms: number;
};
