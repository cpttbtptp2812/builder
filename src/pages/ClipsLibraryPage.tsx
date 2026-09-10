import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  buildOpenUrl,
  clipHealth,
  clipsToMarkdown,
  DEFAULT_TOKEN,
  deleteClip,
  fetchClips,
  getClipToken,
  hostFrom,
  parseTagInput,
  setClipToken,
  updateClipTags,
  type ClipSnippet,
} from "../lib/clipHubClient";
import { SiteFooter } from "../components/SiteFooter";
import { SiteShell } from "../components/SiteShell";

type ViewMode = "list" | "site";

function formatTime(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function ClipItem({
  item,
  copied,
  onCopy,
  onDelete,
  onTags,
}: {
  item: ClipSnippet;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  onDelete: (id: string) => void;
  onTags: (id: string, tags: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [tagDraft, setTagDraft] = useState((item.tags ?? []).join(", "));
  const openUrl = buildOpenUrl(item);

  return (
    <li className="clips-lib-item">
      <div className="clips-lib-item-top">
        <strong>{item.title || hostFrom(item.pageUrl) || "网页片段"}</strong>
        <span>{formatTime(item.createdAt)}</span>
      </div>
      {(item.tags?.length ?? 0) > 0 && !editing && (
        <div className="clips-lib-tags">
          {item.tags!.map((t) => (
            <span key={t} className="clips-lib-tag">
              {t}
            </span>
          ))}
        </div>
      )}
      {editing ? (
        <div className="clips-lib-tag-edit">
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            placeholder="标签，逗号分隔"
          />
          <button
            type="button"
            onClick={() => {
              void onTags(item.id, parseTagInput(tagDraft));
              setEditing(false);
            }}
          >
            保存
          </button>
          <button type="button" className="ghost" onClick={() => setEditing(false)}>
            取消
          </button>
        </div>
      ) : null}
      <blockquote>{item.content}</blockquote>
      {item.pageUrl && (
        <p className="clips-lib-source">
          {hostFrom(item.pageUrl)}
          {openUrl && (
            <a href={openUrl} target="_blank" rel="noopener noreferrer">
              打开来源
            </a>
          )}
        </p>
      )}
      <div className="clips-lib-item-actions">
        <button type="button" onClick={() => void onCopy(item.content, item.id)}>
          {copied === item.id ? "已复制" : "复制正文"}
        </button>
        <button type="button" onClick={() => setEditing(true)}>
          编辑标签
        </button>
        <button type="button" className="danger" onClick={() => void onDelete(item.id)}>
          删除
        </button>
      </div>
    </li>
  );
}

export function ClipsLibraryPage() {
  const [token, setToken] = useState(getClipToken);
  const [items, setItems] = useState<ClipSnippet[]>([]);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");
  const [statusMsg, setStatusMsg] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    const health = await clipHealth();
    if (!health.ok) {
      setStatus("offline");
      setStatusMsg(health.error ?? "离线");
      setItems([]);
      return;
    }
    setStatus("online");
    setStatusMsg(`已同步 ${health.snippets ?? 0} 条`);
    const { items: list, error } = await fetchClips();
    if (error) {
      setStatus("offline");
      setStatusMsg(error);
      return;
    }
    setItems(list);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      for (const t of item.tags ?? []) set.add(t);
    }
    return [...set].sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (tagFilter && !(item.tags ?? []).includes(tagFilter)) return false;
      if (!q) return true;
      const hay = [
        item.content,
        item.title,
        item.pageTitle ?? "",
        hostFrom(item.pageUrl),
        ...(item.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, tagFilter]);

  const groupedBySite = useMemo(() => {
    const map = new Map<string, ClipSnippet[]>();
    for (const item of filtered) {
      const host = hostFrom(item.pageUrl) || "未分类";
      if (!map.has(host)) map.set(host, []);
      map.get(host)!.push(item);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  async function saveToken() {
    setClipToken(token);
    await load();
  }

  async function onDelete(id: string) {
    if (!confirm("删除这条片段？")) return;
    await deleteClip(id);
    await load();
  }

  async function onTags(id: string, tags: string[]) {
    await updateClipTags(id, tags);
    await load();
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 800);
  }

  return (
    <SiteShell pageClass="site-clips-lib">
      <header className="clips-lib-head">
        <p className="site-home-eyebrow">ClipHub</p>
        <h1>片段库</h1>
        <p className="site-tagline">搜索、标签、按站点分组。与浏览器扩展同步。</p>
        <p className={`clips-lib-status clips-lib-status--${status}`}>
          {status === "loading" ? "连接中…" : statusMsg}
        </p>
      </header>

      <section className="clip-hub-panel clips-lib-setup">
        <h2>连接</h2>
        <div className="clips-lib-token-row">
          <label htmlFor="clip-token">Token</label>
          <input
            id="clip-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={DEFAULT_TOKEN}
            spellCheck={false}
          />
          <button type="button" className="clips-lib-btn" onClick={() => void saveToken()}>
            保存
          </button>
        </div>
        <p className="clips-lib-hint">
          <code>npm run dev:full</code> · 默认 token <code>{DEFAULT_TOKEN}</code>
        </p>
      </section>

      <section className="clip-hub-panel">
        <div className="clips-lib-toolbar">
          <input
            className="clips-lib-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="全文搜索：正文、标题、站点、标签…"
          />
          <div className="clips-lib-view-toggle">
            <button
              type="button"
              className={viewMode === "list" ? "on" : ""}
              onClick={() => setViewMode("list")}
            >
              列表
            </button>
            <button
              type="button"
              className={viewMode === "site" ? "on" : ""}
              onClick={() => setViewMode("site")}
            >
              按站点
            </button>
          </div>
          <button type="button" className="clips-lib-btn ghost" onClick={() => void load()}>
            刷新
          </button>
          <button
            type="button"
            className="clips-lib-btn primary"
            onClick={() => void copyText(clipsToMarkdown(filtered), "export")}
            disabled={!filtered.length}
          >
            {copied === "export" ? "已复制" : "导出 Markdown"}
          </button>
        </div>

        {allTags.length > 0 && (
          <div className="clips-lib-tag-filters">
            <button
              type="button"
              className={`clips-lib-tag-filter${tagFilter === null ? " on" : ""}`}
              onClick={() => setTagFilter(null)}
            >
              全部
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                className={`clips-lib-tag-filter${tagFilter === t ? " on" : ""}`}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
              >
                #{t}
              </button>
            ))}
          </div>
        )}

        {!filtered.length ? (
          <p className="clips-lib-empty">
            {status === "offline" ? "同步服务未连接。" : "暂无片段。"}{" "}
            <Link to="/tools/extensions">安装联调工具包（含 ClipHub）</Link>
          </p>
        ) : viewMode === "list" ? (
          <ul className="clips-lib-list">
            {filtered.map((item) => (
              <ClipItem
                key={item.id}
                item={item}
                copied={copied}
                onCopy={copyText}
                onDelete={onDelete}
                onTags={onTags}
              />
            ))}
          </ul>
        ) : (
          <div className="clips-lib-site-groups">
            {groupedBySite.map(([host, group]) => (
              <section key={host} className="clips-lib-site-group">
                <h3>
                  {host} <span>{group.length}</span>
                </h3>
                <ul className="clips-lib-list">
                  {group.map((item) => (
                    <ClipItem
                      key={item.id}
                      item={item}
                      copied={copied}
                      onCopy={copyText}
                      onDelete={onDelete}
                      onTags={onTags}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <p className="clip-hub-back">
        <Link to="/tools/extensions">← 联调工具包</Link>
      </p>
      <SiteFooter />
    </SiteShell>
  );
}
