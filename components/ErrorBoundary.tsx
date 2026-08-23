import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Icon } from "./CyberDragonUi";
import { reportError } from "../lib/errorReporting";
import { APP_VERSION } from "../lib/version";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  contextName?: string;
  user?: { id: string; username: string } | null;
  appVersion?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  reported: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      reported: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (err) {
        console.error("Error in onError callback", err);
      }
    }

    const context = this.props.contextName
      ? `ErrorBoundary (${this.props.contextName})`
      : "React ErrorBoundary (Root)";

    void reportError(error, {
      context,
      user: this.props.user,
      appVersion: this.props.appVersion || APP_VERSION,
    }).then((success) => {
      if (success) {
        this.setState({ reported: true });
      }
    });
  }

  handleReload = (): void => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleResetAndReload = (): void => {
    if (typeof window !== "undefined") {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.error("Failed to clear web storage", e);
      }
      window.location.reload();
    }
  };

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      reported: false,
    });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const error = this.state.error;
    const fallbackTitle = this.props.fallbackTitle || "Something went wrong in the cybermatrix.";

    return (
      <div
        className="cd-page"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          background: "var(--canvas)",
          color: "var(--text-primary)",
        }}
      >
        <div
          className="cd-glass-panel"
          style={{
            maxWidth: 540,
            width: "100%",
            padding: "28px 24px",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            boxShadow: "0 12px 36px rgba(0, 0, 0, 0.6), 0 0 24px rgba(239, 68, 68, 0.15)",
          }}
        >
          {/* Header Eyebrow */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
              color: "var(--coral-500)",
            }}
          >
            <Icon name="octagon-alert" size={18} color="var(--coral-500)" />
            <span
              className="cd-label"
              style={{
                color: "var(--coral-500)",
                letterSpacing: "0.1em",
                fontWeight: 700,
              }}
            >
              SYSTEM MALFUNCTION // RECOVERY
            </span>
          </div>

          {/* Title & Description */}
          <h2
            style={{
              font: "var(--type-title-md)",
              color: "#FFFFFF",
              margin: "0 0 8px 0",
              fontSize: "1.25rem",
              lineHeight: 1.3,
            }}
          >
            {fallbackTitle}
          </h2>

          <p
            style={{
              font: "var(--type-body-sm)",
              color: "var(--text-secondary)",
              margin: "0 0 16px 0",
              lineHeight: 1.5,
            }}
          >
            An unexpected error occurred during rendering. An automated diagnostic report
            {this.state.reported ? " has been submitted" : " is being transmitted"} to con operations.
          </p>

          {/* Recovery Actions */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <button
              type="button"
              className="cd-btn cd-btn-primary"
              onClick={this.handleReload}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "12px 16px",
                background: "var(--purple-600)",
                color: "#FFFFFF",
                fontWeight: 600,
                cursor: "pointer",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
              }}
            >
              <Icon name="refresh-cw" size={16} color="#FFFFFF" />
              <span>Reload Application</span>
            </button>

            <button
              type="button"
              className="cd-btn"
              onClick={this.handleRetry}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "10px 16px",
                background: "rgba(255, 255, 255, 0.05)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
              }}
            >
              <span>Try Again</span>
            </button>

            <button
              type="button"
              className="cd-btn"
              onClick={this.handleResetAndReload}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "10px 16px",
                background: "rgba(239, 68, 68, 0.1)",
                color: "var(--coral-500)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              <span>Clear Cached Data & Reload</span>
            </button>
          </div>

          {/* Collapsible Technical Details */}
          {error && (
            <details
              style={{
                background: "rgba(0, 0, 0, 0.4)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                padding: "8px 12px",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-tertiary)",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  userSelect: "none",
                  outline: "none",
                }}
              >
                Diagnostic Details ({error.name}: {error.message})
              </summary>
              <div
                style={{
                  marginTop: 8,
                  maxHeight: 180,
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  lineHeight: 1.4,
                }}
              >
                {error.stack || error.message}
              </div>
            </details>
          )}
        </div>
      </div>
    );
  }
}
