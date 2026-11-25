import { parse, render } from "sugar-high/core";
import * as typescript from "sugar-high/lang/typescript";
import * as shell from "sugar-high/lang/shell";
import * as json from "sugar-high/lang/json";
import { SITE_URL } from "../lib/site-url";
import Link from "next/link";
import catalog from "../lib/catalogs/v4.json";
import { CodeBlock } from "./CodeBlock";

function highlight(text: string, language: Parameters<typeof parse>[1]) {
  return { text, html: render(parse(text, language)) };
}

const snippets = {
  curl: highlight(`curl "${SITE_URL}/api/avatar?v=4&seed=user-42" --output avatar.png`, shell),
  react: highlight(`export function UserAvatar({ userId }: { userId: string }) {
  const params = new URLSearchParams({ v: "4", seed: userId });
  return (
    <img
      src={"${SITE_URL}/api/avatar?" + params}
      width={64}
      height={64}
      alt="User avatar"
    />
  );
}`, typescript),
  save: highlight(`const response = await fetch('${SITE_URL}/api/avatar?v=4');
if (!response.ok) {
  const { error } = await response.json();
  throw new Error(error);
}

const location = response.headers.get('Content-Location');
if (!location) throw new Error('Missing avatar URL');
const avatarUrl = new URL(location, response.url).href;
// Store avatarUrl on the user's profile to keep this exact image.`, typescript),
  catalog: highlight(`const response = await fetch('${SITE_URL}/api/avatars?v=4');
if (!response.ok) throw new Error('Could not load the catalog');
const { total, avatars } = await response.json();

// Use entry.variants for valid format/style pairs.
// fluffyUrl and originalUrl are null when that finish is unavailable.
const avatarUrl = new URL(avatars[0].url, response.url).href;`, typescript),
  error: highlight(`{
  "error": "Choose an avatar or a seed, not both."
}`, json),
};

function Code({ snippet, language }: { snippet: keyof typeof snippets; language: string }) {
  return <CodeBlock {...snippets[snippet]} language={language} />;
}

const PARAMETERS = [
  ["v", "Use 4 for new integrations, including fluffy PNGs. Versions 1–3 preserve saved links. Unversioned seed-only requests use the legacy mapping; other unversioned image requests and /api/avatars retain v3."],
  ["seed", "A public identifier of 1–128 JavaScript string code units. The same seed with the same version and filters selects the same avatar. Cannot be combined with avatar."],
  ["collection", "open-bot-avatar or bot-avatars. Omit to select from collections compatible with the requested format and style."],
  ["avatar", "An exact design ID from /api/avatars. Requires collection. Omit both avatar and seed for a random selection."],
  ["format", "png (default) or svg. SVG is available only for Open Bot with flat style; fluffy SVG is rejected."],
  ["style", "flat (default), fluffy (v4 Open Bot PNG only), or original (Libraries.dev PNG only). Check the catalog variants for valid pairs."],
];

