import type React from "react";

/** OwnAgent 产品页统一 UI */
export function OaPage({
  title,
  desc,
  toast,
  actions,
  children,
}: {
  title: string;
  desc?: string;
  toast?: string | null;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="oa-ui oa-page">
      <header className="oa-page-head">
        <div className="oa-page-head-main">
          <h1>{title}</h1>
          {desc ? <p>{desc}</p> : null}
        </div>
        {(toast || actions) && (
          <div className="oa-page-head-side">
            {toast ? <span className="oa-toast">{toast}</span> : null}
            {actions}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}

export function OaTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label?: string;
}) {
  return (
    <nav className="oa-tabs" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={value === t.id ? "on" : ""}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

/** 固定 16×16，勾选/未勾选尺寸一致 */
export function OaCheck({
  checked,
  onChange,
  label,
  hint,
  compact,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  hint?: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={`oa-check${compact ? " oa-check--compact" : ""}${disabled ? " disabled" : ""}`}>
      <span className="oa-check-box">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <svg className="oa-check-mark" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M2 5.2l2 2 4-4.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      <span className="oa-check-text">
        <strong>{label}</strong>
        {hint && !compact ? <em>{hint}</em> : null}
      </span>
    </label>
  );
}

export function OaField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`oa-field${className ? ` ${className}` : ""}`}>
      <span className="oa-field-label">{label}</span>
      {hint ? <span className="oa-field-hint">{hint}</span> : null}
      {children}
    </label>
  );
}

export function OaInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`oa-input${props.className ? ` ${props.className}` : ""}`} />;
}

export function OaTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`oa-textarea${props.className ? ` ${props.className}` : ""}`} />;
}

export function OaSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`oa-select${props.className ? ` ${props.className}` : ""}`} />;
}

export function OaCard({
  children,
  muted,
  className,
}: {
  children: React.ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return <article className={`oa-card${muted ? " muted" : ""}${className ? ` ${className}` : ""}`}>{children}</article>;
}

export function OaBtn({
  variant = "primary",
  size,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm";
}) {
  return (
    <button
      type="button"
      {...props}
      className={`oa-btn ${variant}${size === "sm" ? " sm" : ""}${props.className ? ` ${props.className}` : ""}`}
    >
      {children}
    </button>
  );
}

export function OaBadge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "ok" | "warn" | "danger" | "info";
  children: React.ReactNode;
}) {
  return <span className={`oa-badge ${tone}`}>{children}</span>;
}

export function OaSearchRow({
  value,
  onChange,
  onSubmit,
  placeholder,
  buttonLabel = "搜索",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  buttonLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="oa-search-row">
      <OaInput
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
      />
      <OaBtn onClick={onSubmit} disabled={disabled}>
        {buttonLabel}
      </OaBtn>
    </div>
  );
}

export function OaChips({
  items,
  onPick,
  disabled,
}: {
  items: string[];
  onPick: (item: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="oa-chips">
      {items.map((item) => (
        <button key={item} type="button" disabled={disabled} onClick={() => onPick(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}

export function OaStatGrid({
  items,
}: {
  items: { label: string; value: React.ReactNode; hint?: string; tone?: "ok" | "warn" }[];
}) {
  return (
    <div className="oa-stat-grid">
      {items.map((item) => (
        <div key={item.label} className={`oa-stat${item.tone ? ` ${item.tone}` : ""}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.hint ? <em>{item.hint}</em> : null}
        </div>
      ))}
    </div>
  );
}

export function OaEmpty({ children }: { children: React.ReactNode }) {
  return <p className="oa-empty">{children}</p>;
}

export function OaStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`oa-stack${className ? ` ${className}` : ""}`}>{children}</div>;
}

export function OaToolbar({
  lead,
  actions,
}: {
  lead?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="oa-toolbar">
      {lead ? <div className="oa-toolbar-lead">{lead}</div> : null}
      {actions ? <div className="oa-toolbar-actions">{actions}</div> : null}
    </div>
  );
}
