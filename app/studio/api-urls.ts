export function imageUrl(collection = "", style = "flat", avatar = "", seed = "", version = "3") {
  const params = new URLSearchParams({ v: version });
  if (collection) params.set("collection", collection);
  if (style !== "flat") params.set("style", style);
  if (avatar) params.set("avatar", avatar);
  if (seed) params.set("seed", seed);
  return `/api/avatar?${params}`;
}

export function retryDelaySeconds(value: string | null, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - now) / 1000)) : 0;
}

export function usageExample(kind: string, url: string) {
  if (kind === "URL") return url;
  if (kind === "React") return `<img\n  src=${JSON.stringify(url)}\n  width={64}\n  height={64}\n  alt="Bot avatar"\n/>`;
  if (kind === "cURL") return `curl '${url.replaceAll("'", "'\\''")}' --output avatar.png`;
  return `<img src="${url.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}" width="64" height="64" alt="Bot avatar">`;
}
