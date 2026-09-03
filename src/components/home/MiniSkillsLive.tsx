import { MiniTechLog } from "./MiniTechLog";

const LINES = [
  "explainDiscovery · trigger 矩阵",
  "http_probe · 真实 latency",
  "Performance API · TTFB",
  "browser_snapshot · a11y tree",
];
/** 首页 SkillForge — Agent Skills 路由 */
export function MiniSkillsLive() {
  return (
    <MiniTechLog label="SkillForge · SKILL.md" lines={LINES} accent="amber" intervalMs={1150} />
  );
}
