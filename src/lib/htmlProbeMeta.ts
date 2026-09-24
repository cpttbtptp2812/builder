/** 从 HTML 探活结果提取页面元信息 */

export type HtmlProbeMeta = {
  title: string | null;
  description: string | null;
  statusOk: boolean;
  hasSearchInput: boolean;
  bytes: number;
};

export function extractHtmlMeta(html: string): HtmlProbeMeta {
  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1]?.trim() ??
    null;
  const statusOk = /<!--\s*STATUS OK\s*-->/.test(html);
  const hasSearchInput =
    /<input[^>]+(?:name=["']wd["']|id=["']kw["'])/i.test(html) ||
    /<input[^>]+type=["']search["']/i.test(html);

  return {
    title,
    description: description ? description.slice(0, 160) : null,
    statusOk,
    hasSearchInput,
    bytes: html.length,
  };
}

export function buildProbeBodyFromHtml(html: string, previewLen = 800) {
  const meta = extractHtmlMeta(html);
  return {
    bytes: meta.bytes,
    preview: html.slice(0, previewLen),
    pageTitle: meta.title,
    pageDescription: meta.description,
    statusOk: meta.statusOk,
    hasSearchInput: meta.hasSearchInput,
  };
}

/** 读取 HTML 时上限，避免超大页拖垮内存 */
export const PROBE_HTML_MAX = 512 * 1024;

export async function readProbeHtml(res: Response): Promise<string> {
  const text = await res.text();
  return text.length > PROBE_HTML_MAX ? text.slice(0, PROBE_HTML_MAX) : text;
}
