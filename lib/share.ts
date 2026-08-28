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
