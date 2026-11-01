import React from "react";
import { ArrowLeftOutlined } from "@ant-design/icons";

export interface StudioBreadcrumbProps {
  onBack: () => void;
  backLabel: string;
  currentTitle: string;
  badge?: React.ReactNode;
  rightActions?: React.ReactNode;
}

export const StudioBreadcrumb: React.FC<StudioBreadcrumbProps> = ({
  onBack,
  backLabel,
  currentTitle,
  badge,
  rightActions,
}) => {
  return (
    <div
      style={{
        background: "#ffffff",
        padding: "10px 18px",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
        flexShrink: 0,
      }}
    >
      {/* 左侧：轻量无边框面包屑返回 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            outline: "none",
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "#64748b",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f1f5f9";
            e.currentTarget.style.color = "#0f172a";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#64748b";
          }}
        >
          <ArrowLeftOutlined style={{ fontSize: 12 }} />
          <span>{backLabel}</span>
        </button>

        <span style={{ color: "#cbd5e1", fontSize: 13, userSelect: "none" }}>/</span>

        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              color: "#0f172a",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {currentTitle}
          </span>
          {badge}
        </div>
      </div>

      {/* 右侧：操作动作区 (通常只有保存主按钮，杜绝多余取消按钮) */}
      {rightActions && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {rightActions}
        </div>
      )}
    </div>
  );
};

export default StudioBreadcrumb;

