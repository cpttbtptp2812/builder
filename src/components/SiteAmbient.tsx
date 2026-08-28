/** 全站背景 — 柔和极光 mesh + 浮动色块 */
export function SiteAmbient() {
  return (
    <div className="site-home-ambient" aria-hidden="true">
      <div className="site-ambient-mesh" />
      <span className="site-ambient-blob site-ambient-blob-a" />
      <span className="site-ambient-blob site-ambient-blob-b" />
      <span className="site-ambient-blob site-ambient-blob-c" />
      <span className="site-ambient-grain" />
    </div>
  );
}
