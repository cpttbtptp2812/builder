import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SECRET_PASSWORD, unlockSecret } from "../data/secretGate";

type Props = {
  open: boolean;
  onClose: () => void;
};

/** 右上角星星 — 密码门 */
export function SecretStarModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue("");
    setError(false);
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim() === SECRET_PASSWORD) {
      unlockSecret();
      onClose();
      navigate("/for-you");
      return;
    }
    setError(true);
    setShaking(true);
    window.setTimeout(() => setShaking(false), 450);
  }

  return (
    <div className="star-gate-overlay" role="presentation" onClick={onClose}>
      <div
        className={`star-gate-modal${shaking ? " shake" : ""}`}
        role="dialog"
        aria-labelledby="star-gate-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="star-gate-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
        <p className="star-gate-eyebrow">✦</p>
        <h2 id="star-gate-title">输入密钥</h2>
        <p className="star-gate-hint">只有知道的人，才进得来。</p>
        <form onSubmit={submit}>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="······"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
          />
          {error ? <p className="star-gate-error">密钥不对，再想想？</p> : null}
          <button type="submit">进入</button>
        </form>
      </div>
    </div>
  );
}

export function SecretStarButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="site-header-star" onClick={onOpen} aria-label="星星">
      <span className="site-header-star-glow" aria-hidden="true" />
      <svg viewBox="0 0 24 24" aria-hidden="true" className="site-header-star-icon">
        <path
          className="site-header-star-shape"
          d="M12 5.5 13.15 10.2 17.85 11.35 13.15 12.5 12 17.2 10.85 12.5 6.15 11.35 10.85 10.2Z"
        />
        <circle className="site-header-star-dot" cx="12" cy="11.35" r="0.75" />
      </svg>
    </button>
  );
}
