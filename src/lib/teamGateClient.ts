/** Server-backed release approvals and baseline version tags. */

import { apiFetch, getTeamToken, setTeamToken } from "./apiClient";

export type BaselineTags = Record<string, { staging?: string; prod?: string }>;

export type ReleaseApproval = {
  id: string;
  skillId: string;
  version: string;
  gate: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  note?: string;
};

type ServerApproval = {
  id: string;
  resourceId: string;
  status: ReleaseApproval["status"];
  requestNote: string | null;
  requestPayload: { gate?: string } | null;
};

function toReleaseApproval(row: ServerApproval): ReleaseApproval | null {
  const [skillId, version] = row.resourceId.split("@");
  if (!skillId || !version) return null;
  return {
    id: row.id,
    skillId,
    version,
    gate: row.requestPayload?.gate ?? "WARN",
    status: row.status,
    note: row.requestNote ?? undefined,
  };
}

export async function ensureTeamSession(): Promise<boolean> {
  if (getTeamToken()) {
    const me = await apiFetch<{ member: { id: string } }>("/team/me");
    if (me?.member) return true;
    setTeamToken(null);
  }
  const boot = await apiFetch<{ token?: string }>("/team/bootstrap", {
    method: "POST",
    body: JSON.stringify({ displayName: "本地管理员", email: "admin@ownagent.local" }),
  });
  if (boot?.token) {
    setTeamToken(boot.token);
    return true;
  }
  return false;
}

export async function loadBaselineTags(): Promise<BaselineTags> {
  const body = await apiFetch<{ tags: BaselineTags }>("/skill-gate/baselines");
  return body?.tags ?? {};
}

async function listApprovals(status: ReleaseApproval["status"]): Promise<ReleaseApproval[]> {
  const body = await apiFetch<{ approvals: ServerApproval[] }>(`/team/approvals?status=${status}&environment=prod`);
  return (body?.approvals ?? []).map(toReleaseApproval).filter((row): row is ReleaseApproval => Boolean(row));
}

export async function listPendingReleaseApprovals(): Promise<ReleaseApproval[]> {
  if (!(await ensureTeamSession())) return [];
  return listApprovals("pending");
}

export async function findReleaseApproval(
  skillId: string,
  version: string,
  status: ReleaseApproval["status"],
): Promise<ReleaseApproval | null> {
  if (!(await ensureTeamSession())) return null;
  const rows = await listApprovals(status);
  return rows.find((row) => row.skillId === skillId && row.version === version) ?? null;
}

export async function submitReleaseApproval(input: {
  skillId: string;
  version: string;
  gate: string;
  note?: string;
}): Promise<ReleaseApproval | null> {
  if (!(await ensureTeamSession())) return null;
  const body = await apiFetch<{ approval: ServerApproval }>("/team/approvals", {
    method: "POST",
    body: JSON.stringify({
      environment: "prod",
      skillId: input.skillId,
      version: input.version,
      gate: input.gate,
      note: input.note,
    }),
  });
  return body?.approval ? toReleaseApproval(body.approval) : null;
}

export async function decideReleaseApproval(id: string, decision: "approved" | "rejected"): Promise<boolean> {
  if (!(await ensureTeamSession())) return false;
  const body = await apiFetch<{ approval: ServerApproval }>(`/team/approvals/${id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
  return Boolean(body?.approval);
}
