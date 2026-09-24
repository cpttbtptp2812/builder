/** SKILL.md 解析 — YAML frontmatter + steps AST，浏览器与 Node 共用 */

import type { SkillCompileFields } from "./skillCompileAttach";

export type SkillParseIssue = {
  level: "error" | "warning";
  line?: number;
  message: string;
};

export type ParsedSkillStep = {
  id: string;
  label: string;
  tool: string;
  args: Record<string, unknown>;
};

export type ParsedSkillDoc = {
  raw: string;
  frontmatterRaw: string;
  body: string;
  fm: Record<string, unknown>;
  name: string;
  description: string;
  triggers: string[];
  tools: string[];
  steps: ParsedSkillStep[];
  headings: { level: number; text: string }[];
  issues: SkillParseIssue[];
  ok: boolean;
};

export type SkillArgContext = {
  query: string;
  probeUrl: string;
  vars: Record<string, unknown>;
};

export type SkillManifestCore = {
  id: string;
  name: string;
  description: string;
  skillPath: string;
  triggers: string[];
  tools: string[];
  steps: { id: string; label: string; tool: string; args: Record<string, unknown> }[];
  manifest: string;
  plan: string[];
  parsed: ParsedSkillDoc;
  runnable: boolean;
};

export type SkillManifest = SkillManifestCore & SkillCompileFields;

export { attachCompileToManifest, enrichSkillCatalog, compileParsedOnly } from "./skillCompileAttach";
export type { SkillCompileFields, SkillDiagnostic } from "./skillCompileAttach";
export type { SkillPeer } from "./skillSemcompiler";

type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

type SrcLine = { no: number; indent: number; text: string };

const MIDDLE_DOT = /\s*[·•]\s*/;

function issue(level: SkillParseIssue["level"], message: string, line?: number): SkillParseIssue {
  return line != null ? { level, message, line } : { level, message };
}

function splitFrontmatter(raw: string): { fmRaw: string; body: string; issues: SkillParseIssue[] } {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---")) {
    return { fmRaw: "", body: text.trim(), issues: [issue("warning", "缺少 YAML frontmatter（文件应以 --- 开头）")] };
  }
  const rest = text.slice(3).replace(/^\n/, "");
  const end = rest.search(/\n---[ \t]*(?:\n|$)/);
  if (end < 0) {
    return { fmRaw: "", body: text.trim(), issues: [issue("error", "frontmatter 未闭合：找不到第二段 ---")] };
  }
  return { fmRaw: rest.slice(0, end).trimEnd(), body: rest.slice(end).replace(/^\n---[ \t]*/, "").replace(/^\n/, ""), issues: [] };
}

function toLines(block: string): SrcLine[] {
  return block.split("\n").map((line, i) => {
    const indent = line.match(/^[ \t]*/)?.[0].replace(/\t/g, "  ").length ?? 0;
    return { no: i + 1, indent, text: line.trim() };
  });
}

function parseScalar(raw: string): YamlValue {
  const s = raw.trim();
  if (s === "" || s === "~" || s === "null") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "{}") return {};
  if (s === "[]") return [];
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((p) => parseScalar(p.trim()) as YamlValue);
  }
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d+\.\d+$/.test(s) && !s.endsWith(".")) return Number(s);
  return s;
}

