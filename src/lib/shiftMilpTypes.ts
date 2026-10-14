/** HiGHS 最优排班的结果（服务端产出、前端展示） */

export type ShiftSolveStage = {
  name: string;
  status: string;
  objective: number | null;
  bound: number | null;
  gap: number | null;
  ms: number;
  proved: boolean;
};

export type ShiftPlanMetrics = {
  seats: number;
  filled: number;
  unfilled: number;
  violations: number;
  keyholderMisses: number;
  spread: number | null;
  cost: number | null;
  stoppedAt: string | null;
  guardNotes: string[];
};

export type ShiftMatrixCell = { greedy: string; optimal: string };

export type ShiftRelaxation = {
  id: string;
  kind: "可上班" | "请假" | "技能" | "用工规则";
  person: string;
  label: string;
  weight: number;
  enables: string[];
};

export type ShiftOptimizeReport = {
  ok: boolean;
  error?: string;
  staffTitle: string;
  demandTitle: string;
  solver: { name: string; version: string; vars: number; rows: number; ms: number };
  stages: ShiftSolveStage[];
  greedy: ShiftPlanMetrics | null;
  optimal: ShiftPlanMetrics | null;
  /** 员工 × 日期，两种解不同的格子 */
  matrix: { people: string[]; days: { day: number; label: string }[]; cells: Record<string, ShiftMatrixCell> };
  changedCells: number;
  relax: {
    status: "full" | "relaxed" | "impossible";
    proved: boolean;
    cost: number | null;
    items: ShiftRelaxation[];
    note: string;
  } | null;
  lp: string;
  roster: { columns: string[]; rows: string[][] } | null;
};
