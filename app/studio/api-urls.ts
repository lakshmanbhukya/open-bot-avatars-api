export function imageUrl(collection = "", style = "flat", avatar = "", seed = "") {
  const params = new URLSearchParams({ v: "3" });
  if (collection) params.set("collection", collection);
  if (style !== "flat") params.set("style", style);
  if (avatar) params.set("avatar", avatar);
  if (seed) params.set("seed", seed);
  return `/api/avatar?${params}`;
}

export function usageExample(kind: string, url: string) {
  if (kind === "URL") return url;
  if (kind === "React") return `<img\n  src=${JSON.stringify(url)}\n  width={64}\n  height={64}\n  alt="Bot avatar"\n/>`;
  if (kind === "cURL") return `curl '${url.replaceAll("'", "'\\''")}' --output avatar.png`;
  return `<img src="${url.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}" width="64" height="64" alt="Bot avatar">`;
}
