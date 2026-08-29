import type { FormEvent, JSX } from "react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  authMode: "login" | "register";
  setAuthMode: (mode: "login" | "register") => void;
  authUsername: string;
  setAuthUsername: (u: string) => void;
  authPassword: string;
  setAuthPassword: (p: string) => void;
  authName: string;
  setAuthName: (n: string) => void;
  authError: string;
  setAuthError: (e: string) => void;
  supportsPasskeys: boolean;
  onPasskeyLogin: () => void;
  onQuickPasskeyRegister: () => void;
  onAuthSubmit: (e: FormEvent) => void;
  pendingInvite?: string | null;
}

export function AuthModal({
  isOpen,
  onClose,
  authMode,
  setAuthMode,
  authUsername,
  setAuthUsername,
  authPassword,
  setAuthPassword,
  authName,
  setAuthName,
  authError,
  supportsPasskeys,
  onPasskeyLogin,
  onQuickPasskeyRegister,
  onAuthSubmit,
  pendingInvite,
}: AuthModalProps): JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="cd-sheet" onClick={() => onClose()}>
      <div className="cd-sheet-panel cd-notch" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="cd-label" style={{ color: "var(--gold-500)" }}>
            {authMode === "login" ? "LOG IN TO CYBERDRAGON" : "CREATE SQUAD ACCOUNT"}
          </div>
          <button onClick={() => onClose()} className="cd-btn cd-btn-ghost" style={{ padding: "4px 8px" }}>
            ✕
          </button>
        </div>
        {pendingInvite && (
          <div
            style={{
              padding: "8px 12px",
              background: "var(--surface-inset)",
              border: "1px solid var(--line-purple)",
              borderRadius: "var(--r-control)",
              marginBottom: 14,
              font: "var(--type-body-sm)",
              color: "var(--purple-200)",
              textAlign: "center",
            }}
          >
            ✨ Connecting you with <strong>@{pendingInvite}</strong> upon sign in
          </div>
        )}

        {supportsPasskeys && authMode === "login" && (
          <button
            onClick={onPasskeyLogin}
            className="cd-btn cd-btn-primary"
            style={{ width: "100%", padding: 12, fontSize: 13, marginBottom: 16, background: "var(--grad-brand)" }}
          >
            ⚡ 1-CLICK PASSKEY LOGIN
          </button>
        )}

        {supportsPasskeys && authMode === "register" && (
          <button
            onClick={onQuickPasskeyRegister}
            className="cd-btn cd-btn-primary"
            style={{ width: "100%", padding: 12, fontSize: 13, marginBottom: 16, background: "var(--grad-brand)" }}
          >
            ✨ 1-CLICK REGISTER WITH PASSKEY
          </button>
        )}

        {authError && <div style={{ color: "var(--coral-500)", font: "var(--type-body-sm)", marginBottom: 12 }}>{authError}</div>}

        <form onSubmit={onAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {authMode === "register" && (
            <input
              type="text"
              placeholder="Your Name (e.g. Alex)"
              value={authName}
              onChange={(e) => setAuthName(e.target.value)}
              style={{ padding: 10, borderRadius: "var(--r-control)", border: "1px solid var(--line-subtle)", backgroundColor: "var(--surface-inset)", color: "#fff", font: "var(--type-body-sm)" }}
              required
            />
          )}

          <input
            type="text"
            placeholder="Username"
            value={authUsername}
            onChange={(e) => setAuthUsername(e.target.value)}
            style={{ padding: 10, borderRadius: "var(--r-control)", border: "1px solid var(--line-subtle)", backgroundColor: "var(--surface-inset)", color: "#fff", font: "var(--type-body-sm)" }}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            style={{ padding: 10, borderRadius: "var(--r-control)", border: "1px solid var(--line-subtle)", backgroundColor: "var(--surface-inset)", color: "#fff", font: "var(--type-body-sm)" }}
            required
          />

          <button type="submit" className="cd-btn cd-btn-signal" style={{ padding: 12 }}>
            {authMode === "login" ? "LOG IN WITH PASSWORD" : "REGISTER WITH PASSWORD"}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: "center", font: "var(--type-body-sm)", color: "var(--text-tertiary)" }}>
          {authMode === "login" ? (
            <span>
              Need an account?{" "}
              <button onClick={() => setAuthMode("register")} style={{ color: "var(--gold-500)", border: "none", background: "none", cursor: "pointer" }}>
                Register
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{" "}
              <button onClick={() => setAuthMode("login")} style={{ color: "var(--gold-500)", border: "none", background: "none", cursor: "pointer" }}>
                Log In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
