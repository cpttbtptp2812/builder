import type { Hono } from "hono";
import {
  authenticateTeamSession,
  canPerform,
  createApproval,
  createTeamMember,
  createTeamSession,
  decideApproval,
  initializeTeamGovernance,
  listApprovals,
  listEnvironmentPermissions,
  listTeamMembers,
  setEnvironmentPermission,
  type AuthenticatedSession,
  type TeamRole,
} from "./teamGovernance.ts";
import { sendGovernanceNotifications } from "./notifications.ts";

function bearer(header: string | undefined): string {
  return header?.replace(/^Bearer\s+/i, "").trim() ?? "";
}

export function teamSessionFromHeader(header: string | undefined): AuthenticatedSession | undefined {
  return authenticateTeamSession(bearer(header));
}

function notify(title: string, body: string, fields: Record<string, string>) {
  return sendGovernanceNotifications(
    { title, body, fields },
    {
      feishuWebhookUrl: process.env.FEISHU_WEBHOOK_URL,
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
      email: process.env.APPROVAL_EMAIL_TO ? { to: process.env.APPROVAL_EMAIL_TO } : undefined,
    },
  );
}

function seedPermissions() {
  const defaults: Array<[TeamRole, string, string, boolean]> = [
    ["viewer", "staging", "read", true],
    ["viewer", "prod", "read", true],
    ["editor", "staging", "read", true],
    ["editor", "staging", "publish", true],
    ["editor", "prod", "read", true],
    ["editor", "prod", "request", true],
    ["approver", "staging", "approve", true],
    ["approver", "prod", "approve", true],
    ["approver", "prod", "publish", true],
  ];
  const existing = new Set(listEnvironmentPermissions().map((row) => `${row.role}:${row.environment}:${row.action}`));
  for (const [role, environment, action, allowed] of defaults) {
    if (!existing.has(`${role}:${environment}:${action}`)) {
      setEnvironmentPermission({ role, environment, action, allowed });
    }
  }
}

export function registerTeamGovernanceApi(app: Hono) {
  initializeTeamGovernance();
  seedPermissions();

  app.post("/api/team/bootstrap", async (c) => {
    if (listTeamMembers({ includeInactive: true }).length) return c.json({ error: "already bootstrapped" }, 409);
    const expected = process.env.OWNAGENT_BOOTSTRAP_TOKEN;
    const supplied = c.req.header("x-bootstrap-token");
    if ((process.env.NODE_ENV === "production" || expected) && (!expected || supplied !== expected)) {
      return c.json({ error: "invalid bootstrap token" }, 401);
    }
    const body = await c.req.json<{ email?: string; displayName?: string }>();
    const member = createTeamMember({
      email: body.email ?? "admin@ownagent.local",
      displayName: body.displayName ?? "OwnAgent Admin",
      role: "admin",
    });
    const session = createTeamSession(member.id);
    return c.json({ member, token: session.token });
  });

  app.get("/api/team/me", (c) => {
    const session = teamSessionFromHeader(c.req.header("authorization"));
    return session ? c.json({ member: session.member, sessionId: session.id }) : c.json({ error: "unauthorized" }, 401);
  });

  app.get("/api/team/members", (c) => {
    const session = teamSessionFromHeader(c.req.header("authorization"));
    if (!session || session.member.role !== "admin") return c.json({ error: "forbidden" }, 403);
    return c.json({ members: listTeamMembers({ includeInactive: true }) });
  });

  app.post("/api/team/members", async (c) => {
    const session = teamSessionFromHeader(c.req.header("authorization"));
    if (!session || session.member.role !== "admin") return c.json({ error: "forbidden" }, 403);
    const body = await c.req.json<{ email: string; displayName: string; role: TeamRole }>();
    return c.json({ member: createTeamMember({ ...body, actorId: session.member.id }) });
  });

  app.post("/api/team/members/:id/session", (c) => {
    const session = teamSessionFromHeader(c.req.header("authorization"));
    if (!session || session.member.role !== "admin") return c.json({ error: "forbidden" }, 403);
    const created = createTeamSession(c.req.param("id"), { actorId: session.member.id });
    return c.json({ token: created.token, session: created.session });
  });

  app.get("/api/team/permissions", (c) => {
    const session = teamSessionFromHeader(c.req.header("authorization"));
    if (!session) return c.json({ error: "unauthorized" }, 401);
    return c.json({ permissions: listEnvironmentPermissions() });
  });

  app.put("/api/team/permissions", async (c) => {
    const session = teamSessionFromHeader(c.req.header("authorization"));
    if (!session || session.member.role !== "admin") return c.json({ error: "forbidden" }, 403);
    const body = await c.req.json<{ role: TeamRole; environment: string; action: string; allowed: boolean }>();
    return c.json({ permission: setEnvironmentPermission({ ...body, actorId: session.member.id }) });
  });

  app.get("/api/team/approvals", (c) => {
    const session = teamSessionFromHeader(c.req.header("authorization"));
    if (!session) return c.json({ error: "unauthorized" }, 401);
    return c.json({
      approvals: listApprovals({
        environment: c.req.query("environment"),
        status: c.req.query("status") as "pending" | "approved" | "rejected" | "cancelled" | undefined,
      }),
    });
  });

  app.post("/api/team/approvals", async (c) => {
    const session = teamSessionFromHeader(c.req.header("authorization"));
    const body = await c.req.json<{
      environment: string; skillId: string; version: string; gate: string; note?: string; payload?: unknown;
    }>();
    if (!session || !canPerform(session.member.role, body.environment, "request")) {
      return c.json({ error: "forbidden" }, 403);
    }
    const approval = createApproval({
      environment: body.environment,
      resourceType: "skill-release",
      resourceId: `${body.skillId}@${body.version}`,
      requestedAction: "publish",
      requesterId: session.member.id,
      requestPayload: { gate: body.gate, ...((body.payload as object | undefined) ?? {}) },
      requestNote: body.note,
    });
    const notifications = await notify("OwnAgent 发布待审批", `${body.skillId} ${body.version}`, {
      environment: body.environment,
      gate: body.gate,
      requester: session.member.displayName,
    });
    return c.json({ approval, notifications });
  });

  app.post("/api/team/approvals/:id/decision", async (c) => {
    const session = teamSessionFromHeader(c.req.header("authorization"));
    if (!session) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json<{ decision: "approved" | "rejected"; note?: string }>();
    try {
      const approval = decideApproval({
        id: c.req.param("id"),
        decision: body.decision,
        decidedBy: session.member.id,
        note: body.note,
      });
      const notifications = await notify(`OwnAgent 审批${body.decision === "approved" ? "通过" : "拒绝"}`, approval.resourceId, {
        environment: approval.environment,
        approver: session.member.displayName,
      });
      return c.json({ approval, notifications });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 403);
    }
  });
}
