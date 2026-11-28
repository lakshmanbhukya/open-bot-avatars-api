import { examples } from "open-bot-avatar";
import { lazy, useEffect, useRef, useState } from "react";
import { BotAvatar } from "./BotAvatar";
import { GALLERY } from "./gallery";
import { usePrefersReducedMotion } from "./studio/hooks";

const LibrariesAvatar = lazy(() => import("./LibrariesAvatar"));

/** The API selection, rendered live with its collection's original animation engine. */
export function ApiAvatar({ collection, id, color, style, src, name }: {
  collection: string; id: string; color: string; style: string; src: string; name: string;
}) {
  const reduced = usePrefersReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const hop = useRef<Animation | null>(null);
  const [view, setView] = useState({ yaw: 0, pitch: 0 });
  const [jumping, setJumping] = useState(false);
  const label = `${name}, ${style} animated preview`;
  const definition = collection === "open-bot-avatar"
    ? [...examples, ...GALLERY].find(entry => entry.id === id) : undefined;
  const fallback = <img src={src} alt={`${name}, actual ${style} PNG response`} width="512" height="512" />;
  const interactive = !!definition && !reduced;

  useEffect(() => {
    setView({ yaw: 0, pitch: 0 });
    setJumping(false);
    if (!interactive) return;
    jump();
    const timer = window.setInterval(jump, 10000);
    return () => {
      window.clearInterval(timer);
      cancelAnimationFrame(frame.current);
      hop.current?.cancel();
    };
  }, [interactive]);

  function jump() {
    if (!interactive || !host.current) return;
    cancelAnimationFrame(frame.current);
    hop.current?.cancel();
    setJumping(true);
    const duration = 1100;
    hop.current = host.current.animate([
      { transform: "translateY(0) scale(1, 1)", offset: 0 },
      { transform: "translateY(3%) scale(1.08, .9)", offset: .15 },
      { transform: "translateY(-12%) scale(.96, 1.04)", offset: .5 },
      { transform: "translateY(2%) scale(1.06, .94)", offset: .85 },
      { transform: "translateY(0) scale(1, 1)", offset: 1 },
    ], { duration, easing: "ease-in-out" });
    const start = performance.now();
    const turn = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const t = Math.max(0, Math.min(1, (progress - .15) / .7));
      setView({ yaw: progress < 1 ? 2 * Math.PI * (t * t * (3 - 2 * t)) : 0, pitch: 0 });
      if (progress < 1) frame.current = requestAnimationFrame(turn);
      else setJumping(false);
    };
    frame.current = requestAnimationFrame(turn);
  }

  return <div className="api-preview" ref={host} role={interactive ? "button" : undefined}
    tabIndex={interactive ? 0 : undefined} aria-label={interactive ? `${name}: jump and turn` : undefined}
    onClick={jump} onKeyDown={event => {
      if (interactive && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); jump(); }
    }} style={interactive ? { cursor: "pointer" } : undefined}>
    {definition ? <BotAvatar definition={definition} color={color} material={style === "fluffy" ? "fluffy" : "flat"}
      state="idle" view={view} followPointer={!reduced && !jumping} lookAt={jumping ? { x: 0, y: 0 } : null}
      reducedMotion={reduced} label={label} />
      : collection === "bot-avatars" ? <LibrariesAvatar id={id} style={style} reduced={reduced} src={src} label={label} />
      : fallback}
  </div>;
}
