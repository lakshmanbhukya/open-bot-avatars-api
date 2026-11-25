import { examples } from "open-bot-avatar";
import { lazy, Suspense } from "react";
import { BotAvatar } from "./BotAvatar";
import { GALLERY } from "./gallery";
import { usePrefersReducedMotion } from "./studio/hooks";

const LibrariesAvatar = lazy(() => import("./LibrariesAvatar"));

/** The API selection, rendered live with its collection's original animation engine. */
export function ApiAvatar({ collection, id, color, style, src, name }: {
  collection: string; id: string; color: string; style: string; src: string; name: string;
}) {
  const reduced = usePrefersReducedMotion();
  const label = `${name}, ${style} animated preview`;
  const definition = collection === "open-bot-avatar"
    ? [...examples, ...GALLERY].find(entry => entry.id === id) : undefined;
  const fallback = <img src={src} alt={`${name}, actual ${style} PNG response`} width="512" height="512" />;

  return <div className="api-preview">
    {definition ? <BotAvatar definition={definition} color={color} material={style === "fluffy" ? "fluffy" : "flat"}
      state="idle" followPointer={!reduced} reducedMotion={reduced} label={label} />
      : collection === "bot-avatars" ? <Suspense fallback={fallback}><LibrariesAvatar id={id} style={style} reduced={reduced} src={src} label={label} /></Suspense>
      : fallback}
  </div>;
}
