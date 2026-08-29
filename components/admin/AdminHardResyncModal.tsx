import type { JSX } from "react";

interface AdminHardResyncModalProps {
  isOpen: boolean;
  isSyncing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function AdminHardResyncModal({
  isOpen,
  isSyncing,
  onClose,
  onConfirm,
}: AdminHardResyncModalProps): JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
        padding: 20,
      }}
    >
      <div
        className="cd-glass-panel"
        style={{
          maxWidth: 480,
          width: "100%",
          padding: 24,
          border: "2px solid var(--coral-500)",
          borderRadius: "var(--r-3)",
          background: "#140a1c",
        }}
      >
        <h3 style={{ font: "var(--type-heading)", color: "var(--coral-500)", fontSize: 18, marginBottom: 12 }}>
          ⚠️ CONFIRM HARD RESYNC
        </h3>
        <p
          style={{
            font: "var(--type-body)",
            color: "var(--text-secondary)",
            fontSize: 13,
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          Hard Resync will wipe local schedule events for the targeted days and re-fetch them from upstream core-apps source.
          Are you sure you want to proceed with full schedule reset?
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            className="cd-btn cd-btn-ghost"
            style={{ padding: "8px 14px", fontSize: 12 }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSyncing}
            onClick={onConfirm}
            className="cd-btn"
            style={{
              padding: "8px 16px",
              background: "var(--coral-500)",
              color: "#fff",
              font: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            {isSyncing ? "EXECUTING..." : "CONFIRM HARD RESYNC"}
          </button>
        </div>
      </div>
    </div>
  );
}
