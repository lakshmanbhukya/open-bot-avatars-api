import { BotAvatar, botAvatarTypes } from "bot-avatars";

export default function LibrariesAvatar({ id, style, reduced, src, label }: {
  id: string; style: string; reduced: boolean; src: string; label: string;
}) {
  const type = botAvatarTypes.find(type => type === id);
  return type ? <BotAvatar type={type} size="100%" shading={style === "original" ? "fabric" : "flat"}
    shadow={style === "original" ? undefined : 0} paused={reduced} interactive={!reduced} aria-label={label} />
    : <img src={src} alt={label} width="512" height="512" />;
}
