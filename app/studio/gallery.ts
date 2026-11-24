import { examples, validateAvatar, type AvatarDefinition } from "open-bot-avatar";
import upstream from "../lib/upstream/open-bot-avatar.json";

export const GALLERY: AvatarDefinition[] = upstream.gallery.flatMap((raw) => {
  const result = validateAvatar(raw);
  if (!result.ok || examples.some((e) => e.id === result.value.id)) return [];
  return [result.value];
}).sort((a, b) => a.name.localeCompare(b.name));

export function findGallery(id: string): AvatarDefinition | undefined {
  return GALLERY.find((d) => d.id === id);
}
