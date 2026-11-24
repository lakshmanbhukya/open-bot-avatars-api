import { useEffect, useState } from "react";
import catalog from "../lib/catalog.json";
import { copyText } from "./studio/files";
import { Icon, MenuButton, Segmented } from "./studio/ui";
import { imageUrl, usageExample } from "./api-urls";
import { ApiAvatar } from "./ApiAvatar";

const labels: Record<string, string> = { "open-bot-avatar": "Open Bot Avatar", "bot-avatars": "Libraries.dev Bot Avatars" };
type Pick = (typeof catalog)[number] & { url: string; requestUrl: string; style: string };

export function Api() {
  const [collection, setCollection] = useState("");
  const [style, setStyle] = useState("flat");
  const [mode, setMode] = useState("choose");
  const [seed, setSeed] = useState("");
  const [request, setRequest] = useState({ url: imageUrl(), serial: 0 });
  const [pick, setPick] = useState<Pick | null>(null);
  const [preview, setPreview] = useState("");
  const [showPng, setShowPng] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");
  const [example, setExample] = useState("HTML");

  function load(url: string) {
    setLoading(true);
    setError("");
    setMessage("");
    setRequest(previous => ({ url, serial: previous.serial + 1 }));
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    const params = new URLSearchParams(window.location.search);
    const entry = catalog.find(item => item.collection === params.get("collection") && item.id === params.get("avatar"));
    const requestedCollection = params.get("collection") ?? "";
    const validCollection = Object.hasOwn(labels, requestedCollection) ? requestedCollection : "";
    const finish = validCollection === "bot-avatars" && params.get("style") === "original" ? "original" : "flat";
    const sharedSeed = params.get("seed");
    if (sharedSeed && sharedSeed.length <= 128 && !params.has("avatar")) {
      setCollection(validCollection); setStyle(finish); setSeed(sharedSeed); setMode("seed");
      load(imageUrl(validCollection, finish, "", sharedSeed));
    } else if (entry) {
      setCollection(entry.collection); setStyle(finish);
      load(imageUrl(entry.collection, finish, entry.id));
    }
  }, []);

  // Retain the previous image until its replacement arrives, then release its blob.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchAvatar() {
      try {
        const response = await fetch(request.url, { signal: controller.signal });
        if (!response.ok) throw Error((await response.json()).error || "Could not load this avatar.");
        const url = response.headers.get("Content-Location");
        if (!url) throw Error("The API did not return an image URL.");
        const params = new URL(url, window.location.origin).searchParams;
        const entry = catalog.find(item => item.collection === params.get("collection") && item.id === params.get("avatar"));
        if (!entry) throw Error("The API returned an unknown avatar.");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        setPreview(URL.createObjectURL(blob));
        setPick({ ...entry, url, requestUrl: request.url, style: params.get("style") ?? "flat" });
        setLoading(false);
      } catch (problem) {
        if (!controller.signal.aborted) {
          setLoading(false);
          setError(problem instanceof Error ? problem.message : "Could not load an avatar.");
        }
      }
    }
    void fetchAvatar();
    return () => controller.abort();
  }, [request]);

  const selectedUrl = pick ? `${origin}${mode === "seed" ? pick.requestUrl : pick.url}` : "";
  const submittedSeed = new URLSearchParams(request.url.split("?")[1]).get("seed") ?? "user-42";
  const endpoint = `${origin}${mode === "seed" ? request.url : !loading && !error && pick ? pick.url : request.url}`;
  const snippet = usageExample(example, selectedUrl || `${origin}${imageUrl()}`);
  const canCopy = !!pick && !loading && !error;

  async function copy(text: string, success: string) {
    setMessage(await copyText(text) ? success : "Select and copy the URL or example below.");
  }

  function sharePicker() {
    if (!pick) return;
    const params = mode === "seed"
      ? new URL(pick.requestUrl, window.location.origin).searchParams
      : new URLSearchParams({ collection: pick.collection, avatar: pick.id, style: pick.style });
    void copy(new URL(`/?${params}#/api`, window.location.origin).href, "Picker link copied.");
  }

  function callApi() {
    setCollection(""); setStyle("flat"); setMode("choose");
    load(imageUrl());
  }

  function changeMode(next: string) {
    setMode(next);
    const nextCollection = style === "original" ? "bot-avatars" : collection;
    setCollection(nextCollection);
    load(imageUrl(nextCollection, style, "", next === "seed" ? seed || "user-42" : ""));
    if (next === "seed" && !seed) setSeed("user-42");
  }

  const visible = catalog.filter(entry => !collection || entry.collection === collection);
  const supportsPlush = (mode === "choose" ? pick?.collection ?? collection : collection) === "bot-avatars";
  return <main className="page docs api-page api-landing">
    <section className="api-hero" aria-label="Live API demo">
      <div className="api-response" aria-busy={loading}>
        <div className={`api-response-image${showPng ? " is-png" : ""}`}>{preview && pick && (showPng
          ? <div className="api-preview"><img src={preview} alt={`${pick.name}, transparent PNG response`} width="512" height="512" /></div>
          : <ApiAvatar key={`${pick.collection}/${pick.id}/${pick.style}`} {...pick} src={preview} />)}</div>
        <div className="api-response-caption">
          <strong>{pick?.name ?? "Your first response"}</strong>
          <span>{pick ? `${labels[pick.collection]} · ${pick.style === "original" ? "Original plush" : "Flat PNG"}` : "PNG image"}</span>
          <button className="api-preview-toggle" disabled={!preview} aria-pressed={showPng} onClick={() => setShowPng(previous => !previous)}>{showPng ? "Show animation" : "Preview PNG"}</button>
          {showPng && <span>512 × 512 · Transparent background. Checkerboard is preview only.</span>}
        </div>
      </div>
      <div className="api-request">
        <h1>One request.<br /> One avatar.</h1>
        <p>Call the API to get a bot avatar.</p>
        <div className="api-endpoint"><span>GET</span><a href={endpoint}><code>{endpoint}</code></a></div>
        <div className="api-buttons">
          <button className="btn btn-primary" disabled={loading} onClick={callApi}><Icon name="rotate" />{loading ? "Calling API…" : "Call API"}</button>
          <button className="btn" disabled={!canCopy} onClick={() => void copy(endpoint, "Endpoint copied.")}><Icon name="copy" />Copy endpoint</button>
        </div>
        <p className={`api-call-status${error ? " is-error" : ""}`} role={error ? "alert" : "status"}>{error || message || (loading ? "Fetching image…" : "Image received. Call again for a random avatar.")}</p>
        <a className="api-explore-link" href="#avatar-options">Explore avatar options <Icon name="arrow" /></a>
      </div>
    </section>

    <section id="avatar-options" className="api-options" aria-labelledby="api-options-heading">
      <div className="api-section-head"><div><h2 id="api-options-heading">Explore {catalog.length} avatars</h2><p>Pick a design, or use a public ID for a repeatable avatar.</p></div>
        <Segmented label="How to select an avatar" value={mode} onChange={changeMode} options={[{ value: "choose", label: "Choose an avatar" }, { value: "seed", label: "Use a seed" }]} />
      </div>
      <div className="api-filters">
        <div className="api-field" role="group" aria-labelledby="api-collection-label">
          <span id="api-collection-label">Collection</span>
          <MenuButton icon="eye" label={collection ? labels[collection] : "Both collections"} placement="bottom" items={[
            { value: "", label: "Both collections", count: 41 }, { value: "open-bot-avatar", label: "Open Bot Avatar", count: 23 }, { value: "bot-avatars", label: "Libraries.dev Bot Avatars", count: 18 },
          ].map(option => ({ label: option.label, hint: `${option.count} designs${collection === option.value ? " · Selected" : ""}`, onSelect: () => {
            setCollection(option.value); setStyle("flat");
            load(imageUrl(option.value, "flat", "", mode === "seed" ? submittedSeed : ""));
          } }))} />
        </div>
        <div className="api-field" role="group" aria-labelledby="api-finish-label">
          <span id="api-finish-label">Finish</span>
          <MenuButton icon="spark" label={style === "original" ? "Original plush" : "Flat"} placement="bottom" items={[
            { value: "flat", label: "Flat" }, ...(supportsPlush ? [{ value: "original", label: "Original plush" }] : []),
          ].map(option => ({ label: option.label, hint: style === option.value ? "Selected" : undefined, onSelect: () => {
            setStyle(option.value);
            load(imageUrl(mode === "choose" ? pick?.collection ?? collection : collection, option.value, mode === "choose" ? pick?.id : "", mode === "seed" ? submittedSeed : ""));
          } }))} />
        </div>
      </div>
      <div className="api-options-body">{mode === "seed" ? <form className="api-seed" onSubmit={event => { event.preventDefault(); if (seed.trim()) load(imageUrl(collection, style, "", seed)); }}>
        <label htmlFor="api-seed">Public user ID or seed</label>
        <div><input id="api-seed" value={seed} onChange={event => setSeed(event.target.value)} maxLength={128} required pattern=".*\S.*" placeholder="user-42" aria-describedby="api-seed-help" /><button className="btn" disabled={loading}>{loading ? "Finding…" : "Find avatar"}</button></div>
        <p id="api-seed-help">Enter a public ID, such as user-42. The same seed and filters always return the same avatar. Try a different ID to select again; different IDs can share a design.</p>
        <div className="api-seed-result" aria-busy={loading}>
          {!loading && !error && pick && <img src={preview} alt={pick.name} width="88" height="88" />}
          <div role={error ? "alert" : "status"} className={error ? "api-seed-error" : undefined}>
            {loading ? "Finding your avatar…" : error || (pick && <><strong>{pick.name}</strong><p>Result for “{submittedSeed}”. Your image URL and example below are ready.</p></>)}
          </div>
        </div>
      </form> : <div className="api-catalog" role="group" aria-label="Avatar designs">{visible.map(entry => {
        const finish = entry.styles.includes(style) ? style : "flat";
        return <button key={`${entry.collection}/${entry.id}`} aria-pressed={pick?.collection === entry.collection && pick?.id === entry.id} onClick={() => {
          setStyle(finish); load(imageUrl(entry.collection, finish, entry.id));
        }}><span className="api-catalog-image" data-collection={entry.collection}><img src={`/avatars/v3/${entry.collection}/${entry.id}${finish === "original" ? "-original" : ""}-thumb.webp`} alt="" width="112" height="112" loading="lazy" decoding="async" /></span><span className="api-catalog-name">{entry.name}{pick?.collection === entry.collection && pick?.id === entry.id && <Icon name="check" />}</span></button>;
      })}</div>}</div>
      <div className="api-selection"><span>{pick ? `Selected: ${pick.name}` : "Choose an avatar"}</span><a href="#api-usage">Use this avatar <Icon name="arrow" /></a></div>
    </section>

    <section id="api-usage" className="api-usage" aria-labelledby="api-usage-heading">
      <div className="api-section-head"><div><h2 id="api-usage-heading">Use it in your app</h2><p>Profile pictures, chat interfaces, and team directories.</p></div><a href="#/docs">API docs <Icon name="arrow" /></a></div>
      <label className="api-section-label" htmlFor="api-image-url">{mode === "seed" ? "REPEATABLE SEED URL" : "SELECTED IMAGE URL"}</label>
      <input id="api-image-url" readOnly value={selectedUrl} placeholder="Your image URL appears here" onFocus={event => event.currentTarget.select()} />
      <div className="api-example-toolbar"><Segmented label="Integration example" value={example} onChange={setExample} options={["URL", "HTML", "React", "cURL"].map(value => ({ value, label: value }))} />
        <div className="api-buttons"><button className="btn btn-primary" disabled={!canCopy} onClick={() => void copy(selectedUrl, "Image URL copied.")}><Icon name="copy" />Copy URL</button><button className="btn" disabled={!canCopy} onClick={() => void copy(snippet, `${example} example copied.`)}>Copy example</button></div>
      </div>
      <pre className="code api-embed" tabIndex={0} aria-label={`${example} usage example`}><code>{snippet}</code></pre>
      <div className="api-usage-footer"><div className="api-buttons">
        {pick && <a href={pick.url} download={`${pick.id}.png`}>Download PNG</a>}
        {pick?.formats.includes("svg") && <a href={pick.url.replace("format=png", "format=svg")} download={`${pick.id}.svg`}>Download SVG</a>}
        <button className="api-share" disabled={!canCopy} onClick={sharePicker}>Share avatar</button>
        <a href="/api/avatars">JSON catalog</a>
      </div><span className="api-status">{message}</span></div>
    </section>
  </main>;
}
