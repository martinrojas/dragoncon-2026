import type { JSX } from "react";
import type { User } from "./homeTypes";

interface HomeBannersProps {
  syncStatusMsg: string;
  pendingInvite: string | null;
  currentUser: User | null;
  onAcceptInvite: () => void;
  onDismissInvite: () => void;
  onOpenRegister: () => void;
}

export function HomeBanners({
  syncStatusMsg,
  pendingInvite,
  currentUser,
  onAcceptInvite,
  onDismissInvite,
  onOpenRegister,
}: HomeBannersProps): JSX.Element {
  return (
    <>
      {/* Sync Notification Banner */}
      {syncStatusMsg && (
        <div
          style={{
            backgroundColor: "var(--purple-900)",
            borderBottom: "1px solid var(--line-purple)",
            color: "var(--gold-500)",
            padding: "6px var(--gutter)",
            textAlign: "center",
            font: "var(--type-data)",
            fontSize: 12,
          }}
        >
          {syncStatusMsg}
        </div>
      )}

      {/* Squad Invite Banner (Logged In or Guest) */}
      {pendingInvite && (!currentUser || pendingInvite.toLowerCase() !== currentUser.username.toLowerCase()) && (
        <div style={{ padding: "12px var(--gutter) 0" }}>
          <div
            className="cd-glass-panel cd-notch"
            style={{
              maxWidth: 900,
              margin: "0 auto",
              padding: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              borderColor: "var(--line-purple)",
              background: "var(--surface-glass-strong)",
            }}
          >
            <span style={{ font: "var(--type-body-sm)", color: "var(--text-primary)" }}>
              ✨ <strong style={{ color: "var(--gold-500)" }}>@{pendingInvite}</strong> invited you to join their
              Dragon Con squad!
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {currentUser ? (
                <button type="button" onClick={onAcceptInvite} className="cd-btn cd-btn-primary">
                  ✓ ADD TO SQUAD
                </button>
              ) : (
                <button type="button" onClick={onOpenRegister} className="cd-btn cd-btn-signal">
                  ⚡ LOG IN / REGISTER
                </button>
              )}
              <button type="button" onClick={onDismissInvite} className="cd-btn cd-btn-ghost">
                ✕ DISMISS
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
