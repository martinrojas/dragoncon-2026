import type { JSX, SyntheticEvent } from "react";
import { ErrorBoundary } from "../ErrorBoundary";
import { APP_VERSION } from "../../lib/version";
import type { User } from "./adminTypes";

interface AdminAccessDeniedProps {
  currentUser: User | null;
  loginUsername: string;
  loginPassword: string;
  loginError: string;
  isLoggingIn: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: SyntheticEvent) => void;
}

export function AdminAccessDenied({
  currentUser,
  loginUsername,
  loginPassword,
  loginError,
  isLoggingIn,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: AdminAccessDeniedProps): JSX.Element {
  return (
    <ErrorBoundary
      contextName="AdminAccess"
      user={currentUser ? { id: currentUser.id, username: currentUser.username } : null}
      appVersion={APP_VERSION}
    >
      <div style={{ minHeight: "100vh", background: "#0a0612", color: "#fff", padding: "40px 20px" }}>
        <div style={{ maxWidth: 460, margin: "0 auto" }}>
          <div
            className="cd-glass-panel cd-notch"
            style={{
              padding: 30,
              background: "var(--surface-glass-strong)",
              border: "1px solid var(--coral-500)",
              borderRadius: "var(--r-3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span
                style={{
                  background: "rgba(248, 113, 113, 0.15)",
                  color: "var(--coral-500)",
                  border: "1px solid var(--coral-500)",
                  padding: "4px 8px",
                  fontSize: 11,
                  font: "var(--font-mono)",
                  fontWeight: 700,
                  borderRadius: 4,
                }}
              >
                RESTRICTED
              </span>
            </div>

            <h2 style={{ font: "var(--type-heading)", color: "var(--coral-500)", fontSize: 20, marginBottom: 8 }}>
              ACCESS DENIED
            </h2>
            <p style={{ font: "var(--type-body)", color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
              Administrator credentials required to access the CyberDragon Ingestion Dashboard.
            </p>

            {loginError && (
              <div
                style={{
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid var(--coral-500)",
                  color: "var(--coral-400)",
                  padding: "8px 12px",
                  fontSize: 12,
                  borderRadius: 4,
                  marginBottom: 16,
                }}
              >
                {loginError}
              </div>
            )}

            <form onSubmit={(e) => onSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="cd-label" style={{ display: "block", marginBottom: 4, fontSize: 11 }}>
                  ADMIN USERNAME
                </label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => onUsernameChange(e.target.value)}
                  placeholder="Enter admin username..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid var(--line-purple)",
                    color: "#fff",
                    borderRadius: 4,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label className="cd-label" style={{ display: "block", marginBottom: 4, fontSize: 11 }}>
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder="Enter password..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid var(--line-purple)",
                    color: "#fff",
                    borderRadius: 4,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="cd-btn cd-btn-signal"
                style={{ marginTop: 8, padding: "10px 16px", font: "var(--font-mono)", fontSize: 13 }}
              >
                {isLoggingIn ? "AUTHENTICATING..." : "[ 🔑 SIGN IN AS ADMIN ]"}
              </button>
            </form>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px dashed var(--line-purple)", textAlign: "center" }}>
              <a
                href="/"
                style={{
                  font: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--purple-300)",
                  textDecoration: "none",
                }}
              >
                ← Return to Schedule
              </a>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
