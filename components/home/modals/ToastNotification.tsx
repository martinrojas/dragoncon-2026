import type { JSX } from "react";
import type { ToastState } from "../homeTypes.ts";

interface ToastNotificationProps {
  toast: ToastState | null;
}

export function ToastNotification({ toast }: ToastNotificationProps): JSX.Element | null {
  if (!toast) return null;

  return (
    <div className="cd-toast-container">
      <div className={`cd-toast ${toast.type === "warn" ? "warn" : "ok"}`}>
        <span>{toast.message}</span>
        {toast.actionLabel && toast.onAction && (
          <button
            onClick={toast.onAction}
            style={{
              padding: "4px 10px",
              borderRadius: "var(--r-control)",
              backgroundColor: "rgba(255,255,255,.15)",
              border: "1px solid rgba(255,255,255,.3)",
              color: "#fff",
              font: "var(--type-micro)",
              cursor: "pointer",
            }}
          >
            {toast.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
