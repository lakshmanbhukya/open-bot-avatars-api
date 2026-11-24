export function downloadText(filename: string, mime: string, text: string) {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Snapshot the rendered surface, including its position inside the square preview. */
export async function downloadPreview(host: HTMLElement | null, filename: string) {
  const surface = host?.querySelector("canvas, svg");
  if (!host || !surface) throw Error("Preview unavailable");
  const box = host.getBoundingClientRect();
  const painted = surface.getBoundingClientRect();
  if (!box.width || !box.height || !painted.width || !painted.height) throw Error("Preview not ready");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw Error("Canvas unavailable");
  let source: CanvasImageSource = surface as HTMLCanvasElement;
  let svgUrl: string | undefined;
  try {
    if (surface instanceof SVGSVGElement) {
      svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(surface)], { type: "image/svg+xml" }));
      const image = new Image();
      image.src = svgUrl;
      await image.decode();
      source = image;
    }
    context.drawImage(source, (painted.left - box.left) * 512 / box.width, (painted.top - box.top) * 512 / box.height, painted.width * 512 / box.width, painted.height * 512 / box.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(Error("PNG export failed")), "image/png"));
    downloadBlob(filename, blob);
  } finally {
    if (svgUrl) URL.revokeObjectURL(svgUrl);
  }
}

/** Copies `text`; false when no clipboard could be reached. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API needs a secure context; fall back to a hidden textarea.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}
