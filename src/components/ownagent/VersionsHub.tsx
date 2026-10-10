import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CATALOG_SETS_EVENT,
  currentHearing,
  deleteCatalogSet,
  faceSet,
  formatSavedAt,
  listCatalogSets,
  matchesLiveCatalog,
  promoteDraft,
  restoreCatalogSet,
  unpublishedLabels,
  type CatalogSet,
} from "../../lib/catalogSets";
import { SKILL_PUBLISH_EVENT } from "../../lib/skillCompareStore";
import { openProductView } from "./productNav";
import { RouteConfidencePanel } from "./RouteConfidence";
import { VersionGate } from "./VersionGate";

const NOTE_KEY = "oa-version-saved";

function readHubLists() {
  const all = listCatalogSets();
  return {
    versions: all.filter((set) => set.status !== "draft"),
    drafts: all.filter((set) => set.status === "draft"),
  };
}

function MenuIcon({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 版本页签：已保存和草稿在同一页切换。不改对话里每条回复自己的版本。 */
export function VersionsHub({ pane = "saved" }: { pane?: "saved" | "drafts" }) {
  const [boot] = useState(readHubLists);
  const [sets, setSets] = useState<CatalogSet[]>(boot.versions);
  const [drafts, setDrafts] = useState<CatalogSet[]>(boot.drafts);
  const [show, setShow] = useState<"saved" | "drafts">(pane);
  const [hearingId, setHearingId] = useState<string | null>(() => currentHearing()?.id ?? null);
  const [toast, setToast] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [ask, setAsk] = useState<"delete" | null>(null);
  const [gate, setGate] = useState<CatalogSet | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const savedTabRef = useRef<HTMLButtonElement>(null);
  const draftTabRef = useRef<HTMLButtonElement>(null);
  const [thumbReady, setThumbReady] = useState(false);

  function moveThumb(next: "saved" | "drafts") {
    const host = toolsRef.current;
    const btn = (next === "drafts" ? draftTabRef : savedTabRef).current;
    if (!host || !btn) return;
    host.style.setProperty("--seg-x", `${btn.offsetLeft}px`);
    host.style.setProperty("--seg-w", `${btn.offsetWidth}px`);
  }

  useLayoutEffect(() => {
    moveThumb(show);
  }, [show, sets.length, drafts.length]);

  useEffect(() => {
    setThumbReady(true);
  }, []);

  useEffect(() => {
    setShow(pane);
  }, [pane]);

  useEffect(() => {
    const refresh = () => {
      const next = readHubLists();
      setSets(next.versions);
      setDrafts(next.drafts);
      setHearingId(currentHearing()?.id ?? null);
    };
    window.addEventListener(CATALOG_SETS_EVENT, refresh);
    window.addEventListener(SKILL_PUBLISH_EVENT, refresh);
    return () => {
      window.removeEventListener(CATALOG_SETS_EVENT, refresh);
      window.removeEventListener(SKILL_PUBLISH_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    const note = sessionStorage.getItem(NOTE_KEY);
    if (!note) return;
    setToast(note);
    const clear = window.setTimeout(() => sessionStorage.removeItem(NOTE_KEY), 0);
    return () => window.clearTimeout(clear);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const hide = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(hide);
  }, [toast]);

  const currentId = useMemo(() => {
    const liveMatchId = sets.find((set) => matchesLiveCatalog(set))?.id ?? null;
    if (hearingId && sets.some((set) => set.id === hearingId && matchesLiveCatalog(set))) return hearingId;
    return liveMatchId;
  }, [sets, hearingId]);
  const rows = show === "drafts" ? drafts : sets;
  const menuSet = rows.find((set) => set.id === menuId) ?? null;
  const cover = gate ? unpublishedLabels() : [];

  useEffect(() => {
    if (!menuId) return;
    const onDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuId(null);
      setAsk(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuId(null);
      setAsk(null);
    };
    const close = () => {
      setMenuId(null);
      setAsk(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuId]);

  function openSet(set: CatalogSet) {
    openProductView("editset", { set: set.id });
  }

  function exportReport(set: CatalogSet) {
    const face = faceSet(set);
    const say = (text: string) => (text === "没人接" ? "没有技能接" : text);
    const changed = face.skills.filter((row) => row.mark !== "same");
    const lines = [
      `# ${set.name}`,
      "",
      `保存时间：${formatSavedAt(set.savedAt)}`,
      set.note ? `备注：${set.note}` : "",
      `状态：${set.status === "draft" ? "草稿" : "已保存"}`,
      `技能：${set.skills.length} 个`,
      "",
      "## 和现在",
      "",
      changed.length || face.asks.length
        ? `和现在不一样。${[changed.length ? `${changed.length} 个技能有差别` : "", face.asks.length ? `${face.asks.length} 句话会换技能` : ""].filter(Boolean).join("，")}。`
        : "和现在一样。问法交给的技能也没有变。",
      "",
    ];
    if (changed.length) {
      lines.push("## 技能", "");
      for (const row of changed) {
        lines.push(`- ${row.name}：${row.detail}`);
        lines.push(`  - 这一版：${say(row.thenSay)}`);
        lines.push(`  - 现在：${say(row.nowSay)}`);
      }
      lines.push("");
    }
    if (face.asks.length) {
      lines.push("## 问法", "");
      for (const row of face.asks) {
        lines.push(`- 「${row.q}」这一版交给${say(row.from)}，现在交给${say(row.to)}`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.filter((line) => line !== undefined).join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${set.name.replace(/[\\/:*?"<>|]/g, " ")}-报告.md`;
    link.click();
    URL.revokeObjectURL(url);
    closeMenu();
    setToast(`已导出「${set.name}」的报告`);
  }

  function closeMenu() {
    setMenuId(null);
    setAsk(null);
  }

  function restore(set: CatalogSet) {
    const result = restoreCatalogSet(set.id);
    closeMenu();
    setGate(null);
    if (!result.ok) {
      setToast(result.reason ?? "没有切换");
      return;
    }
    setToast(`已切到「${set.name}」`);
  }

  function remove(set: CatalogSet) {
    deleteCatalogSet(set.id);
    closeMenu();
    setToast(`已删除「${set.name}」`);
  }

  function promote(set: CatalogSet) {
    const saved = promoteDraft(set.id);
    closeMenu();
    if (!saved) return;
    setShow("saved");
    setToast(`「${saved.name}」已存成版本`);
  }

  return (
    <div className="oa-ui oa-page oa-version-hub">
      {toast ? <div className="own-skm-toast" role="status">{toast}</div> : null}
      <div className="oa-skill-toolbar">
        <div ref={toolsRef} className={thumbReady ? "oa-skill-tools is-ready" : "oa-skill-tools"} role="tablist" aria-label="版本和草稿">
          <span className="oa-seg-thumb" aria-hidden="true" />
          <button ref={savedTabRef} type="button" role="tab" aria-selected={show === "saved"} className={show === "saved" ? "oa-bar-btn is-on" : "oa-bar-btn"} onClick={() => { closeMenu(); moveThumb("saved"); setShow("saved"); }}>
            已保存 {sets.length}
          </button>
          <button ref={draftTabRef} type="button" role="tab" aria-selected={show === "drafts"} className={show === "drafts" ? "oa-bar-btn is-on" : "oa-bar-btn"} onClick={() => { closeMenu(); moveThumb("drafts"); setShow("drafts"); }}>
            草稿 {drafts.length}
          </button>
        </div>
        <RouteConfidencePanel />
        <button type="button" className="oa-skill-create" onClick={() => openProductView("savever")}>保存当前版本</button>
      </div>

      {rows.length ? (
        <ul className="own-skill-ver-grid">
          {rows.map((set) => {
            const current = show === "saved" && set.id === currentId;
            return (
              <li key={set.id} className={current ? "own-skill-ver-item oa-vtile is-live" : "own-skill-ver-item oa-vtile"}>
                <div className="own-skill-ver-card-inner">
                  <button type="button" className="own-skill-ver-card" onClick={() => openSet(set)}>
                    <header>
                      <strong>{set.name}</strong>
                      <span className="own-skill-ver-tag">{set.skills.length} 个技能</span>
                      {show === "drafts" ? <span className="own-skill-ver-tag">草稿</span> : null}
                    </header>
                    {set.note ? <p className="own-skill-ver-desc">{set.note}</p> : null}
                    <footer>
                      <span>{formatSavedAt(set.savedAt)}</span>
                      {current ? <span className="own-skill-ver-ok">正在用</span> : null}
                    </footer>
                  </button>
                </div>
                <div className={menuId === set.id ? "oa-ver-more is-open" : "oa-ver-more"}>
                  <button
                    type="button"
                    aria-label="更多"
                    aria-haspopup="menu"
                    aria-expanded={menuId === set.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (menuId === set.id) closeMenu();
                      else {
                        const rect = event.currentTarget.getBoundingClientRect();
                        setMenuPos({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) });
                        setAsk(null);
                        setMenuId(set.id);
                      }
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                      <circle cx="3" cy="7" r="1.15" fill="currentColor" />
                      <circle cx="7" cy="7" r="1.15" fill="currentColor" />
                      <circle cx="11" cy="7" r="1.15" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="oa-ver-empty">
          <strong>{show === "drafts" ? "还没有草稿" : "还没有保存过的版本"}</strong>
          <p>{show === "drafts" ? "保存时可以先存成草稿，改完再变成版本。" : "保存的是现在线上的技能。没发布的修改不会写进去。"}</p>
        </div>
      )}
      {menuId && menuSet && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              className="oa-ver-pop"
              role="menu"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              {ask === "delete" ? (
                <div className="oa-ver-more-ask">
                  <p>删除「{menuSet.name}」。线上正在用的技能不会变。</p>
                  <div>
                    <button type="button" onClick={() => setAsk(null)}>取消</button>
                    <button type="button" className="is-stop" onClick={() => remove(menuSet)}>删除</button>
                  </div>
                </div>
              ) : null}
              {ask ? null : (
                <>
                  {show === "saved" && rows.some((row) => row.id === menuSet.id && row.id === currentId) ? null : (
                    <button type="button" role="menuitem" onClick={() => openProductView("versions", { set: menuSet.id })}>
                      <span className="oa-ver-ico"><MenuIcon d="M2.2 3h4v9h-4zM8.8 3h4v9h-4z" /></span>
                      对比
                    </button>
                  )}
                  <button type="button" role="menuitem" onClick={() => exportReport(menuSet)}>
                    <span className="oa-ver-ico"><MenuIcon d="M7.5 2.2v6.2M4.6 6.2L7.5 9.1l2.9-2.9M3 12.2h9" /></span>
                    导出报告
                  </button>
                  {show === "drafts" ? (
                    <button type="button" role="menuitem" onClick={() => promote(menuSet)}>
                      <span className="oa-ver-ico"><MenuIcon d="M3 8l3 3 6-6.5" /></span>
                      存成版本
                    </button>
                  ) : null}
                  {show === "saved" && menuSet.id !== currentId ? (
                    <button type="button" role="menuitem" onClick={() => { const picked = menuSet; closeMenu(); setGate(picked); }}>
                      <span className="oa-ver-ico"><MenuIcon d="M2 5.2h7.6M7.4 2.6L10.8 5.2 7.4 7.8M13 9.8H5.4M7.6 7.2L4.2 9.8l3.4 2.6" /></span>
                      切换
                    </button>
                  ) : null}
                  <i />
                  <button type="button" role="menuitem" className="is-danger" onClick={() => setAsk("delete")}>
                    <span className="oa-ver-ico"><MenuIcon d="M3 4.4h9M5.4 4.4V2.8h4.2v1.6M4.6 4.4l.5 8h5l.5-8" /></span>
                    删除
                  </button>
                </>
              )}
            </div>,
            document.body,
          )
        : null}
      {gate ? (
        <VersionGate
          name={gate.name}
          versionId={gate.id}
          cover={cover}
          onClose={() => setGate(null)}
          onConfirm={() => restore(gate)}
        />
      ) : null}
    </div>
  );
}
