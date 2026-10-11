export type ProductRunImportPart = {
  kind: "import";
  sessionId: string;
  processId: string;
  slot: string;
  label: string;
  hint: string;
  templateCsv: string;
  filename: string;
  ready: boolean;
};

export type ProductRunProcessPart = {
  kind: "process";
  processId: string;
  label: string;
  detail: string;
  ok: boolean;
};

export type ProductRunFinishPart = {
  kind: "finish";
  processId: string;
  summary: string;
};

export type ProductRunPart = ProductRunImportPart | ProductRunProcessPart | ProductRunFinishPart;

export type ProductRunView = {
  processId: string;
  status: "waiting_import" | "running" | "finish";
  skillId: string;
  query: string;
  parts: ProductRunPart[];
};

export type ProductRunApiResult =
  | {
      ok: true;
      processId: string;
      status: "waiting_import";
      message: string;
      parts: ProductRunPart[];
      skillId: string;
      query: string;
      runtime?: "server";
    }
  | {
      ok: true;
      processId: string;
      status: "finish";
      message: string;
      parts: ProductRunPart[];
      skillId: string;
      query: string;
      trace?: unknown;
      paper?: import("../workPaper").WorkPaper | null;
      runtime: "server";
    }
  | { ok: false; error: string };

export type ProductRunStreamHandlers = {
  onRunning?: (payload: { processId: string; skillId: string; query: string }) => void;
  onGate?: (result: Extract<ProductRunApiResult, { ok: true; status: "waiting_import" }>) => void;
  onStep?: (part: ProductRunProcessPart) => void;
  onFinish?: (result: Extract<ProductRunApiResult, { ok: true; status: "finish" }>) => void;
  onError?: (error: string) => void;
};
