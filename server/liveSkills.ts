import { dbAll, dbGet, dbRun, nowIso } from "./db.ts";

export type LiveSkillRecord = {
  skillId: string;
  version: string;
  raw: string;
  actorId: string | null;
  publishedAt: string;
};

export function liveSkill(skillId: string): LiveSkillRecord | null {
  const row = dbGet<{
    skill_id: string;
    version: string;
    raw: string;
    actor_id: string | null;
    published_at: string;
  }>("SELECT skill_id,version,raw,actor_id,published_at FROM live_skills WHERE skill_id=?", [skillId]);
  return row
    ? {
        skillId: row.skill_id,
        version: row.version,
        raw: row.raw,
        actorId: row.actor_id,
        publishedAt: row.published_at,
      }
    : null;
}

export function listLiveSkills(): LiveSkillRecord[] {
  return dbAll<{
    skill_id: string;
    version: string;
    raw: string;
    actor_id: string | null;
    published_at: string;
  }>("SELECT skill_id,version,raw,actor_id,published_at FROM live_skills ORDER BY skill_id").map((row) => ({
    skillId: row.skill_id,
    version: row.version,
    raw: row.raw,
    actorId: row.actor_id,
    publishedAt: row.published_at,
  }));
}

export function publishLiveSkill(input: {
  skillId: string;
  version: string;
  raw: string;
  gate?: string;
  actorId?: string | null;
  note?: string;
}): LiveSkillRecord {
  const at = nowIso();
  dbRun(
    `INSERT INTO skill_versions(skill_id,version,raw,gate,actor_id,note,created_at)
     VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(skill_id,version) DO UPDATE SET
       raw=excluded.raw, gate=excluded.gate, actor_id=excluded.actor_id, note=excluded.note`,
    [input.skillId, input.version, input.raw, input.gate ?? null, input.actorId ?? null, input.note ?? null, at],
  );
  dbRun(
    `INSERT INTO live_skills(skill_id,version,raw,actor_id,published_at)
     VALUES(?,?,?,?,?)
     ON CONFLICT(skill_id) DO UPDATE SET
       version=excluded.version, raw=excluded.raw, actor_id=excluded.actor_id, published_at=excluded.published_at`,
    [input.skillId, input.version, input.raw, input.actorId ?? null, at],
  );
  return liveSkill(input.skillId)!;
}

export function rollbackLiveSkill(
  skillId: string,
  version: string,
  actorId?: string | null,
  newVersion?: string,
): LiveSkillRecord | null {
  const historical = dbGet<{ raw: string }>(
    "SELECT raw FROM skill_versions WHERE skill_id=? AND version=?",
    [skillId, version],
  );
  return historical
    ? publishLiveSkill({ skillId, version: newVersion ?? version, raw: historical.raw, gate: "ROLLBACK", actorId, note: `rollback to ${version}` })
    : null;
}

