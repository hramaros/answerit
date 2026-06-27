"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Interroge `fetcher` toutes les `intervalMs` ms tant que `active` est vrai.
 * `fetcher` doit renvoyer une valeur (ou lever). Nettoyage automatique.
 */
export function usePolling(fetcher, intervalMs = 1200, active = true) {
  const [data, setData] = useState(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const tick = async () => {
      try {
        const d = await fetcherRef.current();
        if (alive && d !== undefined) setData(d);
      } catch {
        /* on ignore les erreurs réseau transitoires */
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [active, intervalMs]);

  return data;
}
