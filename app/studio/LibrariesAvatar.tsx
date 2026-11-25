import { BotAvatar, botAvatarTypes } from "bot-avatars";
import { useEffect, useRef } from "react";

export default function LibrariesAvatar({ id, style, reduced, src, label }: {
  id: string; style: string; reduced: boolean; src: string; label: string;
}) {
  const type = botAvatarTypes.find(type => type === id);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (reduced || !type) return;
    const jump = () => canvas.current?.click();
    jump();
    const timer = window.setInterval(jump, 10000);
    return () => window.clearInterval(timer);
  }, [reduced, type]);
  return type ? <BotAvatar ref={canvas} type={type} size="100%" shading={style === "original" ? "fabric" : "flat"}
    shadow={style === "original" ? undefined : 0} paused={reduced} interactive={!reduced} jumpEvery={0} aria-label={label} />
    : <img src={src} alt={label} width="512" height="512" />;
}