function parseFlow(lines: SrcLine[], start: number, parentIndent: number): { value: YamlValue; next: number } {
  const items: YamlValue[] = [];
  const obj: Record<string, YamlValue> = {};
  let mode: "unknown" | "seq" | "map" = "unknown";
  let i = start;

  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.text || line.text.startsWith("#")) {
      i += 1;
      continue;
    }
    if (line.indent < parentIndent) break;
    if (line.indent === parentIndent && start !== i && !line.text.startsWith("-") && mode === "seq") break;
    if (line.indent === parentIndent && start !== i && mode === "map" && line.text.startsWith("-")) break;
    if (line.indent < parentIndent) break;

    if (line.text.startsWith("- ")) {
      if (mode === "map") break;
      mode = "seq";
      const itemText = line.text.slice(2).trim();
      const dashIndent = line.indent;
      if (!itemText) {
        const nested = parseFlow(lines, i + 1, dashIndent + 1);
        items.push(nested.value);
        i = nested.next;
        continue;
      }
      if (itemText.includes(":") && !itemText.startsWith("[") && !/^['"]/.test(itemText)) {
        const colon = itemText.indexOf(":");
        const key = itemText.slice(0, colon).trim();
        const rest = itemText.slice(colon + 1).trim();
        const rec: Record<string, YamlValue> = {};
        if (rest) rec[key] = parseScalar(rest);
        else {
          const nested = parseFlow(lines, i + 1, dashIndent + 1);
          rec[key] = nested.value;
          i = nested.next;
          const more = parseFlow(lines, i, dashIndent + 1);
          if (more.value && typeof more.value === "object" && !Array.isArray(more.value)) {
            Object.assign(rec, more.value);
          }
          i = more.next;
          items.push(rec);
          continue;
        }
        const more = parseFlow(lines, i + 1, dashIndent + 1);
        if (more.value && typeof more.value === "object" && !Array.isArray(more.value)) {
          Object.assign(rec, more.value);
        }
        items.push(rec);
        i = more.next;
        continue;
      }
      items.push(parseScalar(itemText));
      i += 1;
      continue;
    }

    if (line.indent === parentIndent && mode === "seq") break;

    const colon = line.text.indexOf(":");
    if (colon < 0) {
      i += 1;
      continue;
    }
    mode = "map";
    const key = line.text.slice(0, colon).trim();
    const rest = line.text.slice(colon + 1).trim();
    if (rest) {
      obj[key] = parseScalar(rest);
      i += 1;
    } else {
      const nested = parseFlow(lines, i + 1, line.indent + 1);
      obj[key] = nested.value;
      i = nested.next;
    }
  }

  if (mode === "seq") return { value: items, next: i };
  return { value: obj, next: i };
}

function parseYamlObject(fmRaw: string): { value: Record<string, unknown>; issues: SkillParseIssue[] } {
  const issues: SkillParseIssue[] = [];
  if (!fmRaw.trim()) return { value: {}, issues: [issue("warning", "frontmatter 为空")] };
  const lines = toLines(fmRaw);
  try {
    const parsed = parseFlow(lines, 0, 0);
    if (parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value)) {
      return { value: parsed.value as Record<string, unknown>, issues };
    }
    issues.push(issue("error", "frontmatter 必须是 YAML 对象（key: value）"));
    return { value: {}, issues };
  } catch (err) {
    issues.push(issue("error", err instanceof Error ? err.message : "YAML 解析失败"));
    return { value: {}, issues };
  }
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((v) => asStringList(v))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,，]/)
      .flatMap((part) => part.split(MIDDLE_DOT))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (value == null) return [];
  return [String(value)];
}

function asStep(raw: unknown, index: number, issues: SkillParseIssue[]): ParsedSkillStep | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    issues.push(issue("error", `steps[${index}] 不是对象`));
    return null;
  }
  const rec = raw as Record<string, unknown>;
  const tool = String(rec.tool ?? "").trim();
  if (!tool) {
    issues.push(issue("error", `steps[${index}] 缺少 tool`));
    return null;
  }
  const id = String(rec.id ?? tool.replace(/[^\w-]+/g, "-") ?? `step-${index + 1}`);
  const label = String(rec.label ?? tool);
  const args = rec.args && typeof rec.args === "object" && !Array.isArray(rec.args) ? (rec.args as Record<string, unknown>) : {};
  return { id, label, tool, args };
}

