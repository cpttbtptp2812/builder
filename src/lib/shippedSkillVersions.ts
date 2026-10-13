/**
 * 随技能一起发布的历史版本（src/skills/<id>/versions/<版本号>.md）。
 * 技能页「以前发过的版本」里可以查看、放进草稿试跑对比、换回。
 */

import { compareSkillVersion } from "./skillVersion";

export type ShippedSkillVersion = { skillId: string; version: string; raw: string };

const isNodeRuntime = Boolean(
  (globalThis as typeof globalThis & { process?: { versions?: { node?: string } } }).process?.versions?.node,
);

const files = (
  isNodeRuntime
    ? {}
    : import.meta.glob("../skills/*/versions/*.md", {
        eager: true,
        query: "?raw",
        import: "default",
      })
) as Record<string, string>;

function fromPath(filePath: string): { skillId: string; version: string } | null {
  const m = filePath.replace(/\\/g, "/").match(/skills\/([^/]+)\/versions\/([^/]+)\.md$/);
  return m ? { skillId: m[1]!, version: m[2]! } : null;
}

export function shippedVersionsFromFiles(map: Record<string, string>): ShippedSkillVersion[] {
  return Object.entries(map)
    .flatMap(([p, raw]) => {
      const hit = fromPath(p);
      return hit ? [{ ...hit, raw }] : [];
    })
    .sort((a, b) => a.skillId.localeCompare(b.skillId) || compareSkillVersion(b.version, a.version));
}

const SHIPPED = shippedVersionsFromFiles(files);

export function shippedVersionsFor(skillId: string): ShippedSkillVersion[] {
  return SHIPPED.filter((v) => v.skillId === skillId);
}
