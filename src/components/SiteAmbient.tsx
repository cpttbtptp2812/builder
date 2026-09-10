/** 全站背景 — 纸感底 + 柔光 mesh + 细网格 */
export function SiteAmbient() {
  return (
    <div className="site-home-ambient" aria-hidden="true">
      <div className="site-ambient-base" />
      <div className="site-ambient-mesh" />
      <div className="site-ambient-grid" />
      <span className="site-ambient-blob site-ambient-blob-a" />
      <span className="site-ambient-blob site-ambient-blob-b" />
    </div>
  );
}
