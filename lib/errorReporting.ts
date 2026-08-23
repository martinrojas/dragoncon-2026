import { APP_VERSION } from "./version.ts";

export interface ReportErrorOptions {
  context?: string;
  user?: { id: string; username: string } | null;
  appVersion?: string;
  pageUrl?: string;
  force?: boolean;
  fetcher?: typeof fetch;
}

const MAX_ERRORS_PER_SESSION = 3;
const reportedErrorSignatures = new Set<string>();
let errorReportCount = 0;

/**
 * Resets the session rate limit and deduplication state (useful for tests).
 */
export function resetErrorReportingLimits(): void {
  reportedErrorSignatures.clear();
  errorReportCount = 0;
}

/**
 * Redacts sensitive tokens, passwords, and authorization headers from error messages.
 */
function sanitizeString(input: string): string {
  let clean = input;
  // Redact Bearer tokens / JWTs
  clean = clean.replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, "Bearer [REDACTED]");
  clean = clean.replace(/eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, "[REDACTED_JWT]");
  // Redact password / secret query params or keys
  clean = clean.replace(/(password|secret|passkey|credentialId|token|auth)=([^&\s,;}]+)/gi, "$1=[REDACTED]");
  return clean;
}

/**
 * Formats an unknown error or exception into a sanitized, bounded message string.
 */
export function formatErrorMessage(error: unknown, contextInfo?: string): string {
  const parts: string[] = [];

  if (contextInfo) {
    parts.push(`[Auto-Report] Context: ${contextInfo}`);
  } else {
    parts.push("[Auto-Report] Unhandled Runtime Error");
  }

  if (error instanceof Error) {
    parts.push(`${error.name || "Error"}: ${error.message}`);
    if (error.stack) {
      parts.push(error.stack);
    }
  } else if (typeof error === "string") {
    parts.push(`Error: ${error}`);
  } else if (error && typeof error === "object") {
    try {
      parts.push(`Object: ${JSON.stringify(error)}`);
    } catch {
      parts.push(`Object: [Unserializable ${Object.prototype.toString.call(error)}]`);
    }
  } else {
    parts.push(`Error: ${String(error)}`);
  }

  const rawMessage = parts.join("\n");
  const sanitized = sanitizeString(rawMessage);

  const MAX_LEN = 2000;
  if (sanitized.length > MAX_LEN) {
    const truncateNotice = "\n...[truncated]";
    return sanitized.slice(0, MAX_LEN - truncateNotice.length) + truncateNotice;
  }

  return sanitized;
}

/**
 * Computes a lightweight signature for an error to prevent duplicate reports.
 */
export function createErrorSignature(error: unknown, contextInfo?: string): string {
  const context = contextInfo || "global";
  if (error instanceof Error) {
    const rawStackLine = error.stack ? error.stack.split("\n")[1]?.trim() || "" : "";
    const normalizedStackLine = rawStackLine.replace(/:\d+:\d+/g, "");
    return `${context}:${error.name}:${error.message}:${normalizedStackLine}`;
  }
  return `${context}:${String(error)}`;
}

/**
 * Automatically dispatches a bug report to the /api/feedback endpoint.
 */
export async function reportError(error: unknown, options: ReportErrorOptions = {}): Promise<boolean> {
  const {
    context,
    user,
    appVersion = typeof APP_VERSION !== "undefined" ? APP_VERSION : undefined,
    pageUrl = typeof window !== "undefined" ? window.location.href : undefined,
    force = false,
    fetcher = typeof fetch !== "undefined" ? fetch : undefined,
  } = options;

  if (!fetcher) {
    return false;
  }

  const signature = createErrorSignature(error, context);

  if (!force) {
    if (reportedErrorSignatures.has(signature)) {
      return false; // Skip duplicate
    }
    if (errorReportCount >= MAX_ERRORS_PER_SESSION) {
      return false; // Rate limit exceeded
    }
  }

  reportedErrorSignatures.add(signature);
  errorReportCount++;

  const message = formatErrorMessage(error, context);

  try {
    const res = await fetcher("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kind: "bug",
        message,
        contact: "Automated Error Report",
        userId: user?.id ?? null,
        username: user?.username ?? null,
        appVersion: appVersion ?? null,
        pageUrl: pageUrl ?? null,
      }),
    });

    return res.ok;
  } catch {
    // Fail silently without crashing the app or re-triggering error handlers
    return false;
  }
}

/**
 * Sets up global window error and unhandledrejection listeners.
 * Returns a cleanup unregister function.
 */
export function setupGlobalErrorCatchers(
  getUser?: () => { id: string; username: string } | null,
  appVersion: string = APP_VERSION,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onErrorHandler = (event: ErrorEvent) => {
    // Ignore trivial browser ResizeObserver errors or external script failures
    if (event.message?.includes("ResizeObserver loop") || event.message?.includes("Script error.")) {
      return;
    }

    const user = getUser ? getUser() : null;
    void reportError(event.error || event.message, {
      context: `window.onerror (${event.filename || "inline"}:${event.lineno || 0}:${event.colno || 0})`,
      user,
      appVersion,
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const user = getUser ? getUser() : null;
    void reportError(event.reason, {
      context: "window.onunhandledrejection",
      user,
      appVersion,
    });
  };

  window.addEventListener("error", onErrorHandler);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    window.removeEventListener("error", onErrorHandler);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}