function parseHeadings(body: string) {
  return body
    .split("\n")
    .map((line) => {
      const m = /^(#{1,4})\s+(.+)$/.exec(line.trim());
      return m ? { level: m[1]!.length, text: m[2]!.trim() } : null;
    })
    .filter((h): h is { level: number; text: string } => Boolean(h));
}

export function parseSkillMarkdown(raw: string): ParsedSkillDoc {
  const issues: SkillParseIssue[] = [];
  const split = splitFrontmatter(raw);
  issues.push(...split.issues);

  const yaml = parseYamlObject(split.fmRaw);
  issues.push(...yaml.issues);
  const fm = yaml.value;

  const name = String(fm.name ?? "").trim();
  const description = String(fm.description ?? "").trim();
  const triggers = asStringList(fm.triggers);
  const tools = asStringList(fm.tools);
  const stepRaw = Array.isArray(fm.steps) ? fm.steps : [];
  const steps = stepRaw.map((s, i) => asStep(s, i, issues)).filter((s): s is ParsedSkillStep => Boolean(s));

  if (!name) issues.push(issue("error", "frontmatter 缺少 name"));
  if (!description) issues.push(issue("warning", "frontmatter 缺少 description"));
  if (triggers.length === 0) issues.push(issue("warning", "triggers 为空：路由打分永远是 0"));
  if (steps.length === 0) issues.push(issue("warning", "没有 steps：可以浏览和解析，但不能运行"));

  const derivedTools = [...new Set([...tools, ...steps.map((s) => s.tool).filter((t) => !t.startsWith("__"))])];

  const errors = issues.filter((i) => i.level === "error");
  return {
    raw,
    frontmatterRaw: split.fmRaw,
    body: split.body.trim(),
    fm,
    name,
    description,
    triggers,
    tools: derivedTools,
    steps,
    headings: parseHeadings(split.body),
    issues,
    ok: errors.length === 0 && Boolean(name),
  };
}

export function hydrateSkill(raw: string, loc: { id: string; skillPath: string }): SkillManifestCore {
  const parsed = parseSkillMarkdown(raw);
  const name = parsed.name || loc.id;
  const steps = parsed.steps.map((s) => ({ ...s }));
  return {
    id: loc.id,
    name,
    description: parsed.description || name,
    skillPath: loc.skillPath,
    triggers: parsed.triggers,
    tools: parsed.tools,
    steps,
    manifest: raw,
    plan: steps.map((s) => s.label),
    parsed,
    runnable: parsed.ok && steps.length > 0,
  };
}

function lookupVar(ctx: SkillArgContext, token: string): unknown {
  if (token === "query") return ctx.query;
  if (token === "probeUrl") return ctx.probeUrl;
  if (token.startsWith("vars.")) return ctx.vars[token.slice(5)];
  return ctx.vars[token];
}

export function resolveStepArgs(args: unknown, ctx: SkillArgContext): Record<string, unknown> {
  const resolved = resolveValue(args, ctx);
  if (resolved && typeof resolved === "object" && !Array.isArray(resolved)) {
    return resolved as Record<string, unknown>;
  }
  return {};
}

function resolveValue(value: unknown, ctx: SkillArgContext): unknown {
  if (typeof value === "string") {
    const whole = value.trim();
    if (whole.startsWith("$") && !whole.includes(" ")) {
      return lookupVar(ctx, whole.slice(1));
    }
    const tpl = whole.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
      const found = lookupVar(ctx, key);
      return found == null ? "" : String(found);
    });
    if (tpl.startsWith("$") && !tpl.includes(" ")) return lookupVar(ctx, tpl.slice(1));
    return tpl;
  }
  if (Array.isArray(value)) return value.map((v) => resolveValue(v, ctx));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveValue(v, ctx);
    }
    return out;
  }
  return value;
}

export const SAMPLE_SKILL_MD = `---
name: sample-probe
description: 粘贴演示 — 一条 http_probe
triggers:
  - 探活
  - sample
tools:
  - http_probe
steps:
  - id: probe
    label: http_probe · HEAD
    tool: http_probe
    args:
      url: "{{probeUrl}}"
      method: HEAD
---

# sample-probe

解析器会抽出 name / triggers / tools / steps，运行时把 {{probeUrl}} 换成当前站点地址。
`;

export const SAMPLE_BROKEN_SKILL_MD = `---
name: broken-demo
description: 故意写坏，看解析诊断
triggers: [探活
tools: http_probe
steps
  - tool
---

缺闭合括号、steps 不是列表。
`;

export function skillIdFromPath(filePath: string) {
  const m = filePath.replace(/\\/g, "/").match(/skills\/([^/]+)\/SKILL\.md$/);
  return m?.[1] ?? "unknown";
}