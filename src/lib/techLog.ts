/** 各项目技术事件流 — 统一格式 */

export type TechEventKind =
  | "io"
  | "stage"
  | "abort"
  | "resume"
  | "storage"
  | "render"
  | "ok"
  | "fail";

export type TechEvent = {
  id: number;
  api: string;
  detail: string;
  kind: TechEventKind;
};

let seq = 0;

export function mkTech(
  api: string,
  detail: string,
  kind: TechEventKind = "io",
): TechEvent {
  return { id: ++seq, api, detail, kind };
}

export function resetTechSeq() {
  seq = 0;
}
