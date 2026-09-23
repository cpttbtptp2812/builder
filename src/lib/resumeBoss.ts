import type { JobPlainFields, ProjectPlainFields } from "../data/resumeContent";

/** 格式化为 BOSS 直聘「工作经历」粘贴文本 */
export function formatBossJob(
  company: string,
  role: string,
  period: string,
  p: JobPlainFields,
): string {
  return [
    `公司名称：${company}`,
    `职位名称：${role}`,
    `在职时间：${period}`,
    "",
    "工作内容：",
    p.description.trim(),
    "",
    "工作业绩：",
    p.performance.trim(),
  ].join("\n");
}

/** 格式化为 BOSS 直聘「项目经历」粘贴文本 */
export function formatBossProject(p: ProjectPlainFields): string {
  return [
    `项目名称：${p.name}`,
    `项目角色：${p.role}`,
    `项目时间：${p.period}`,
    p.url ? `项目链接：${p.url}` : null,
    "",
    "项目描述：",
    p.description.trim(),
    "",
    "项目业绩：",
    p.performance.trim(),
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** 将「1. xxx\n2. xxx」拆成列表项展示 */
export function splitBossLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((s) => s.replace(/^\d+[.、)\s]+/, "").trim())
    .filter(Boolean);
}

/** 是否整段为纯编号列表（用于 UI 选择 ol / pre 展示） */
export function isNumberedList(text: string): boolean {
  const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((line) => /^\d+[.、)\s]/.test(line));
}
