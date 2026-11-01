import React from "react";
import { LoadingOutlined } from "@ant-design/icons";

export interface StudioButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "glass" | "ghost" | "danger" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  icon?: React.ReactNode;
  loading?: boolean;
}

export const StudioButton: React.FC<StudioButtonProps> = ({
  variant = "secondary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  children,
  style,
  className = "",
  ...rest
}) => {
  // 尺寸定义
  const sizeStyles: Record<string, React.CSSProperties> = {
    xs: {
      height: 26,
      padding: "0 8px",
      fontSize: 11.5,
      borderRadius: 6,
      gap: 4,
    },
    sm: {
      height: 32,
      padding: "0 12px",
      fontSize: 12,
      borderRadius: 7,
      gap: 5,
    },
    md: {
      height: 36,
      padding: "0 15px",
      fontSize: 13,
      borderRadius: 8,
      gap: 6,
    },
    lg: {
      height: 42,
      padding: "0 20px",
      fontSize: 14,
      borderRadius: 9,
      gap: 8,
    },
  };

  // 变体质感样式定义 (彻底告别 AntD 2018 生硬线框)
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: "linear-gradient(180deg, #4f46e5 0%, #4338ca 100%)",
      color: "#ffffff",
      border: "1px solid rgba(255, 255, 255, 0.18)",
      boxShadow:
        "0 1px 2px rgba(0, 0, 0, 0.08), 0 3px 8px rgba(79, 70, 229, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.22)",
      fontWeight: 600,
    },
    secondary: {
      background: "#ffffff",
      color: "#1e293b",
      border: "1px solid #cbd5e1",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
      fontWeight: 600,
    },
    glass: {
      background: "rgba(255, 255, 255, 0.75)",
      backdropFilter: "blur(6px)",
      color: "#334155",
      border: "1px solid rgba(203, 213, 225, 0.8)",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
      fontWeight: 500,
    },
    ghost: {
      background: "transparent",
      color: "#475569",
      border: "1px solid transparent",
      boxShadow: "none",
      fontWeight: 500,
    },
    danger: {
      background: "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)",
      color: "#ffffff",
      border: "1px solid rgba(255, 255, 255, 0.15)",
      boxShadow:
        "0 1px 2px rgba(0, 0, 0, 0.08), 0 3px 8px rgba(239, 68, 68, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.22)",
      fontWeight: 600,
    },
    success: {
      background: "linear-gradient(180deg, #059669 0%, #047857 100%)",
      color: "#ffffff",
      border: "1px solid rgba(255, 255, 255, 0.15)",
      boxShadow:
        "0 1px 2px rgba(0, 0, 0, 0.08), 0 3px 8px rgba(5, 150, 105, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.22)",
      fontWeight: 600,
    },
  };

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    transition: "all 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
    outline: "none",
    whiteSpace: "nowrap",
    letterSpacing: "0.2px",
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  return (
    <button
      disabled={disabled || loading}
      style={baseStyle}
      className={`studio-btn studio-btn-${variant} ${className}`}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.transform = "translateY(-1px)";
          if (variant === "secondary") {
            e.currentTarget.style.background = "#f8fafc";
            e.currentTarget.style.borderColor = "#94a3b8";
          } else if (variant === "ghost") {
            e.currentTarget.style.background = "rgba(0, 0, 0, 0.04)";
            e.currentTarget.style.color = "#0f172a";
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.transform = "translateY(0px)";
          if (variant === "secondary") {
            e.currentTarget.style.background = "#ffffff";
            e.currentTarget.style.borderColor = "#cbd5e1";
          } else if (variant === "ghost") {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#475569";
          }
        }
      }}
      onMouseDown={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.transform = "translateY(0.5px)";
        }
      }}
      onMouseUp={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      {...rest}
    >
      {loading ? <LoadingOutlined style={{ fontSize: 13 }} /> : icon}
      {children}
    </button>
  );
};

export default StudioButton;