export function Docs() {
  return <main className="page docs api-page">
    <section className="page-head">
      <h1>OpenBot Avatars API docs</h1>
      <p className="lead">Add a bot avatar to your app with one image URL. No account, API key, or package installation required.</p>
      <ul className="what">
        <li>{catalog.length} designs across two collections.</li>
        <li>Random images, repeatable seeds, and exact avatar URLs.</li>
        <li>Transparent 512 × 512 PNGs, plus native SVGs for Open Bot Avatar.</li>
      </ul>
      <p>Try requests in the <Link href="/">API playground</Link>. Artwork credits and MIT license details are on the <a href="/license">license page</a>.</p>
    </section>

    <h2>Quick start</h2>
    <p>Use the image endpoint directly in an image tag. Each request without a seed or avatar picks a random design; repeats are possible.</p>
    <CodeBlock language="HTML" text={`<img src="${SITE_URL}/api/avatar?v=4" width="64" height="64" alt="Bot avatar">`} />
    <p>These examples use the hosted API at <a href={SITE_URL}>{SITE_URL}</a> and work from your app’s domain. If you host your own copy, replace this origin with your deployment’s public URL.</p>
    <Code snippet="curl" language="Shell" />

    <h2>Endpoints</h2>
    <div className="api-table-wrap"><table className="props">
      <thead><tr><th scope="col">GET request</th><th scope="col">Response</th></tr></thead>
      <tbody>
        <tr><th scope="row"><a href="/api/avatar?v=4"><code>/api/avatar?v=4</code></a></th><td>A random avatar image. Defaults to flat PNG.</td></tr>
        <tr><th scope="row"><a href="/api/avatars?v=4"><code>/api/avatars?v=4</code></a></th><td>Version 4 catalog with 41 designs, explicit variants, and image URLs for supported finishes.</td></tr>
        <tr><th scope="row"><a href="/api/avatars"><code>/api/avatars</code></a></th><td>Frozen version 3 catalog for existing integrations.</td></tr>
      </tbody>
    </table></div>

    <h2>Repeatable avatars with seeds</h2>
    <p>Use <code>/api/avatar?v=4&amp;seed=user-42</code> to select an avatar consistently for a user. Include the version and keep the collection, format, and style filters the same to retain the selection. Candidate membership and ordering are frozen within each version. Different seeds can select the same design.</p>
    <p>Seeds are visible in URLs. Use a public identifier rather than an email address, password, or other private value. Encode seed values with <code>URLSearchParams</code>.</p>
    <Code snippet="react" language="TSX" />

    <h2>Choose a specific design</h2>
    <p>Read the catalog for valid IDs and supported combinations. Use <code>collection</code> and <code>avatar</code> together for an exact selection.</p>
    <div className="api-table-wrap"><table className="props">
      <thead><tr><th scope="col">Example</th><th scope="col">Result</th></tr></thead>
      <tbody>{[
        ["/api/avatar?v=4&collection=open-bot-avatar&avatar=mug", "Mug in its original color, flat PNG"],
        ["/api/avatar?v=4&collection=open-bot-avatar&avatar=mug&style=fluffy", "Mug with baked fur, transparent PNG"],
        ["/api/avatar?v=4&collection=open-bot-avatar&avatar=controller&format=svg", "Controller as a flat native SVG"],
        ["/api/avatar?v=4&collection=bot-avatars&style=original", "Random Libraries.dev design in its original plush style"],
      ].map(([url, description]) => <tr key={url}><td><a href={url}><code>{url}</code></a></td><td>{description}</td></tr>)}</tbody>
    </table></div>
    <Code snippet="catalog" language="JavaScript" />

    <h2>Query parameters</h2>
    <p>These parameters apply to <code>GET /api/avatar</code>. Collection, avatar, format, and style require version 3 or 4; omitting the version with these filters selects version 3. Fluffy requires explicit <code>v=4</code>.</p>
    <table className="props"><tbody>{PARAMETERS.map(([name, description]) => <tr key={name}>
      <th scope="row"><code>{name}</code></th><td>{description}</td>
    </tr>)}</tbody></table>

    <h2>Save a random result</h2>
    <p>A random request returns the chosen image’s exact, reusable path in the <code>Content-Location</code> response header. Resolve it against the API host and save that URL to keep the same image.</p>
    <Code snippet="save" language="JavaScript" />

    <h2>Responses, caching, and CORS</h2>
    <table className="props"><tbody>{[
      ["200", "The image bytes, or JSON for the catalog. Images use image/png or image/svg+xml."],
      ["Content-Location", "Relative URL of the exact selected image, including its version, collection, ID, format, and style."],
      ["X-Avatar-Collection / X-Avatar-Id", "Identify the returned design."],
      ["Cache-Control", "Random images use no-store. Seeded images, exact image URLs, and the JSON catalog use public, max-age=86400 (one day)."],
      ["ETag / 304", "Image responses include an ETag. For seeded or exact image requests, send it as If-None-Match to receive 304 with no body when unchanged."],
      ["CORS", "Both endpoints allow requests from any origin. Image responses expose Content-Location, X-Avatar-Collection, X-Avatar-Id, and ETag to browser JavaScript."],
    ].map(([name, description]) => <tr key={name}><th scope="row"><code>{name}</code></th><td>{description}</td></tr>)}</tbody></table>

    <h2>Errors</h2>
    <p>Both endpoints share a limit of 180 requests per minute per client IP at the application server. Excess requests return <code>429</code>; wait for the number of seconds in <code>Retry-After</code> before retrying. Cached images do not consume this quota. If the shared limiter is unavailable, requests return <code>503</code> with retry guidance.</p>
    <p>Invalid requests return <code>400</code> with a JSON <code>error</code> message and <code>Cache-Control: no-store</code>. Unknown or duplicate parameters, invalid values, unknown avatar IDs, and unsupported format or style combinations are rejected.</p>
    <Code snippet="error" language="JSON" />
    <p>For example, do not combine <code>seed</code> with <code>avatar</code>, request SVG for Libraries.dev, fluffy SVG, or original plush for Open Bot Avatar. Check each v4 catalog entry’s <code>variants</code> pairs before constructing a URL; the format/style summaries are not a Cartesian product.</p>

    <h2>Hosted images and the editor</h2>
    <p>The hosted API serves pre-generated images with the catalog’s original colors and fixed poses. All 23 Open Bot designs support <code>v=4&amp;style=fluffy</code> as PNG; Libraries.dev’s original plush images use <code>style=original</code>. Requests read saved files and do not render fur on the server. Custom editor colors, mood, rotation, and animation remain editor controls.</p>
    <p>Fluffy previews animate by default. Choose Preview PNG to inspect the actual returned image, then Show animation to return to the live preview. Live fur can fall back to flat when WebGL2 is unavailable; the saved PNG keeps its fluffy finish on every device. Copied URLs, shared picker links, and downloads preserve the selected version and finish.</p>
    <p>Use the <Link href="/">API playground</Link> to choose a hosted image, copy its URL or HTML embed, and download supported formats.</p>
    <p>In the <Link href="/editor">editor</Link>, choose Export → Download current preview for a transparent PNG with the visible material, color, pose, and angle. Download flat SVG keeps the selected color, mood, state, and angle in a still vector image. The original-color API URL always points to the hosted catalog image.</p>
  </main>;
}
