"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import {
  catalogForVersion,
  PICKER_VERSION,
  supportsVariant,
  variantsFor,
  avatarFilename,
} from "../lib/avatar-catalog.js";
import { SITE_URL } from "../lib/site-url";
import { useFlash } from "./studio/hooks";
import { copyText, downloadBlob } from "./studio/files";
import { Icon, MenuButton, Segmented } from "./studio/ui";
import { imageUrl, usageExample, retryDelaySeconds } from "./api-urls";
const ApiAvatar = lazy(() =>
  import("./ApiAvatar").then((module) => ({ default: module.ApiAvatar })),
);

const labels: Record<string, string> = {
  "open-bot-avatar": "Open Bot Avatar",
  "bot-avatars": "Libraries.dev Bot Avatars",
};
const finishes: Record<string, string> = {
  flat: "Flat",
  original: "Original plush",
  fluffy: "Fluffy",
};
type Pick = NonNullable<ReturnType<typeof catalogForVersion>>[number] & {
  version: string;
  url: string;
  requestUrl: string;
  style: string;
  blob: Blob;
  preview: string;
};

export function Api({ active = true }: { active?: boolean }) {
  const [version, setVersion] = useState<string>(PICKER_VERSION);
  const catalog = catalogForVersion(version)!;
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  const [collection, setCollection] = useState("");
  const [style, setStyle] = useState("flat");
  const [mode, setMode] = useState("choose");
  const [seed, setSeed] = useState("");
  const [request, setRequest] = useState<{
    url: string;
    serial: number;
  } | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const preview = pick?.preview ?? "";
  const [downloading, setDownloading] = useState(false);
  const [previewMode, setPreviewMode] = useState<"png" | "animated">(
    "animated",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [toastVisible, flashToast] = useFlash(3000);
  const [example, setExample] = useState("HTML");
  const [retryAt, setRetryAt] = useState(0);
  const [retryIn, setRetryIn] = useState(0);

  useEffect(() => {
    if (!retryAt) return;
    const update = () =>
      setRetryIn(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  function load(url: string) {
    if (Date.now() < retryAt) return;
    setLoading(true);
    setError("");
    setMessage("");
    setRequest((previous) => ({ url, serial: (previous?.serial ?? 0) + 1 }));
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedVersion = params.get("v") ?? PICKER_VERSION;
    if (params.getAll("v").length > 1 || !catalogForVersion(sharedVersion)) {
      setLoading(false);
      setError(
        "The requested catalog version is not available. This picker supports versions 4 and 5.",
      );
      return;
    }
    if (params.has("format") && params.get("format") !== "png") {
      setLoading(false);
      setError(
        "This picker previews PNG images. Use the API endpoint for SVG.",
      );
      return;
    }
    setVersion(sharedVersion);
    const requestedCollection = params.get("collection") ?? "";
    const validCollection = Object.hasOwn(labels, requestedCollection)
      ? requestedCollection
      : "";
    const finish = params.get("style") ?? "flat";
    const sharedSeed = params.get("seed");
    setCollection(validCollection);
    setStyle(finish);
    if (sharedSeed !== null) {
      setSeed(sharedSeed);
      setMode("seed");
    }
    const query = new URLSearchParams({ v: sharedVersion });
    for (const key of ["collection", "style", "avatar", "seed"]) {
      for (const value of params.getAll(key)) query.append(key, value);
    }
    load(`/api/avatar?${query}`);
  }, []);

  useEffect(() => {
    if (pick?.style !== "fluffy" || webglAvailable !== null) return;
    const gl = document.createElement("canvas").getContext("webgl2");
    setWebglAvailable(!!gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }, [pick?.style, webglAvailable]);

  // Retain the previous image until its replacement arrives, then release its blob.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  useEffect(() => {
    if (!request) return;
    const requestedUrl = request.url;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(false);
      setError("This request took too long. Please try again.");
      controller.abort();
    }, 20_000);
    async function fetchAvatar() {
      try {
        const response = await fetch(requestedUrl, {
          signal: controller.signal,
        });
        if (!response.ok) {
          const delay = retryDelaySeconds(response.headers.get("Retry-After"));
          setRetryAt(delay ? Date.now() + delay * 1000 : 0);
          setRetryIn(delay);
          const problem = await response.json().catch(() => null);
          throw Error(
            typeof problem?.error === "string"
              ? problem.error
              : `Could not load this avatar (HTTP ${response.status}). Please try again.`,
          );
        }
        const url = response.headers.get("Content-Location");
        if (!url) throw Error("The API did not return an image URL.");
        const params = new URL(url, window.location.origin).searchParams;
        const responseVersion = params.get("v") ?? "";
        const entry = catalogForVersion(responseVersion)?.find(
          (item) =>
            item.collection === params.get("collection") &&
            item.id === params.get("avatar"),
        );
        const finish = params.get("style") ?? "flat";
        if (
          !entry ||
          responseVersion !==
            new URL(requestedUrl, window.location.origin).searchParams.get(
              "v",
            ) ||
          !supportsVariant(entry, "png", finish) ||
          !response.headers.get("Content-Type")?.startsWith("image/png") ||
          response.headers.get("X-Avatar-Id") !== entry.id ||
          response.headers.get("X-Avatar-Collection") !== entry.collection
        ) {
          throw Error(
            "The API returned an image that did not match the requested version or avatar.",
          );
        }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        setPick({
          ...entry,
          version: responseVersion,
          url,
          requestUrl: requestedUrl,
          style: finish,
          blob,
          preview: URL.createObjectURL(blob),
        });
        setLoading(false);
        setRetryAt(0);
        setRetryIn(0);
      } catch (problem) {
        if (!controller.signal.aborted) {
          setLoading(false);
          setError(
            problem instanceof Error
              ? problem.message
              : "Could not load an avatar.",
          );
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void fetchAvatar();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [request]);

  const canCopy = !!pick && !loading && !error;
  const requestUrl = request?.url ?? imageUrl("", "flat", "", "", version);
  const selectedSeed =
    new URLSearchParams(pick?.requestUrl.split("?")[1]).get("seed") ?? "";
  const selectedUrl = canCopy
    ? `${SITE_URL}${selectedSeed ? pick.requestUrl : pick.url}`
    : "";
  const submittedSeed =
    new URLSearchParams(requestUrl.split("?")[1]).get("seed") ?? "";
  const endpoint = selectedUrl || `${SITE_URL}${requestUrl}`;
  const snippet = usageExample(
    example,
    selectedUrl || `${SITE_URL}${imageUrl("", "flat", "", "", version)}`,
  );

  async function copy(text: string, success: string) {
    setMessage(
      (await copyText(text))
        ? success
        : "Select and copy the URL or example below.",
    );
    flashToast();
  }

  async function download(format: "png" | "svg") {
    if (!canCopy || !pick || downloading) return;
    const selected = pick;
    setDownloading(true);
    setMessage(`Downloading ${selected.name}…`);
    try {
      let blob = selected.blob;
      if (format === "svg") {
        const params = new URLSearchParams({
          v: selected.version,
          collection: selected.collection,
          avatar: selected.id,
          style: selected.style,
          format,
        });
        const response = await fetch(`/api/avatar?${params}`, {
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok)
          throw Error(
            `Could not download ${selected.name} (HTTP ${response.status}). Please try again.`,
          );
        const location = response.headers.get("Content-Location");
        if (
          !response.headers.get("Content-Type")?.startsWith("image/svg+xml") ||
          response.headers.get("X-Avatar-Id") !== selected.id ||
          response.headers.get("X-Avatar-Collection") !== selected.collection ||
          !location ||
          new URL(location, window.location.origin).searchParams.get("v") !==
            selected.version
        ) {
          throw Error(
            "The download did not match the selected avatar. Please try again.",
          );
        }
        blob = await response.blob();
      }
      downloadBlob(
        `${selected.id}-${selected.style}-v${selected.version}.${format}`,
        blob,
      );
      setMessage(`${selected.name} ${format.toUpperCase()} downloaded.`);
    } catch (problem) {
      setMessage(
        problem instanceof Error
          ? problem.message
          : "Could not download this avatar. Please try again.",
      );
      flashToast();
    } finally {
      setDownloading(false);
    }
  }

  function sharePicker() {
    if (!pick) return;
    const params = selectedSeed
      ? new URL(pick.requestUrl, window.location.origin).searchParams
      : new URLSearchParams({
          v: pick.version,
          collection: pick.collection,
          avatar: pick.id,
          style: pick.style,
        });
    void copy(new URL(`/?${params}`, SITE_URL).href, "Avatar link copied.");
  }

  function callApi() {
    setMode("choose");
    load(imageUrl(collection, style, "", "", version));
  }

  function changeMode(next: string) {
    if (next === mode || Date.now() < retryAt) return;
    setMode(next);
  }

  const eligible = catalog.filter(
    (entry) => !collection || entry.collection === collection,
  );
  const visible = eligible.filter((entry) =>
    supportsVariant(entry, "png", style),
  );
  const availableFinishes = [
    ...new Set(
      eligible.flatMap((entry) =>
        variantsFor(entry)
          .filter((pair) => pair.format === "png")
          .map((pair) => pair.style),
      ),
    ),
  ];
  const showPng = previewMode === "png";
  return (
    <main className="page docs api-page api-landing">
      <section id="api-preview" className="api-hero" aria-label="Live API demo">
        <div className="api-response" aria-busy={loading}>
          <div
            className={`api-response-image${showPng ? " is-png" : ""}${loading ? " is-loading" : ""}`}
          >
            {preview && pick ? (
              showPng || !active ? (
                <div className="api-preview">
                  <img
                    src={preview}
                    alt={`${pick.name}, ${finishes[pick.style]} PNG response (v${pick.version})`}
                    width="512"
                    height="512"
                  />
                </div>
              ) : (
                <Suspense
                  fallback={
                    <img
                      src={preview}
                      alt={pick.name}
                      width="512"
                      height="512"
                    />
                  }
                >
                  <ApiAvatar
                    key={`${pick.version}/${pick.collection}/${pick.id}/${pick.style}`}
                    {...pick}
                    src={preview}
                  />
                </Suspense>
              )
            ) : (
              <img
                src="/avatars/v4/open-bot-avatar/mug.png"
                alt="Example bot avatar; your requested image will appear here"
                width="512"
                height="512"
                fetchPriority="high"
              />
            )}
          </div>
          <div className="api-response-caption">
            <strong>{pick?.name ?? "Your first response"}</strong>
            <span>
              {pick
                ? `v${pick.version} · ${labels[pick.collection]} · ${finishes[pick.style]} PNG`
                : "PNG image"}
            </span>
            <button
              className="api-preview-toggle"
              disabled={!preview || loading}
              aria-pressed={!showPng}
              onClick={() => setPreviewMode(showPng ? "animated" : "png")}
            >
              {showPng ? "Show animation" : "Preview PNG"}
            </button>
            <span>
              {showPng ? "Actual returned PNG · 512 × 512 · Transparent" : ""}
            </span>
            {!showPng && pick?.style === "fluffy" && (
              <span className="api-fur-notice">
                {webglAvailable === false ? "" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="api-request">
          <h1>
            One request.
            <br /> One avatar.
          </h1>
          <p>Call the API to get a bot avatar.</p>
          <div className="api-endpoint">
            <span>GET</span>
            <a href={endpoint}>
              <code>{endpoint}</code>
            </a>
          </div>
          <div className="api-buttons">
            <button
              className="btn btn-primary"
              disabled={loading || retryIn > 0}
              onClick={callApi}
            >
              <Icon name="rotate" />
              {loading ? "Loading avatar…" : "Random avatar"}
            </button>
            <button
              className="btn"
              disabled={!canCopy}
              onClick={() => void copy(endpoint, "Endpoint copied.")}
            >
              <Icon name="copy" />
              Copy endpoint
            </button>
            {error && request && (
              <button
                className="btn"
                disabled={retryIn > 0 || loading}
                onClick={() => load(requestUrl)}
              >
                {retryIn > 0 ? `Retry in ${retryIn}s` : "Retry this request"}
              </button>
            )}
          </div>
          <p
            className={`api-call-status${error ? " is-error" : ""}`}
            role={error ? "alert" : "status"}
          >
            {error ||
              (loading
                ? "Fetching image…"
                : selectedSeed
                  ? `Seed “${selectedSeed}” selects ${pick?.name}. Same seed and filters, same avatar.`
                  : "Image received. Copy its URL or choose another design.")}
          </p>
          <a className="api-explore-link" href="#avatar-options">
            Explore avatar options <Icon name="arrow" />
          </a>
        </div>
      </section>

      <section
        id="avatar-options"
        className="api-options"
        aria-labelledby="api-options-heading"
      >
        <div className="api-section-head">
          <div>
            <h2 id="api-options-heading">Explore {catalog.length} avatars</h2>
            <p>Pick a design, or use a public ID for a repeatable avatar.</p>
          </div>
          <Segmented
            label="How to select an avatar"
            value={mode}
            onChange={changeMode}
            options={[
              { value: "choose", label: "Choose an avatar" },
              { value: "seed", label: "Use a seed" },
            ]}
          />
        </div>
        <div className="api-filters">
          <div
            className="api-field"
            role="group"
            aria-labelledby="api-collection-label"
          >
            <span id="api-collection-label">Collection</span>
            <MenuButton
              icon="eye"
              label={collection ? labels[collection] : "Both collections"}
              placement="bottom"
              items={[
                { value: "", label: "Both collections" },
                ...Object.entries(labels).map(([value, label]) => ({
                  value,
                  label,
                })),
              ].map((option) => ({
                label: option.label,
                hint: `${catalog.filter((entry) => !option.value || entry.collection === option.value).length} designs${collection === option.value ? " · Selected" : ""}`,
                onSelect: () => {
                  if (Date.now() < retryAt) return;
                  setCollection(option.value);
                  setStyle("flat");
                  if (mode === "choose")
                    load(imageUrl(option.value, "flat", "", "", version));
                },
              }))}
            />
          </div>
          <div
            className="api-field"
            role="group"
            aria-labelledby="api-finish-label"
          >
            <span id="api-finish-label">Finish</span>
            <MenuButton
              icon="spark"
              label={finishes[style] ?? "Choose finish"}
              placement="bottom"
              items={availableFinishes
                .map((value) => ({ value, label: finishes[value] }))
                .map((option) => ({
                  label: option.label,
                  hint: style === option.value ? "Selected" : undefined,
                  onSelect: () => {
                    if (Date.now() < retryAt) return;
                    setStyle(option.value);
                    if (mode === "choose") {
                      const keep =
                        pick && supportsVariant(pick, "png", option.value);
                      load(
                        imageUrl(
                          keep ? pick.collection : collection,
                          option.value,
                          keep ? pick.id : "",
                          "",
                          version,
                        ),
                      );
                    }
                  },
                }))}
            />
          </div>
        </div>
        <div className="api-options-body">
          {mode === "seed" ? (
            <form
              className="api-seed"
              onSubmit={(event) => {
                event.preventDefault();
                if (seed.trim())
                  load(imageUrl(collection, style, "", seed, version));
              }}
            >
              <label htmlFor="api-seed">Public user ID or seed</label>
              <div className="api-seed-controls">
                <input
                  id="api-seed"
                  value={seed}
                  onChange={(event) => setSeed(event.target.value)}
                  maxLength={128}
                  required
                  pattern=".*\S.*"
                  placeholder="user-42"
                  aria-describedby="api-seed-help"
                />
                <button
                  className="btn"
                  disabled={loading || retryIn > 0 || !seed.trim()}
                >
                  {loading ? "Finding…" : "Find avatar"}
                </button>
              </div>
              <p id="api-seed-help">
                Enter a public ID, such as user-42. The same seed and filters
                always return the same avatar. Try a different ID to select
                again; different IDs can share a design.
              </p>
              <div className="api-seed-result" aria-busy={loading}>
                {!loading && !error && pick && (
                  <img src={preview} alt={pick.name} width="88" height="88" />
                )}
                <div
                  role={error ? "alert" : "status"}
                  className={error ? "api-seed-error" : undefined}
                >
                  {loading
                    ? "Finding your avatar…"
                    : error ||
                      (pick && (
                        <>
                          <strong>{pick.name}</strong>
                          <p>
                            {submittedSeed
                              ? `Result for “${submittedSeed}”. Your image URL and example below are ready.`
                              : "Current avatar. Enter a seed and select Find avatar to generate a repeatable selection."}
                          </p>
                        </>
                      ))}
                </div>
              </div>
            </form>
          ) : (
            <div
              className="api-catalog"
              role="group"
              aria-label="Avatar designs"
            >
              {visible.map((entry) => {
                const finish = style;
                return (
                  <button
                    key={`${entry.collection}/${entry.id}`}
                    aria-pressed={
                      pick?.collection === entry.collection &&
                      pick?.id === entry.id
                    }
                    onClick={() => {
                      if (Date.now() < retryAt) return;
                      setStyle(finish);
                      load(
                        imageUrl(
                          entry.collection,
                          finish,
                          entry.id,
                          "",
                          version,
                        ),
                      );
                    }}
                  >
                    <span
                      className="api-catalog-image"
                      data-collection={entry.collection}
                    >
                      {/* Wait for URL version/finish parsing before starting thumbnail downloads. */}
                      {request && (
                        <img
                          src={`/avatars/v${version}/${entry.collection}/${avatarFilename(entry.id, "png", finish).replace(/\.png$/, "-thumb.webp")}`}
                          alt=""
                          width="112"
                          height="112"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <noscript>
                        <img
                          src={`/avatars/v${PICKER_VERSION}/${entry.collection}/${entry.id}-thumb.webp`}
                          alt=""
                          width="112"
                          height="112"
                          loading="lazy"
                          decoding="async"
                        />
                      </noscript>
                    </span>
                    <span className="api-catalog-name">
                      {entry.name}
                      {pick?.collection === entry.collection &&
                        pick?.id === entry.id && <Icon name="check" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="api-selection" aria-busy={loading}>
          <div className="api-selection-preview">
            {preview && pick && (
              <img src={preview} width="56" height="56" alt="" />
            )}
            <div>
              <strong>
                {pick ? `Selected: ${pick.name}` : "Choose an avatar"}
              </strong>
              <span role="status">
                {loading
                  ? "Loading your selection…"
                  : error || "Your image is ready to use."}
              </span>
            </div>
          </div>
          <div className="api-buttons">
            {error && request && (
              <button
                className="btn"
                disabled={retryIn > 0}
                onClick={() => load(requestUrl)}
              >
                {retryIn > 0 ? `Retry in ${retryIn}s` : "Retry this request"}
              </button>
            )}
            {canCopy && pick.collection === "open-bot-avatar" && (
              <Link href={`/editor?avatar=${encodeURIComponent(pick.id)}`}>
                Edit this avatar
              </Link>
            )}
            <a href="#api-usage">
              Use this avatar <Icon name="arrow" />
            </a>
          </div>
        </div>
      </section>

      <section
        id="api-usage"
        className="api-usage"
        aria-labelledby="api-usage-heading"
      >
        <div className="api-section-head">
          <div>
            <h2 id="api-usage-heading">Use it in your app</h2>
            <p>Profile pictures, chat interfaces, and team directories.</p>
          </div>
          <Link href="/docs">
            API docs <Icon name="arrow" />
          </Link>
        </div>
        <div className="api-download-selection">
          {preview && pick && (
            <img src={preview} width="48" height="48" alt="" />
          )}
          <span>
            {loading
              ? "Loading your selection…"
              : error
                ? "Resolve the request error before downloading."
                : pick
                  ? `Downloads: ${pick.name} · ${finishes[pick.style]} · v${pick.version}`
                  : "Choose an avatar to download."}
          </span>
        </div>
        <label className="api-section-label" htmlFor="api-image-url">
          {selectedSeed ? "REPEATABLE SEED URL" : "SELECTED IMAGE URL"}
        </label>
        <input
          id="api-image-url"
          readOnly
          value={selectedUrl}
          placeholder="Your image URL appears here"
          onFocus={(event) => event.currentTarget.select()}
        />
        <div className="api-example-toolbar">
          <Segmented
            label="Integration example"
            value={example}
            onChange={setExample}
            options={["URL", "HTML", "React", "cURL"].map((value) => ({
              value,
              label: value,
            }))}
          />
          <div className="api-buttons">
            <button
              className="btn btn-primary"
              disabled={!canCopy}
              onClick={() => void copy(selectedUrl, "Image URL copied.")}
            >
              <Icon name="copy" />
              Copy URL
            </button>
            <button
              className="btn"
              disabled={!canCopy}
              onClick={() => void copy(snippet, `${example} example copied.`)}
            >
              Copy example
            </button>
          </div>
        </div>
        <pre
          className="code api-embed"
          tabIndex={0}
          aria-label={`${example} usage example`}
        >
          <code>{snippet}</code>
        </pre>
        <div className="api-usage-footer">
          <div className="api-buttons">
            <button
              className="api-share"
              disabled={!canCopy || downloading}
              onClick={() => void download("png")}
            >
              Download PNG
            </button>
            {pick && supportsVariant(pick, "svg", pick.style) && (
              <button
                className="api-share"
                disabled={!canCopy || downloading}
                onClick={() => void download("svg")}
              >
                Download SVG
              </button>
            )}
            <button
              className="api-share"
              disabled={!canCopy}
              onClick={sharePicker}
            >
              Share avatar
            </button>
            <a href={`/api/avatars?v=${version}`}>JSON catalog</a>
          </div>
          <span className="api-status">{message}</span>
        </div>
      </section>
      {active && message && (
        <div
          className={`copy-toast${toastVisible ? " is-visible" : ""}`}
          role="status"
          aria-hidden={!toastVisible}
        >
          {message}
        </div>
      )}
    </main>
  );
}
