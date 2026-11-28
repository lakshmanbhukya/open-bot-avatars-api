import { useCallback, useEffect, useRef, useState } from "react";
import { siteOrigin } from "../../lib/site-url";

export function useSiteOrigin() {
  const [origin, setOrigin] = useState(() => siteOrigin());
  useEffect(() => setOrigin(siteOrigin(window.location.origin)), []);
  return origin;
}

export function usePrefersReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const mql = matchMedia(query);
    setReduced(mql.matches);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** useState mirrored to localStorage. `revive` may reject stored data by returning undefined. */
export function useStoredState<T>(key: string, initial: T, revive?: (raw: unknown) => T | undefined) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        const revived = revive ? revive(parsed) : (parsed as T);
        if (revived !== undefined) setValue(revived);
      }
    } catch {
      // A missing or invalid preference keeps the default.
    }
    setLoaded(true);
  }, [key, revive]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage may be full or disabled; the studio still works for this session.
    }
  }, [key, value, loaded]);
  return [value, setValue, loaded] as const;
}

/** Returns a flash flag that turns on for a moment after `trigger()`. */
export function useFlash(ms = 1600) {
  const [on, setOn] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const trigger = useCallback(() => {
    setOn(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOn(false), ms);
  }, [ms]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [on, trigger] as const;
}
