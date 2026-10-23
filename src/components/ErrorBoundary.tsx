import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            minHeight: "260px",
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            background: "#ffffff",
            color: "#1e293b",
            borderRadius: "12px",
            margin: "1rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#fee2e2",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
              fontSize: "24px",
            }}
          >
            ⚠️
          </div>
          <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.15rem", fontWeight: 600 }}>
            {this.props.fallbackTitle ?? "界面加载遇到异常"}
          </h3>
          <p style={{ margin: "0 0 1.25rem 0", color: "#64748b", fontSize: "0.9rem", maxWidth: "480px" }}>
            {this.state.error?.message || "发生意外错误，请尝试重新加载该模块或刷新页面。"}
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                padding: "8px 16px",
                background: "#4f46e5",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "0.875rem",
              }}
            >
              重试恢复
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 16px",
                background: "transparent",
                color: "#475569",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "0.875rem",
              }}
            >
              刷新页面
            </button>
          </div>
          {import.meta.env.DEV && this.state.errorInfo && (
            <details
              style={{
                marginTop: "1.5rem",
                textAlign: "left",
                maxWidth: "600px",
                fontSize: "0.75rem",
                color: "#94a3b8",
                background: "#f8fafc",
                padding: "0.75rem",
                borderRadius: "6px",
                overflowX: "auto",
              }}
            >
              <summary style={{ cursor: "pointer", marginBottom: "0.5rem" }}>错误详情 (开发环境可见)</summary>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {this.state.error?.stack}
                {"\n"}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
