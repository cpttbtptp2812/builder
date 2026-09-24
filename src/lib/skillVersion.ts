/** Skill 整包版本号 — 0.10 / 0.11 运维可读 */

export const INITIAL_SKILL_VERSION = "0.10";

export function parseSkillVersion(v: string): { major: number; minor: number } {
  const parts = v.trim().replace(/^v/i, "").split(".");
  const major = Number(parts[0]) || 0;
  const minor = Number(parts[1]) || 0;
  return { major, minor };
}

export function formatSkillVersion(major: number, minor: number): string {
  return `${major}.${String(minor).padStart(2, "0")}`;
}

/** 0.10 → 0.11 */
export function bumpSkillMinor(v: string): string {
  const { major, minor } = parseSkillVersion(v);
  return formatSkillVersion(major, minor + 1);
}

export function compareSkillVersion(a: string, b: string): number {
  const pa = parseSkillVersion(a);
  const pb = parseSkillVersion(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  return pa.minor - pb.minor;
}
