import React, { useState } from "react";
import { SegmentedControl } from "../components/CyberDragonUi";
import { APP_VERSION } from "../lib/version";

export interface FeedbackPanelProps {
  user: { id: string; username: string } | null;
  onNotify: (message: string, type?: "ok" | "warn") => void;
}

export function FeedbackPanel({ user, onNotify }: FeedbackPanelProps): React.JSX.Element {
  const [kind, setKind] = useState<"bug" | "idea">("bug");
  const [message, setMessage] = useState<string>("");
  const [contact, setContact] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);

  const handleSubmit = async (e?: React.SyntheticEvent): Promise<void> => {
    if (e) e.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const payload = {
        kind,
        message: trimmedMessage,
        contact: contact.trim().length > 0 ? contact.trim() : null,
        userId: user?.id ?? null,
        username: user?.username ?? null,
        appVersion: APP_VERSION,
        pageUrl: typeof window !== "undefined" ? window.location.href : null,
      };

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: unknown = await res.json().catch(() => ({}));
      const isSuccess =
        typeof data === "object" &&
        data !== null &&
        "success" in data &&
        Boolean((data as { success: unknown }).success);

      if (isSuccess) {
        setMessage("");
        setContact("");
        setSent(true);
        onNotify("Thanks — your note is in.");
      } else {
        const errorText =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Couldn't send that — try again";
        onNotify(errorText, "warn");
      }
    } catch {
      onNotify("Couldn't send that — try again", "warn");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="cd-glass-panel" style={{ padding: "12px 16px" }}>
      <div className="cd-label" style={{ marginBottom: 4, color: "var(--gold-500)" }}>
        REPORT A BUG OR SUGGEST AN IDEA
      </div>

      <div style={{ font: "var(--type-body-sm)", color: "var(--text-secondary)", marginBottom: 12 }}>
        Found something broken or have an idea? Tell us — it goes straight to the team.
      </div>

      {sent && (
        <div
          style={{
            font: "var(--type-body-sm)",
            color: "var(--jade-500)",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>✓</span> Sent — thank you.
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)}>
        <SegmentedControl
          size="sm"
          options={[
            { value: "bug", label: "🐞 Something's broken" },
            { value: "idea", label: "💡 I have an idea" },
          ]}
          value={kind}
          onChange={(val) => setKind(val === "idea" ? "idea" : "bug")}
          style={{ marginBottom: 10 }}
        />

        <textarea
          rows={4}
          maxLength={2000}
          placeholder="What happened, or what would you like to see?"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (sent) setSent(false);
          }}
          style={{
            padding: 10,
            borderRadius: "var(--r-control)",
            border: "1px solid var(--line-subtle)",
            backgroundColor: "var(--surface-inset)",
            color: "#fff",
            font: "var(--type-body-sm)",
            width: "100%",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            font: "var(--type-micro)",
            color: message.length >= 2000 ? "var(--coral-500)" : "var(--text-tertiary)",
            marginTop: 2,
            marginBottom: 8,
          }}
        >
          {message.length}/2000
        </div>

        <input
          type="text"
          placeholder="Email or handle (optional, if you want a reply)"
          maxLength={200}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          style={{
            padding: "8px 10px",
            borderRadius: "var(--r-control)",
            border: "1px solid var(--line-subtle)",
            backgroundColor: "var(--surface-inset)",
            color: "#fff",
            font: "var(--type-body-sm)",
            width: "100%",
            boxSizing: "border-box",
            marginBottom: 12,
          }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            className="cd-btn cd-btn-primary"
            style={{ fontSize: 12, padding: "8px 16px" }}
            disabled={isSubmitting || message.trim().length === 0}
          >
            {isSubmitting ? "Sending…" : "Send Feedback"}
          </button>
        </div>
      </form>
    </div>
  );
}
