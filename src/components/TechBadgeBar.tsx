export function TechBadgeBar({ items }: { items: string[] }) {
  return (
    <div className="tech-badge-bar">
      {items.map((t) => (
        <span key={t} className="tech-badge">{t}</span>
      ))}
    </div>
  );
}
