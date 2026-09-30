/** 发布见证包 — 发布时刻的技能哈希 + gate + 真实回流/邻域扫描摘要 + 探活指纹 */

import type { SkillFullCompareReport } from "./skillCompareReport";
import { buildReleaseGateSummary } from "./releaseGate";
import { extractUrlFromText } from "./releaseInspect";
import type { ShadowReplayReport } from "./skillShadowReplay";
import type { RouteFuzzReport } from "./skillRouteFuzz";

export type ReleaseWitness = {
  schema: "ownagent-release-witness/1";
  publishedAt: string;
  skillId: string;
  skillName: string;
  version: string;
  manifestSha256: string;
  gate: ReturnType<typeof buildReleaseGateSummary>;
  liveProbeUsed: boolean;
  gateQueries: { query: string; verdict: string; routeDrift: boolean; urlProbeFingerprint?: string }[];
  shadowReplay: {
    queried: number;
    routeDriftCount: number;
    executionRegressCount: number;
  } | null;
  routeFuzz: { variantsTested: number; lostCount: number; gainedCount: number } | null;
  contentSha256: string;
};

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function urlProbeFingerprint(query: string): Promise<string | undefined> {
  const url = extractUrlFromText(query);
  if (!url) return undefined;
  return sha256Hex(`probe-target:${url}`);
}

export async function buildReleaseWitness(opts: {
  skillId: string;
  skillName: string;
  version: string;
  manifest: string;
  report: SkillFullCompareReport;
  shadow: ShadowReplayReport | null;
  fuzz: RouteFuzzReport | null;
}): Promise<ReleaseWitness> {
  const gate = buildReleaseGateSummary(opts.report);
  const gateQueries = await Promise.all(
    opts.report.queryResults.map(async (r) => ({
      query: r.query,
      verdict: r.verdictLevel,
      routeDrift: r.routeDrift,
      urlProbeFingerprint: await urlProbeFingerprint(r.query),
    })),
  );
  const bodyWithoutHash = {
    schema: "ownagent-release-witness/1" as const,
    publishedAt: new Date().toISOString(),
    skillId: opts.skillId,
    skillName: opts.skillName,
    version: opts.version,
    manifestSha256: await sha256Hex(opts.manifest),
    gate,
    liveProbeUsed: opts.report.liveProbeUsed,
    gateQueries,
    shadowReplay: opts.shadow
      ? {
          queried: opts.shadow.queried,
          routeDriftCount: opts.shadow.routeDriftCount,
          executionRegressCount: opts.shadow.executionRegressCount,
        }
      : null,
    routeFuzz: opts.fuzz
      ? {
          variantsTested: opts.fuzz.variantsTested,
          lostCount: opts.fuzz.lostCount,
          gainedCount: opts.fuzz.gainedCount,
        }
      : null,
    contentSha256: "",
  };
  const contentSha256 = await sha256Hex(JSON.stringify({ ...bodyWithoutHash, contentSha256: undefined }));
  return { ...bodyWithoutHash, contentSha256 };
}

export function downloadReleaseWitness(witness: ReleaseWitness) {
  const blob = new Blob([JSON.stringify(witness, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${witness.skillId}-v${witness.version}-witness.json`;
  a.click();
  URL.revokeObjectURL(url);
}
