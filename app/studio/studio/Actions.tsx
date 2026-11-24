import { useMemo, useState, type RefObject } from "react";
import { renderAvatarSvg } from "open-bot-avatar";
import type { LibraryEntry } from "./BotPanel";
import { copyText, downloadText, downloadPreview } from "./files";
import type { ViewAngle } from "./Stage";
import { SITE_URL } from "../../lib/site-url";
import { useFlash } from "./hooks";
import type { LookState } from "./look";
import { shareLink } from "./share";
import { MenuButton } from "./ui";

/** Export the selected design or copy its hosted API URL and editor link. */
export function Actions({ entry, color, material, state, mood, view, previewRef }: { entry: LibraryEntry; color: string; material: LookState["material"]; state: LookState["state"]; mood: LookState["mood"]; view: ViewAngle; previewRef: RefObject<HTMLDivElement | null> }) {
  const [copied, flashCopied] = useFlash();
  const [problem, setProblem] = useState<string | null>(null);
  const { definition } = entry;
  const json = useMemo(() => `${JSON.stringify(definition, null, 2)}\n`, [definition]);

  const copy = async (text: string, fallback: string) => {
    if (await copyText(text)) {
      setProblem(null);
      flashCopied();
    } else setProblem(fallback);
  };

  return (
    <div className="actions-bar">
      <div className="actions-row">
        <MenuButton
          icon="download"
          label="Export"
          items={[
            {
              label: "Download current preview",
              hint: "PNG, with this material, color and pose",
              onSelect: () => {
                void downloadPreview(previewRef.current?.querySelector<HTMLElement>(".stage-avatar") ?? null, `${definition.id}.png`)
                  .then(() => setProblem(null))
                  .catch(() => setProblem("Could not export the preview. Please try again once the avatar is visible."));
              },
            },
            {
              label: "Download flat SVG",
              hint: "Flat material, selected color, mood and angle",
              onSelect: () => {
                try {
                  downloadText(`${definition.id}.svg`, "image/svg+xml", renderAvatarSvg(definition, { color, state, mood, view, size: 512, time: 0, reducedMotion: true }));
                  setProblem(null);
                } catch (error) {
                  setProblem(`Couldn’t render ${definition.name}: ${error instanceof Error ? error.message : String(error)}`);
                }
              },
            },
            { label: "Definition", hint: "JSON, geometry only", onSelect: () => downloadText(`${definition.id}.json`, "application/json", json) },
          ]}
        />
        <MenuButton
          icon="copy"
          label="Copy"
          done={copied ? "Copied" : undefined}
          items={[
            ...(entry.source !== "yours" ? [{
              label: "Original-color API URL",
              hint: "Hosted image: original color, flat still",
              onSelect: () => {
                const params = new URLSearchParams({ v: "3", collection: "open-bot-avatar", avatar: definition.id, format: "png", style: "flat" });
                const url = new URL(`/api/avatar?${params}`, SITE_URL).href;
                void copy(url, `Couldn’t reach the clipboard. The URL: ${url}`);
              },
            }] : []),
            { label: "JSON", hint: "The definition", onSelect: () => void copy(json, "Couldn’t reach the clipboard; use Export instead.") },
            {
              label: "Link",
              hint: "Opens it in this color, material, state and mood",
              onSelect: () => {
                const link = shareLink(`${SITE_URL}/editor`, entry, { color, material, state, mood });
                void copy(link, `Couldn’t reach the clipboard. The link: ${link}`);
              },
            },
          ]}
        />
      </div>
      <span className="sr-only" role="status">
        {copied ? "Copied" : ""}
      </span>
      {problem ? (
        <p className="note note-error" role="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
