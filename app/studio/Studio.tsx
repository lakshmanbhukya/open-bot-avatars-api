import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { DEFAULT_COLOR, examples } from "open-bot-avatar";
import { GALLERY } from "./gallery";
import { Actions } from "./studio/Actions";
import { BotPanel, type LibraryEntry } from "./studio/BotPanel";
import { usePrefersReducedMotion } from "./studio/hooks";
import { PALETTE, colorOf, defaultColor, withColor, type LookState } from "./studio/look";
import { readShare } from "./studio/share";
import { Settings } from "./studio/Settings";
import { Stage, type ViewAngle } from "./studio/Stage";

const STARTERS: LibraryEntry[] = examples.map((definition) => ({
  key: `starter:${definition.id}`,
  source: "starter",
  definition,
}));

const GALLERY_ENTRIES: LibraryEntry[] = GALLERY.map((definition) => ({
  key: `gallery:${definition.id}`,
  source: "gallery",
  definition,
}));

/**
 * The starters and the gallery together, by their own color in the color bar's order (white, brown,
 * red … gray), then by name; a color outside the palette goes last. Picking another color for one
 * doesn't move it.
 */
function byColor(entries: LibraryEntry[]): LibraryEntry[] {
  const rank = (entry: LibraryEntry) => {
    const i = PALETTE.findIndex((s) => s.value === defaultColor(entry.definition.id));
    return i < 0 ? PALETTE.length : i;
  };
  return [...entries].sort((a, b) => rank(a) - rank(b) || a.definition.name.localeCompare(b.definition.name));
}

const LIBRARY = byColor([...STARTERS, ...GALLERY_ENTRIES]);

/** The studio opens on a random starter or gallery avatar, picked once per page load. */
const OPENING = LIBRARY[Math.floor(Math.random() * LIBRARY.length)]?.key ?? "";

const FRONT: ViewAngle = { yaw: 0, pitch: 0 };

/** A catalog editor for the original Open Bot designs. */
export function Studio({ look, setLook }: { look: LookState; setLook: Dispatch<SetStateAction<LookState>> }) {
  const [selectedKey, setSelectedKey] = useState(OPENING);
  const [view, setView] = useState<ViewAngle>(FRONT);
  const [animatePreview, setAnimatePreview] = useState(true);
  const selected = LIBRARY.find(entry => entry.key === selectedKey) ?? LIBRARY[0];
  const systemReduced = usePrefersReducedMotion();
  const reduced = look.motionPreference === "system" ? systemReduced : look.motionPreference === "reduced";
  const reducedMotion = look.motionPreference === "system" ? "system" : look.motionPreference === "reduced";
  const patchLook = useCallback((patch: Partial<LookState>) => setLook(prev => ({ ...prev, ...patch })), [setLook]);
  const color = selected ? colorOf(look, selected.key, selected.definition.id) : DEFAULT_COLOR;
  const pickColor = useCallback(
    (next: string) => selected && setLook(prev => withColor(prev, selected.key, selected.definition.id, next)),
    [selected, setLook],
  );

  const shared = useRef(true);
  useEffect(() => {
    if (!shared.current) return;
    shared.current = false;
    const link = readShare(window.location.search);
    const target = LIBRARY.find(entry => entry.definition.id === link.avatar);
    if (target) setSelectedKey(target.key);
    setLook(prev => {
      let next = link.state || link.mood ? { ...prev, state: link.state ?? prev.state, mood: link.mood ?? prev.mood } : prev;
      if (link.material) next = { ...next, material: link.material };
      if (link.color && target) next = withColor(next, target.key, target.definition.id, link.color);
      return next;
    });
    if (window.location.search) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.hash);
  }, [setLook]);

  if (!selected) return <main className="empty"><p>No catalog avatars are available.</p></main>;

  return (
    <div className="app">
      <main className="editor">
        <Stage
          definition={selected.definition}
          color={color}
          material={look.material}
          state={look.state}
          mood={look.mood}
          still={!animatePreview}
          followCursor={animatePreview && look.followCursor}
          reducedMotion={reducedMotion}
          reduced={!animatePreview || reduced}
          view={view}
          onView={setView}
          onState={(state) => patchLook({ state })}
          onMood={(mood) => patchLook({ mood })}
          onMaterial={(material) => patchLook({ material })}
        >
          <Actions entry={selected} color={color} material={look.material} state={look.state} mood={look.mood} />
        </Stage>

        <section className="picker" aria-labelledby="catalog-heading">
          <div className="tabs">
            <h2 className="catalog-label" id="catalog-heading">Avatars</h2>
            <Settings look={look} systemReduced={systemReduced} onLook={patchLook} animatePreview={animatePreview} onAnimatePreview={setAnimatePreview} />
          </div>
          <div className="tabpanel tabpanel-bot">
            <BotPanel entries={LIBRARY} selected={selected} look={look} color={color} onSelect={setSelectedKey} onColor={pickColor} />
          </div>
        </section>
      </main>
    </div>
  );
}
