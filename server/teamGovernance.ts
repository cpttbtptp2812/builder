import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { dbAll, dbGet, dbRun, nowIso } from "./db.ts";

export const TEAM_ROLES = ["viewer", "editor", "approver", "admin"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export type TeamMember = {
  id: string;
  email: string;
  displayName: string;
  role: TeamRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TeamSession = {
  id: string;
  memberId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
};

export type AuthenticatedSession = TeamSession & {
  member: TeamMember;
};

export type EnvironmentPermission = {
  role: TeamRole;
  environment: string;
  action: string;
  allowed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Approval = {
  id: string;
  environment: string;
  resourceType: string;
  resourceId: string;
  requestedAction: string;
  requestPayload: unknown;
  status: ApprovalStatus;
  requesterId: string;
  requestNote: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type GovernanceAuditRecord = {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  environment: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: string;
};

type TeamMemberRow = {
  id: string;
  email: string;
  display_name: string;
  role: TeamRole;
  active: number;
  created_at: string;
  updated_at: string;
};

type TeamSessionRow = {
  id: string;
  member_id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string | null;
};

type EnvironmentPermissionRow = {
  role: TeamRole;
  environment: string;
  action: string;
  allowed: number;
  created_at: string;
  updated_at: string;
};

type ApprovalRow = {
  id: string;
  environment: string;
  resource_type: string;
  resource_id: string;
  requested_action: string;
  request_payload: string | null;
  status: ApprovalStatus;
  requester_id: string;
  request_note: string | null;
  decided_by: string | null;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type AuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  environment: string | null;
  before_json: string | null;
  after_json: string | null;
  metadata_json: string | null;
  created_at: string;
};

let initialized = false;

export function initializeTeamGovernance(): void {
  if (initialized) return;
  dbRun(`
    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'approver', 'admin')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  dbRun(`
    CREATE TABLE IF NOT EXISTS team_sessions (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      last_seen_at TEXT,
      FOREIGN KEY (member_id) REFERENCES team_members(id)
    )
  `);
  dbRun("CREATE INDEX IF NOT EXISTS idx_team_sessions_member ON team_sessions(member_id)");
  dbRun("CREATE INDEX IF NOT EXISTS idx_team_sessions_expiry ON team_sessions(expires_at)");
  dbRun(`
    CREATE TABLE IF NOT EXISTS environment_permissions (
      role TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'approver', 'admin')),
      environment TEXT NOT NULL,
      action TEXT NOT NULL,
      allowed INTEGER NOT NULL DEFAULT 0 CHECK (allowed IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (role, environment, action)
    )
  `);
  dbRun(`
    CREATE TABLE IF NOT EXISTS governance_approvals (
      id TEXT PRIMARY KEY,
      environment TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      requested_action TEXT NOT NULL,
      request_payload TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
      requester_id TEXT NOT NULL,
      request_note TEXT,
      decided_by TEXT,
      decision_note TEXT,
      decided_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (requester_id) REFERENCES team_members(id),
      FOREIGN KEY (decided_by) REFERENCES team_members(id)
    )
  `);
  dbRun(
    "CREATE INDEX IF NOT EXISTS idx_governance_approvals_queue ON governance_approvals(environment, status, created_at DESC)",
  );
  dbRun(`
    CREATE TABLE IF NOT EXISTS governance_audit (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      environment TEXT,
      before_json TEXT,
      after_json TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    )
  `);
  dbRun(
    "CREATE INDEX IF NOT EXISTS idx_governance_audit_entity ON governance_audit(entity_type, entity_id, created_at DESC)",
  );
  initialized = true;
}

function assertRole(role: string): asserts role is TeamRole {
  if (!(TEAM_ROLES as readonly string[]).includes(role)) {
    throw new Error(`Invalid team role: ${role}`);
  }
}

function assertNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function parseJson(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function memberFromRow(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sessionFromRow(row: TeamSessionRow): TeamSession {
  return {
    id: row.id,
    memberId: row.member_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastSeenAt: row.last_seen_at,
  };
}

function permissionFromRow(row: EnvironmentPermissionRow): EnvironmentPermission {
  return {
    role: row.role,
    environment: row.environment,
    action: row.action,
    allowed: Boolean(row.allowed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function approvalFromRow(row: ApprovalRow): Approval {
  return {
    id: row.id,
    environment: row.environment,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    requestedAction: row.requested_action,
    requestPayload: parseJson(row.request_payload),
    status: row.status,
    requesterId: row.requester_id,
    requestNote: row.request_note,
    decidedBy: row.decided_by,
    decisionNote: row.decision_note,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function auditFromRow(row: AuditRow): GovernanceAuditRecord {
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    environment: row.environment,
    before: parseJson(row.before_json),
    after: parseJson(row.after_json),
    metadata: parseJson(row.metadata_json),
    createdAt: row.created_at,
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokensMatch(storedHash: string, candidateHash: string): boolean {
  const stored = Buffer.from(storedHash, "hex");
  const candidate = Buffer.from(candidateHash, "hex");
  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

function writeAudit(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  environment?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}): GovernanceAuditRecord {
  initializeTeamGovernance();
  const record: GovernanceAuditRecord = {
    id: randomUUID(),
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    environment: input.environment ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? null,
    createdAt: nowIso(),
  };
  dbRun(
    `INSERT INTO governance_audit(
      id, actor_id, action, entity_type, entity_id, environment,
      before_json, after_json, metadata_json, created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [
      record.id,
      record.actorId,
      record.action,
      record.entityType,
      record.entityId,
      record.environment,
      record.before === null ? null : JSON.stringify(record.before),
      record.after === null ? null : JSON.stringify(record.after),
      record.metadata === null ? null : JSON.stringify(record.metadata),
      record.createdAt,
    ],
  );
  return record;
}

export function createTeamMember(input: {
  email: string;
  displayName: string;
  role: TeamRole;
  actorId?: string;
  id?: string;
}): TeamMember {
  initializeTeamGovernance();
  assertRole(input.role);
  const member: TeamMember = {
    id: input.id ?? randomUUID(),
    email: assertNonEmpty(input.email, "email").toLowerCase(),
    displayName: assertNonEmpty(input.displayName, "displayName"),
    role: input.role,
    active: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  dbRun(
    `INSERT INTO team_members(id,email,display_name,role,active,created_at,updated_at)
     VALUES(?,?,?,?,?,?,?)`,
    [
      member.id,
      member.email,
      member.displayName,
      member.role,
      1,
      member.createdAt,
      member.updatedAt,
    ],
  );
  writeAudit({
    actorId: input.actorId,
    action: "member.create",
    entityType: "team_member",
    entityId: member.id,
    after: member,
  });
  return member;
}

export function getTeamMember(id: string): TeamMember | undefined {
  initializeTeamGovernance();
  const row = dbGet<TeamMemberRow>("SELECT * FROM team_members WHERE id=?", [id]);
  return row ? memberFromRow(row) : undefined;
}

export function listTeamMembers(options: { includeInactive?: boolean } = {}): TeamMember[] {
  initializeTeamGovernance();
  const rows = dbAll<TeamMemberRow>(
    options.includeInactive
      ? "SELECT * FROM team_members ORDER BY display_name, email"
      : "SELECT * FROM team_members WHERE active=1 ORDER BY display_name, email",
  );
  return rows.map(memberFromRow);
}

export function updateTeamMember(
  id: string,
  changes: { email?: string; displayName?: string; role?: TeamRole; active?: boolean },
  actorId?: string,
): TeamMember {
  initializeTeamGovernance();
  const before = getTeamMember(id);
  if (!before) throw new Error(`Team member not found: ${id}`);
  if (changes.role !== undefined) assertRole(changes.role);
  const after: TeamMember = {
    ...before,
    email: changes.email === undefined ? before.email : assertNonEmpty(changes.email, "email").toLowerCase(),
    displayName:
      changes.displayName === undefined
        ? before.displayName
        : assertNonEmpty(changes.displayName, "displayName"),
    role: changes.role ?? before.role,
    active: changes.active ?? before.active,
    updatedAt: nowIso(),
  };
  dbRun(
    `UPDATE team_members
     SET email=?, display_name=?, role=?, active=?, updated_at=?
     WHERE id=?`,
    [after.email, after.displayName, after.role, after.active ? 1 : 0, after.updatedAt, id],
  );
  if (!after.active && before.active) {
    dbRun("UPDATE team_sessions SET revoked_at=? WHERE member_id=? AND revoked_at IS NULL", [
      after.updatedAt,
      id,
    ]);
  }
  writeAudit({
    actorId,
    action: "member.update",
    entityType: "team_member",
    entityId: id,
    before,
    after,
  });
  return after;
}

export function deleteTeamMember(id: string, actorId?: string): boolean {
  const member = getTeamMember(id);
  if (!member) return false;
  updateTeamMember(id, { active: false }, actorId);
  writeAudit({
    actorId,
    action: "member.delete",
    entityType: "team_member",
    entityId: id,
    before: member,
    after: { ...member, active: false },
    metadata: { deletion: "soft" },
  });
  return true;
}

export function createTeamSession(
  memberId: string,
  options: { ttlSeconds?: number; actorId?: string } = {},
): { token: string; session: TeamSession } {
  initializeTeamGovernance();
  const member = getTeamMember(memberId);
  if (!member?.active) throw new Error("Cannot create a session for an inactive or unknown member");
  const ttlSeconds = options.ttlSeconds ?? 60 * 60 * 8;
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("ttlSeconds must be a positive integer");
  }
  const token = randomBytes(32).toString("base64url");
  const createdAt = nowIso();
  const session: TeamSession = {
    id: randomUUID(),
    memberId,
    createdAt,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    revokedAt: null,
    lastSeenAt: null,
  };
  dbRun(
    `INSERT INTO team_sessions(
      id,member_id,token_hash,created_at,expires_at,revoked_at,last_seen_at
    ) VALUES(?,?,?,?,?,?,?)`,
    [
      session.id,
      memberId,
      hashToken(token),
      session.createdAt,
      session.expiresAt,
      null,
      null,
    ],
  );
  writeAudit({
    actorId: options.actorId ?? memberId,
    action: "session.create",
    entityType: "team_session",
    entityId: session.id,
    after: session,
  });
  return { token, session };
}

export function authenticateTeamSession(
  token: string,
  options: { touch?: boolean } = {},
): AuthenticatedSession | undefined {
  initializeTeamGovernance();
  if (!token) return undefined;
  const candidateHash = hashToken(token);
  const row = dbGet<TeamSessionRow & { token_hash: string }>(
    `SELECT id,member_id,token_hash,created_at,expires_at,revoked_at,last_seen_at
     FROM team_sessions WHERE token_hash=?`,
    [candidateHash],
  );
  if (
    !row ||
    !tokensMatch(row.token_hash, candidateHash) ||
    row.revoked_at !== null ||
    Date.parse(row.expires_at) <= Date.now()
  ) {
    return undefined;
  }
  const member = getTeamMember(row.member_id);
  if (!member?.active) return undefined;
  const session = sessionFromRow(row);
  if (options.touch !== false) {
    session.lastSeenAt = nowIso();
    dbRun("UPDATE team_sessions SET last_seen_at=? WHERE id=?", [session.lastSeenAt, session.id]);
  }
  return { ...session, member };
}

export function revokeTeamSession(sessionId: string, actorId?: string): boolean {
  initializeTeamGovernance();
  const row = dbGet<TeamSessionRow>("SELECT * FROM team_sessions WHERE id=?", [sessionId]);
  if (!row || row.revoked_at) return false;
  const revokedAt = nowIso();
  dbRun("UPDATE team_sessions SET revoked_at=? WHERE id=?", [revokedAt, sessionId]);
  writeAudit({
    actorId,
    action: "session.revoke",
    entityType: "team_session",
    entityId: sessionId,
    before: sessionFromRow(row),
    after: { ...sessionFromRow(row), revokedAt },
  });
  return true;
}

export function revokeExpiredTeamSessions(actorId?: string): number {
  initializeTeamGovernance();
  const expired = dbAll<{ id: string }>(
    "SELECT id FROM team_sessions WHERE revoked_at IS NULL AND expires_at<=?",
    [nowIso()],
  );
  if (!expired.length) return 0;
  const revokedAt = nowIso();
  dbRun("UPDATE team_sessions SET revoked_at=? WHERE revoked_at IS NULL AND expires_at<=?", [
    revokedAt,
    revokedAt,
  ]);
  for (const row of expired) {
    writeAudit({
      actorId,
      action: "session.expire",
      entityType: "team_session",
      entityId: row.id,
      after: { revokedAt },
    });
  }
  return expired.length;
}

export function setEnvironmentPermission(input: {
  role: TeamRole;
  environment: string;
  action: string;
  allowed: boolean;
  actorId?: string;
}): EnvironmentPermission {
  initializeTeamGovernance();
  assertRole(input.role);
  const environment = assertNonEmpty(input.environment, "environment");
  const action = assertNonEmpty(input.action, "action");
  const before = dbGet<EnvironmentPermissionRow>(
    "SELECT * FROM environment_permissions WHERE role=? AND environment=? AND action=?",
    [input.role, environment, action],
  );
  const now = nowIso();
  dbRun(
    `INSERT INTO environment_permissions(role,environment,action,allowed,created_at,updated_at)
     VALUES(?,?,?,?,?,?)
     ON CONFLICT(role,environment,action) DO UPDATE SET
       allowed=excluded.allowed, updated_at=excluded.updated_at`,
    [input.role, environment, action, input.allowed ? 1 : 0, now, now],
  );
  const permission = dbGet<EnvironmentPermissionRow>(
    "SELECT * FROM environment_permissions WHERE role=? AND environment=? AND action=?",
    [input.role, environment, action],
  );
  if (!permission) throw new Error("Environment permission was not persisted");
  const result = permissionFromRow(permission);
  writeAudit({
    actorId: input.actorId,
    action: "permission.set",
    entityType: "environment_permission",
    entityId: `${input.role}:${environment}:${action}`,
    environment,
    before: before ? permissionFromRow(before) : null,
    after: result,
  });
  return result;
}

export function listEnvironmentPermissions(filters: {
  role?: TeamRole;
  environment?: string;
} = {}): EnvironmentPermission[] {
  initializeTeamGovernance();
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.role) {
    assertRole(filters.role);
    conditions.push("role=?");
    params.push(filters.role);
  }
  if (filters.environment) {
    conditions.push("environment=?");
    params.push(filters.environment);
  }
  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  return dbAll<EnvironmentPermissionRow>(
    `SELECT * FROM environment_permissions${where} ORDER BY environment, role, action`,
    params,
  ).map(permissionFromRow);
}

export function canPerform(
  role: TeamRole,
  environment: string,
  action: string,
): boolean {
  initializeTeamGovernance();
  assertRole(role);
  if (role === "admin") return true;
  const row = dbGet<{ allowed: number }>(
    `SELECT allowed FROM environment_permissions
     WHERE role=? AND environment=? AND action=?`,
    [role, environment, action],
  );
  return Boolean(row?.allowed);
}

export function createApproval(input: {
  environment: string;
  resourceType: string;
  resourceId: string;
  requestedAction: string;
  requesterId: string;
  requestPayload?: unknown;
  requestNote?: string;
  id?: string;
}): Approval {
  initializeTeamGovernance();
  if (!getTeamMember(input.requesterId)?.active) {
    throw new Error("Approval requester must be an active team member");
  }
  const now = nowIso();
  const approval: Approval = {
    id: input.id ?? randomUUID(),
    environment: assertNonEmpty(input.environment, "environment"),
    resourceType: assertNonEmpty(input.resourceType, "resourceType"),
    resourceId: assertNonEmpty(input.resourceId, "resourceId"),
    requestedAction: assertNonEmpty(input.requestedAction, "requestedAction"),
    requestPayload: input.requestPayload ?? null,
    status: "pending",
    requesterId: input.requesterId,
    requestNote: input.requestNote?.trim() || null,
    decidedBy: null,
    decisionNote: null,
    decidedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  dbRun(
    `INSERT INTO governance_approvals(
      id,environment,resource_type,resource_id,requested_action,request_payload,status,
      requester_id,request_note,decided_by,decision_note,decided_at,created_at,updated_at,deleted_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      approval.id,
      approval.environment,
      approval.resourceType,
      approval.resourceId,
      approval.requestedAction,
      JSON.stringify(approval.requestPayload),
      approval.status,
      approval.requesterId,
      approval.requestNote,
      null,
      null,
      null,
      approval.createdAt,
      approval.updatedAt,
      null,
    ],
  );
  writeAudit({
    actorId: input.requesterId,
    action: "approval.create",
    entityType: "approval",
    entityId: approval.id,
    environment: approval.environment,
    after: approval,
  });
  return approval;
}

export function getApproval(id: string, includeDeleted = false): Approval | undefined {
  initializeTeamGovernance();
  const row = dbGet<ApprovalRow>(
    `SELECT * FROM governance_approvals WHERE id=?${includeDeleted ? "" : " AND deleted_at IS NULL"}`,
    [id],
  );
  return row ? approvalFromRow(row) : undefined;
}

export function listApprovals(filters: {
  environment?: string;
  status?: ApprovalStatus;
  requesterId?: string;
  includeDeleted?: boolean;
  limit?: number;
} = {}): Approval[] {
  initializeTeamGovernance();
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (!filters.includeDeleted) conditions.push("deleted_at IS NULL");
  if (filters.environment) {
    conditions.push("environment=?");
    params.push(filters.environment);
  }
  if (filters.status) {
    conditions.push("status=?");
    params.push(filters.status);
  }
  if (filters.requesterId) {
    conditions.push("requester_id=?");
    params.push(filters.requesterId);
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit);
  return dbAll<ApprovalRow>(
    `SELECT * FROM governance_approvals${where} ORDER BY created_at DESC LIMIT ?`,
    params,
  ).map(approvalFromRow);
}

export function updateApproval(
  id: string,
  changes: { requestPayload?: unknown; requestNote?: string | null },
  actorId: string,
): Approval {
  initializeTeamGovernance();
  const before = getApproval(id);
  if (!before) throw new Error(`Approval not found: ${id}`);
  if (before.status !== "pending") throw new Error("Only pending approvals can be updated");
  const after: Approval = {
    ...before,
    requestPayload:
      changes.requestPayload === undefined ? before.requestPayload : changes.requestPayload,
    requestNote:
      changes.requestNote === undefined ? before.requestNote : changes.requestNote?.trim() || null,
    updatedAt: nowIso(),
  };
  dbRun(
    "UPDATE governance_approvals SET request_payload=?, request_note=?, updated_at=? WHERE id=?",
    [JSON.stringify(after.requestPayload), after.requestNote, after.updatedAt, id],
  );
  writeAudit({
    actorId,
    action: "approval.update",
    entityType: "approval",
    entityId: id,
    environment: after.environment,
    before,
    after,
  });
  return after;
}

export function decideApproval(input: {
  id: string;
  decision: "approved" | "rejected";
  decidedBy: string;
  note?: string;
}): Approval {
  initializeTeamGovernance();
  const before = getApproval(input.id);
  if (!before) throw new Error(`Approval not found: ${input.id}`);
  if (before.status !== "pending") throw new Error("Approval has already been decided");
  const decider = getTeamMember(input.decidedBy);
  if (!decider?.active || !["approver", "admin"].includes(decider.role)) {
    throw new Error("Decision requires an active approver or admin");
  }
  if (!canPerform(decider.role, before.environment, "approve")) {
    throw new Error(`Member cannot approve in environment: ${before.environment}`);
  }
  const decidedAt = nowIso();
  dbRun(
    `UPDATE governance_approvals
     SET status=?, decided_by=?, decision_note=?, decided_at=?, updated_at=?
     WHERE id=? AND status='pending' AND deleted_at IS NULL`,
    [
      input.decision,
      input.decidedBy,
      input.note?.trim() || null,
      decidedAt,
      decidedAt,
      input.id,
    ],
  );
  const after = getApproval(input.id);
  if (!after || after.status !== input.decision) {
    throw new Error("Approval decision was not persisted");
  }
  writeAudit({
    actorId: input.decidedBy,
    action: `approval.${input.decision}`,
    entityType: "approval",
    entityId: input.id,
    environment: after.environment,
    before,
    after,
  });
  return after;
}

export function cancelApproval(id: string, actorId: string, note?: string): Approval {
  initializeTeamGovernance();
  const before = getApproval(id);
  if (!before) throw new Error(`Approval not found: ${id}`);
  if (before.status !== "pending") throw new Error("Only pending approvals can be cancelled");
  const now = nowIso();
  dbRun(
    `UPDATE governance_approvals
     SET status='cancelled', decided_by=?, decision_note=?, decided_at=?, updated_at=?
     WHERE id=? AND status='pending' AND deleted_at IS NULL`,
    [actorId, note?.trim() || null, now, now, id],
  );
  const after = getApproval(id);
  if (!after || after.status !== "cancelled") throw new Error("Approval cancellation was not persisted");
  writeAudit({
    actorId,
    action: "approval.cancel",
    entityType: "approval",
    entityId: id,
    environment: after.environment,
    before,
    after,
  });
  return after;
}

export function deleteApproval(id: string, actorId: string): boolean {
  initializeTeamGovernance();
  const before = getApproval(id);
  if (!before) return false;
  const deletedAt = nowIso();
  dbRun("UPDATE governance_approvals SET deleted_at=?, updated_at=? WHERE id=?", [
    deletedAt,
    deletedAt,
    id,
  ]);
  writeAudit({
    actorId,
    action: "approval.delete",
    entityType: "approval",
    entityId: id,
    environment: before.environment,
    before,
    after: { ...before, deletedAt, updatedAt: deletedAt },
    metadata: { deletion: "soft" },
  });
  return true;
}

export function listGovernanceAudit(filters: {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  environment?: string;
  limit?: number;
} = {}): GovernanceAuditRecord[] {
  initializeTeamGovernance();
  const conditions: string[] = [];
  const params: unknown[] = [];
  for (const [column, value] of [
    ["entity_type", filters.entityType],
    ["entity_id", filters.entityId],
    ["actor_id", filters.actorId],
    ["environment", filters.environment],
  ] as const) {
    if (value) {
      conditions.push(`${column}=?`);
      params.push(value);
    }
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 1000));
  params.push(limit);
  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  return dbAll<AuditRow>(
    `SELECT * FROM governance_audit${where} ORDER BY created_at DESC LIMIT ?`,
    params,
  ).map(auditFromRow);
}

