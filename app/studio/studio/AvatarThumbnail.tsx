import type { AvatarDefinition, AvatarMaterial } from "open-bot-avatar";
import { useState } from "react";
import { BotAvatar } from "../BotAvatar";
import { thumbnailKey, THUMB_LOOK, THUMB_VIEW } from "./outline";
import keys from "./fluffy-thumbnails.json";
import atlas from "../../../public/studio/fluffy-thumbnails.webp";

// The atlas is a square grid of cells, one per key, in the order of the list.
const cells = new Map(keys.map((key, index) => [key, index]));
const side = Math.ceil(Math.sqrt(keys.length));

/**
 * A picker thumbnail: a still of the avatar in its color. A flat still is one small SVG. A fluffy
 * one has to build the avatar's mesh and render it, so the avatars the site ships with come from
 * a baked image in their own colors, and only another color or one of yours is rendered here.
 * Bake it again after a change to how fluffy looks: pnpm --filter site thumbnails.
 */
export function AvatarThumbnail({ definition, color, material }: { definition: AvatarDefinition; color: string; material: AvatarMaterial }) {
  const [atlasFailed, setAtlasFailed] = useState(false);
  const cell = material === "fluffy" ? cells.get(thumbnailKey(definition, color)) : undefined;
  if (cell === undefined || atlasFailed) {
    return <BotAvatar className="avatar-view" definition={definition} color={color} material={material} still view={THUMB_VIEW} lookAt={THUMB_LOOK} label="" />;
  }
  return (
    <span
      className="avatar-view"
      aria-hidden="true"
      style={{ position: "relative", overflow: "hidden" }}
    >
      <img
        src={atlas.src}
        alt=""
        decoding="async"
        onError={() => setAtlasFailed(true)}
        style={{
          position: "absolute",
          width: `${side * 100}%`,
          height: `${side * 100}%`,
          maxWidth: "none",
          left: `${-(cell % side) * 100}%`,
          top: `${-Math.floor(cell / side) * 100}%`,
        }}
      />
    </span>
  );
}
