import { examples } from "open-bot-avatar";
import { BotAvatar as LibrariesAvatar, botAvatarTypes } from "bot-avatars";
import { BotAvatar } from "./BotAvatar";
import { GALLERY } from "./gallery";
import { usePrefersReducedMotion } from "./studio/hooks";

/** The API selection, rendered live with its collection's original animation engine. */
export function ApiAvatar({ collection, id, color, style, src, name }: {
  collection: string; id: string; color: string; style: string; src: string; name: string;
}) {
  const reduced = usePrefersReducedMotion();
  const label = `${name}, returned by the API`;
  const definition = collection === "open-bot-avatar"
    ? [...examples, ...GALLERY].find(entry => entry.id === id) : undefined;
  const type = collection === "bot-avatars" ? botAvatarTypes.find(type => type === id) : undefined;

  return <div className="api-preview">
    {definition ? <BotAvatar definition={definition} color={color} material="flat"
      state="idle" followPointer={!reduced} reducedMotion={reduced} label={label} />
      : type ? <LibrariesAvatar type={type} size="100%" shading={style === "original" ? "fabric" : "flat"}
        shadow={style === "original" ? undefined : 0} paused={reduced} interactive={!reduced} aria-label={label} />
      : <img src={src} alt={label} width="512" height="512" />}
  </div>;
}
