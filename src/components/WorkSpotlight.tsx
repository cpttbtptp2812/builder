/** 每个作品页顶部的「核心能力」说明 */
export function WorkSpotlight({
  tag,
  title,
  hint,
  children,
}: {
  tag: string;
  title: string;
  hint: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="work-spotlight">
      <div className="work-spotlight-text">
        <span className="work-spotlight-tag">{tag}</span>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      {children && <div className="work-spotlight-action">{children}</div>}
    </div>
  );
}
