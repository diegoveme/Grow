"use client";

import { useCallback, useState } from "react";

/** Clipboard copy with a transient "copied" flag. */
export function useCopy(timeout = 1400) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), timeout);
      } catch {
        /* clipboard unavailable */
      }
    },
    [timeout],
  );
  return { copied, copy };
}
