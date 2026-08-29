export interface SharePayload {
  title: string;
  text?: string;
  url: string;
}

export async function shareLink(payload: SharePayload): Promise<{ shared: boolean; copied: boolean }> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return { shared: true, copied: false };
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        return { shared: false, copied: false };
      }
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(payload.url);
      return { shared: false, copied: true };
    } catch {
      return { shared: false, copied: false };
    }
  }

  return { shared: false, copied: false };
}

/** Copies arbitrary text to the clipboard. Unlike `shareLink` this never opens
 * a native share sheet — pasting a debug log into a share target is not the
 * intent. Returns false when the API is missing or the write is rejected
 * (clipboard writes require a secure context and a user gesture). */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  if (typeof navigator.clipboard.writeText !== "function") return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
