import { useState, type JSX } from "react";
import type { IngestionRun } from "./adminTypes";
import { copyText } from "../../lib/share";

interface AdminRunLogModalProps {
  run: IngestionRun | null;
  onClose: () => void;
}

export function AdminRunLogModal({ run, onClose }: AdminRunLogModalProps): JSX.Element | null {
  // Hooks must run before the null guard below, so this cannot move inside it.
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");

  if (!run) return null;

  const handleCopy = async (): Promise<void> => {
    if (!run.log) return;
    const ok = await copyText(run.log);
    setCopyState(ok ? "ok" : "fail");
    setTimeout(() => setCopyState("idle"), 2000);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.8)",
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
          maxWidth: 720,
          width: "100%",
          padding: 20,
          background: "#0c0717",
          border: "1px solid var(--purple-400)",
          borderRadius: "var(--r-3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ font: "var(--type-heading)", color: "var(--gold-400)", fontSize: 16 }}>
            📜 RUN #{run.id} LOG OUTPUT
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!run.log}
              className="cd-btn cd-btn-ghost"
              style={{
                padding: "4px 8px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                opacity: run.log ? 1 : 0.4,
                cursor: run.log ? "pointer" : "not-allowed",
                color: copyState === "ok" ? "var(--gold-400)" : copyState === "fail" ? "var(--coral-500)" : undefined,
              }}
              title="Copy the full log to the clipboard"
            >
              {copyState === "ok" ? "✓ Copied" : copyState === "fail" ? "✕ Copy failed" : "⧉ Copy log"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cd-btn cd-btn-ghost"
              style={{ padding: "4px 8px", fontSize: 12 }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        <div
          style={{
            maxHeight: 360,
            overflowY: "auto",
            padding: 12,
            background: "#05030a",
            borderRadius: 4,
            fontFamily: "JetBrains Mono, monospace, var(--font-mono)",
            fontSize: 12,
            lineHeight: 1.45,
            color: "#e2e8f0",
          }}
        >
          {run.log ? (
            run.log.split("\n").map((line, idx) => (
              <div key={idx} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {line}
              </div>
            ))
          ) : (
            <div style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>
              No log content recorded for this run.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
