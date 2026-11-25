"use client";

import { useCallback, useEffect, useState } from "react";

/** Generic async resource with manual + interval refresh. */
export function useResource<T>(
  loader: (() => Promise<T>) | null,
  deps: unknown[],
  pollMs = 0,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!loader) return;
    setLoading(true);
    try {
      setData(await loader());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void refresh();
    if (!pollMs || !loader) return;
    const id = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, pollMs]);

  return { data, loading, error, refresh };
}

/**
 * Value derived from user input (an address, an amount): null while the
 * input is not usable, and responses that arrive after the input changed are
 * dropped so a slow request never overwrites a newer one.
 */
export function useLookup<T>(loader: (() => Promise<T>) | null, deps: unknown[]): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!loader) {
      setData(null);
      return;
    }
    let active = true;
    loader()
      .then((value) => active && setData(value))
      .catch(() => active && setData(null));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return data;
}
