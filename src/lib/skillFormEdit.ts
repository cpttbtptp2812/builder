/** 表单编辑 SKILL.md — 只改动对应字段所在的行，其余内容原样保留 */

type Parts = { fm: string[]; body: string };

function split(raw: string): Parts | null {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return null;
  const fm = text.slice(4, end).split("\n");
  const body = text.slice(end + 4).replace(/^[ \t]*\n/, "");
  return { fm, body };
}

function join(p: Parts): string {
  const body = p.body.replace(/^\n+/, "");
  return `---\n${p.fm.join("\n")}\n---\n${body ? `\n${body}` : ""}`;
}

function blockRange(lines: string[], key: string): [number, number] | null {
  const i = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (i < 0) return null;
  let j = i + 1;
  while (j < lines.length && (lines[j]!.trim() === "" || /^\s/.test(lines[j]!))) j += 1;
  while (j - 1 > i && lines[j - 1]!.trim() === "") j -= 1;
  return [i, j];
}

function yamlScalar(v: string): string {
  if (v === "" || v !== v.trim() || /[:#"'{}[\],&*!|>%@`]/.test(v) || /^[-?]/.test(v)) {
    return JSON.stringify(v);
  }
  return v;
}

export function canFormEdit(raw: string): boolean {
  return split(raw) != null;
}

function edit(raw: string, fn: (p: Parts) => void): string {
  const p = split(raw);
  if (!p) return raw;
  fn(p);
  return join(p);
}

export function setDescription(raw: string, description: string): string {
  return edit(raw, (p) => {
    const line = `description: ${yamlScalar(description)}`;
    const r = blockRange(p.fm, "description");
    if (r) p.fm.splice(r[0], r[1] - r[0], line);
    else {
      const nameAt = p.fm.findIndex((l) => l.startsWith("name:"));
      p.fm.splice(nameAt + 1, 0, line);
    }
  });
}

export function setTriggers(raw: string, triggers: string[]): string {
  return edit(raw, (p) => {
    const lines = triggers.length ? ["triggers:", ...triggers.map((t) => `  - ${yamlScalar(t)}`)] : ["triggers: []"];
    const r = blockRange(p.fm, "triggers");
    if (r) p.fm.splice(r[0], r[1] - r[0], ...lines);
    else {
      const descAt = p.fm.findIndex((l) => l.startsWith("description:"));
      p.fm.splice(descAt + 1, 0, ...lines);
    }
  });
}

export function setBody(raw: string, body: string): string {
  return edit(raw, (p) => {
    p.body = body.trim() ? `${body.trim()}\n` : "";
  });
}

type StepBlock = { head: string[]; chunks: string[][]; indent: number };

function readSteps(p: Parts): { range: [number, number]; block: StepBlock } | null {
  const r = blockRange(p.fm, "steps");
  if (!r) return null;
  const inner = p.fm.slice(r[0] + 1, r[1]);
  const first = inner.findIndex((l) => /^\s*- /.test(l));
  if (first < 0) return null;
  const indent = inner[first]!.match(/^\s*/)![0].length;
  const itemStart = new RegExp(`^ {${indent}}- `);
  const chunks: string[][] = [];
  for (const line of inner.slice(first)) {
    if (itemStart.test(line) || chunks.length === 0) chunks.push([line]);
    else chunks[chunks.length - 1]!.push(line);
  }
  return { range: r, block: { head: inner.slice(0, first), chunks, indent } };
}

function writeSteps(p: Parts, range: [number, number], block: StepBlock) {
  const lines = [p.fm[range[0]]!, ...block.head, ...block.chunks.flat()];
  p.fm.splice(range[0], range[1] - range[0], ...lines);
}

export function moveStep(raw: string, index: number, delta: -1 | 1): string {
  return edit(raw, (p) => {
    const s = readSteps(p);
    if (!s) return;
    const to = index + delta;
    if (to < 0 || to >= s.block.chunks.length) return;
    const [item] = s.block.chunks.splice(index, 1);
    s.block.chunks.splice(to, 0, item!);
    writeSteps(p, s.range, s.block);
  });
}

export function removeStep(raw: string, index: number): string {
  return edit(raw, (p) => {
    const s = readSteps(p);
    if (!s || s.block.chunks.length <= 1) return;
    s.block.chunks.splice(index, 1);
    writeSteps(p, s.range, s.block);
  });
}

export function renameStep(raw: string, index: number, label: string): string {
  return edit(raw, (p) => {
    const s = readSteps(p);
    const chunk = s?.block.chunks[index];
    if (!s || !chunk) return;
    const at = chunk.findIndex((l) => /^\s*(- )?label:/.test(l));
    if (at >= 0) {
      const prefix = chunk[at]!.match(/^\s*(- )?/)![0];
      chunk[at] = `${prefix}label: ${yamlScalar(label)}`;
    } else {
      chunk.splice(1, 0, `${" ".repeat(s.block.indent + 2)}label: ${yamlScalar(label)}`);
    }
    writeSteps(p, s.range, s.block);
  });
}

export function splitTriggerInput(text: string): string[] {
  return text
    .split(/[,，、\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
}
