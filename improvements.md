# OpenBot Avatars improvement roadmap

Reviewed: 24 November 2026. Updated: 25 November 2026. The v4 fluffy API implementation, versioned compatibility foundation, and static preview verification are complete locally. Desktop/emulated-mobile performance evidence is recorded; physical-mobile measurements and deployment remain pending. See the table for current status and remaining work.

## Goal and priorities

Make the avatars more distinctive, useful in other apps, and easy to browse while preserving saved image URLs and seeded selections. Start with fluffy API images and a small expansion of original designs.

“Benefit” below means expected user value, adoption, and reliability, not proven revenue. Effort is relative: low is a localized change, medium spans generation/API/UI, and high introduces a broader rendering or customization pipeline. Estimates need validation during implementation.

Keep this table current after each work session: record the status, date, work performed, measured outcome, evidence links, and any remaining limitation in the Result column.

| Work | Effort | Expected benefit | Order | Status | Result |
| --- | --- | --- | --- | --- | --- |
| Render and inspect one fluffy mug | Low to try | High if successful | First experiment | Completed (25 November 2026) | PASS: Added [reproducible bake script](scripts/experiment-fluffy-mug.mjs); compared enabled/disabled WebGL2 captures on the AMD GPU at 512 px and 64 px. Real fur, readable eyes, transparent margins, no clipped edges; control was flat. Repeat captures were byte-identical. Saved [reference](experiments/fluffy-mug/fluffy-512.png) and [measurements](experiments/fluffy-mug/result.json). The later v4 mug bake matches this reference exactly. Other-machine bake reliability remains unverified. |
| Compatibility foundation and catalog checks | Medium | High: protects existing integrations | Before v4 | Completed for v4 (25 November 2026) | Separate frozen [v3](app/lib/catalogs/v3.json) and [v4](app/lib/catalogs/v4.json) catalogs/assets, versioned routing/cache keys, explicit v4 variant pairs, and versioned exact/seeded picker links are implemented. Saved [20 v3 response fixtures / 141 asset hashes](test/fixtures/v3-compatibility.json) and [18 v4 seed fixtures / 187 hashes](test/fixtures/v4-compatibility.json). All old bytes/selections match; unversioned API/catalog behavior remains v3 (legacy seed-only URLs unchanged). Validation: 28 unit tests, 30 desktop/mobile browser tests, catalog checks, and production build pass. Reopening v4 links after a future v5 default remains a v5 release check. |
| Measure current editor and API performance | Low | Provides a mobile and desktop baseline | Before v4 | Partial: desktop and mobile emulation recorded (25 November 2026) | Built and measured the unchanged pre-v4 app using [measurement script](scripts/measure-performance.mjs): 18 GPU-enabled runs (3 per scenario/profile) plus 15 API samples, with transfer sizes, first painted canvas, frame timing, long tasks, and post-GC heap/DOM before and after 12 switches. Median first-avatar times: desktop flat/fluffy/API 597/584/702 ms; throttled Pixel 7 emulation 4,797/3,465/4,039 ms. Saved [raw results](experiments/performance-baseline/result.json) and screenshots. Physical-phone measurements remain pending; emulation shares the desktop GPU and is not mobile hardware evidence. |
| Fluffy Open Bot PNGs through the API | Medium, subject to WebGL feasibility | High: makes an existing editor feature embeddable | v4 · 41 designs | Completed locally — PASS (25 November 2026) | Baked all 23 Open Bot fluffy PNGs and thumbnails with pinned GPU-enabled Chromium; compared every coat against a WebGL-disabled control and visually reviewed 512/64 px output. Implemented v4 API/catalog, variant validation, animated previews by default with PNG viewing on demand, copied/shared URLs, and version/finish download names. The animated default was restored at the user's request. v4 has 41 designs, 105 images, 82 thumbnails; v3 is unchanged. Validation: 28 unit tests, 30 browser tests, catalog/hash checks, and production build. [GPU evidence](experiments/v4-fluffy/result.json), [64 px review](experiments/v4-fluffy/fluffy-vs-fallback-64.png). Deployment remains pending. |
| Verify and clarify the existing static preview | Low | Medium: users can inspect the actual response | v4 · 41 designs | Completed locally — PASS (25 November 2026) | Retained Preview PNG / Show animation; labels distinguish the animated demonstration from actual response bytes. Tests compare the displayed blob, copied URL, and downloaded PNG against v4 fluffy assets with WebGL disabled and reduced motion. Fluffy SVG is hidden, collection changes reset invalid finishes, and fallback messaging preserves the fluffy PNG. Reviewed saved [desktop](experiments/v4-fluffy/ui-desktop-response.png) and [mobile](experiments/v4-fluffy/ui-mobile-response.png) screenshots. |
| Compare performance and fix observed regressions | Low to measure, variable to fix | Preserves responsiveness | After v4 | Partial: measurements saved; animated default restored (25 November 2026) | Kept the 30 initial, 18 PNG/live, and 12 later runs as historical evidence. The user requested animated previews by default, so the temporary PNG-first behavior was reverted; its 5,025 ms / 7.1 ms PNG timings do not describe the current default. Initial mobile-emulated live fur measured 7,267 ms first canvas / 34.8 ms idle rAF p95. The thumbnail-loading fix remains: saved-v3 transfer fell from 467,122 to 387,651 bytes with no v4 thumbnail requests. [Historical summary](experiments/performance-v4-final/summary.json). Current-default profiling, physical-device/hosted measurements, and unchanged-editor timing variability remain pending. |
| Six additional original silhouettes | Medium–High | High: greater visual variety | v5 · 47 designs | Not started | Pending; no new designs implemented or reviewed. |
| Search and category filters | Low–Medium | Medium, increasing with catalog size | With expansion | Not started | Pending. |
| Smaller PNG sizes | Medium | Medium: lighter embeds | After expansion | Not started | Pending. |
| Curated API colors and backgrounds | High | Potentially high: broader customization | Later | Not started | Pending. |
| Favorites | Low–Medium | Low–Medium: helps returning visitors | Later | Not started | Pending. |
| Additional fur presets | Medium–High; renderer support unverified | Low–Medium: visual polish | Last | Not started | Pending; renderer customization support remains unverified. |

## Verified starting point

The following describes the pre-v4 baseline. Current v4 behavior and completed checks are recorded in the table and section 3.

- There are 41 designs: 23 Open Bot Avatar designs and 18 Libraries.dev designs.
- The editor already supports Open Bot flat/fluffy material, colors, state, mood, PNG export, and flat SVG export. Do not rebuild those controls.
- The API serves pre-generated 512 × 512 assets. Open Bot supports flat PNG/SVG; Libraries.dev supports flat/original plush PNG.
- The API page already has a **Preview PNG / Show animation** toggle. The earlier suggestion to add a static view is already implemented; verify and clarify it instead.
- Open Bot animated API previews explicitly use flat material, regardless of the editor's saved material.
- The current seed selection is SHA-256 followed by modulo the eligible catalog length. Changing candidate membership or order can change existing seeded selections.
- The Open Bot renderer already observes viewport visibility and reduces animation frequency for small avatars. Libraries.dev also has visibility handling. Profile before adding overlapping lifecycle code.
- Asset loading already reuses concurrent reads, caches bytes, and supplies ETags. Gallery WebP thumbnails already exist. Preserve these optimizations.
- The installed Open Bot package documents that fluffy rendering needs canvas and WebGL2 and can fall back to flat. Current Playwright configuration disables WebGL deliberately, so existing browser checks cannot prove fur rendered.

Relevant entry points: `scripts/generate-avatars.mjs`, `scripts/generate-thumbnails.mjs`, `app/api/avatar/route.js`, `app/api/avatars/route.js`, `app/lib/avatar-assets.js`, and `app/lib/catalog.json`. The UI work is centered on `app/studio/Api.tsx`, `ApiAvatar.tsx`, `api-urls.ts`, and the existing studio components.

## 1. Verify fluffy rendering on one avatar

**Status: Completed — PASS (25 November 2026).** The installed public renderer successfully baked a genuinely fluffy mug on this generation machine. The subsequent v4 implementation is recorded in section 3.

### Result and saved evidence

- Reproduce with `node scripts/experiment-fluffy-mug.mjs`. The script bundles a temporary harness with the existing Next.js webpack tooling and uses only public `mountAvatar` and example-definition imports. Temporary harness files are removed after the run.
- Pinned runtime: Node `v24.17.0`, Playwright `1.58.2`, full Chromium `145.0.7632.6` (Playwright revision `1208`, `channel: 'chromium'`), and `open-bot-avatar` `0.4.0`. The script rejects other versions rather than silently changing the bake runtime.
- Environment: Windows x64, AMD Radeon Graphics through ANGLE / Direct3D11. The enabled capture used the hardware GPU, with WebGL2 available and an observed instanced strand draw. The separate fallback browser used `--disable-webgl`, had no WebGL2, and drew no GPU strands. Both requested `material: 'fluffy'` with catalog color `#f4f4f4`, identical idle/neutral pose, fixed view and gaze, no pointer following, and a 512 × 512 host at device pixel ratio 1.
- Exported canvas pixels into transparent 512 × 512 PNGs, accounting for the renderer's positioned canvas. No page background or screenshot is included. Each capture waited for nonblank pixels unchanged for at least 750 ms within a 30-second bound. Both passed transparency and unclipped-edge assertions.
- Visually inspected both captures at 512 px and 64 px: the enabled image has visible strands and a soft coat; the control is visibly flat. The mug handle remains open and the eyes remain readable at 64 px. The approved textured reference is [fluffy-512.png](experiments/fluffy-mug/fluffy-512.png), with [64 px reference](experiments/fluffy-mug/fluffy-64.png). Controls: [512 px](experiments/fluffy-mug/fallback-512.png) and [64 px](experiments/fluffy-mug/fallback-64.png).
- The fluffy PNG is 161,923 bytes with 123,822 painted pixels and 138,322 fully transparent pixels; the control is 17,149 bytes with 108,352 painted pixels and 153,792 fully transparent pixels. Neither touches the outermost pixel boundary. Full runtime, GPU, draw-count, and SHA-256 evidence is saved in [result.json](experiments/fluffy-mug/result.json).
- Repeated the complete enabled/disabled experiment successfully on the same machine. Both PNGs were byte-identical to their corresponding first-run captures. Existing regression suite: `npm test` passed all 22 tests.
- Decision: proceed to compatibility work before a full v4 bake. Hardware-independent reliability, other designs, mobile performance, and shipping API support are outside this experiment. Production build and full application E2E were not run for this isolated bake; the existing WebGL-disabled E2E configuration and published assets were preserved.

### Experiment procedure

1. First prove that one Open Bot mug can be rendered with the installed renderer in WebGL2-enabled Chromium. Use the existing Playwright dependency and the public `mountAvatar` API in a temporary local rendering harness bundled with existing tooling. Do not import private renderer internals.
2. Mount one definition at a time at 512 × 512 with its catalog color, `material: 'fluffy'`, `renderer: 'canvas'`, `still: true`, idle state, neutral mood, fixed view, and no pointer following. Export canvas PNG bytes with transparency, not a screenshot containing the checkerboard or page background.
3. Wait for actual painted output and stable pixels with a bounded timeout. Capture the same avatar, color, pose, and dimensions twice on the generation machine, requesting fluffy material both times. Enable WebGL2 for the first capture and disable it for the fallback control. Inspect the coat at 512 px and 64 px and save the approved textured image as a visual reference. PNG byte differences alone can result from edge rendering. Fail the bake if the image is blank or shows the flat fallback.
4. Use a dedicated generation browser configuration that does not inherit `--disable-webgl`. Pin the browser/runtime used to bake assets. For full Chromium in headless mode, use `channel: 'chromium'`. See the [Playwright browser documentation](https://playwright.dev/docs/browsers#chromium-new-headless-mode). If reliable baking is unavailable, stop this feature at the feasibility checkpoint and retain the existing flat API until the rendering environment is fixed.

## 2. Establish compatibility before changing the catalog

**Status: Completed for the local v4 implementation (25 November 2026).** Separate v4 catalog/assets, version-aware API/UI lookup, explicit variant pairs, and frozen v4 fixtures are now implemented. Deployment and the future v4-link-after-v5 acceptance check remain pending. The original pre-v4 checkpoint evidence is retained below.

### Implemented safeguards and results

- Captured fixtures from the original route before changing runtime imports: three representative seeds across the unfiltered catalog, each collection, SVG, and original plush filters, plus legacy v1/v2 and unversioned/exact requests. All 20 requests retain the same canonical locations, selected collection/ID, and response SHA-256. All 141 existing published image/thumbnail hashes match.
- Froze candidate order, format/style eligibility, and source metadata in `app/lib/catalogs/v3.json` and `v3-sources.json`. Versioned lookup now reads separate v3/v4 snapshots, so changing the working `app/lib/catalog.json` cannot change v3 selection or its advertised catalog.
- `GET /api/avatars` retains its snapshotted v3 response; `GET /api/avatars?v=3` returns the same response, and `?v=4` explicitly selects v4. Duplicate or unpublished versions return a CORS-enabled, uncached 400. Version 3 still rejects Open Bot fluffy/original and Libraries.dev SVG; v4 additionally supports Open Bot fluffy PNG only.
- Exact and seeded picker shares include the selected version. Picker initialization reads that version before selecting a catalog; unsupported versions report an error instead of substituting the current version. Browser coverage exercises v3/v4 exact/seeded share, reopen, and reload with the original finish and selected URL.
- Added `npm run validate:catalog` and extended the existing tracked test suite. Validation checks duplicate collection/ID pairs, safe IDs, missing names/colors, valid public Open Bot definitions, known Libraries.dev designs, supported format/style pairs, consistency of optional explicit variant pairs with summaries, missing assets, decoded dimensions, painted output, transparent corners, thumbnails, and frozen file hashes. Negative cases cover duplicate IDs, invalid definitions, missing colors/assets, unsupported pairs, and inconsistent summaries.
- `npm test`: 25 passed. `npm run validate:catalog`: 41 designs, 82 images, 59 thumbnails, 141 frozen hashes passed. `npm run build`: passed. `npm run test:e2e`: 26 desktop/mobile checks passed after correcting two new test selectors. A final retry-button guard hides retry actions when no valid request was started, preventing unsupported versions from retrying as v3; the rebuilt app passed all 4 focused unsupported-version and normal-retry checks via `node node_modules/@playwright/test/cli.js test --grep 'picker does not|rate-limit retry'`. Existing CORS, conditional ETag, random no-store, rate limiting, and legacy behavior checks remain in the suite.
- v4 integration subsequently completed: 41 designs in the original order, 105 supported image variants, 82 thumbnails, version/variant asset lookup, and 18 frozen seeded selections plus 187 asset hashes. All existing v3 variants copied into v4 retain identical bytes. Publish the assets, catalogs, API, UI, and docs together; exercise saved v4 exact/seeded links after a future v5 default is implemented.

### What to do

Preserve existing version 1–3 behavior and unversioned URLs. Publish fluffy support for the existing 41 designs in v4 where supported. Publish the six additional designs in v5. Include the selected version in every new image URL and picker share.

### How to do it

1. Snapshot the current version 3 catalog, including its ordering and format/style eligibility. Keep the current published assets unchanged.
2. Add a separate version 4 catalog and asset directory. Route selection, asset lookup, response metadata, and canonical URLs through the requested version. Never let version 3 selection read a later catalog.
3. Let `GET /api/avatars` retain its current version 3 response; add `GET /api/avatars?v=4` for the new catalog. Make the UI consume the matching catalog. Explicit version 4 image responses must return version 4 in `Content-Location`.
4. Freeze each published version's candidate membership and order. Adding another design after version 4 is published requires a new catalog version; do not silently append to a seeded selection pool.
5. Store representative version 3 seed-to-avatar fixtures before modifying selection. Include no collection filter, each collection, SVG, and original plush filters.
6. Add catalog validation for duplicate collection/ID pairs, invalid definitions, missing colors, missing assets, and unsupported format/style combinations.

### Acceptance checks

- Old seeded and exact URLs return the same avatar IDs and image bytes as before.
- Save both an exact-design picker link and a seeded picker link in v4. After v5 becomes the default, reopen each link and verify the original version, design, and finish in the preview, download, and `Content-Location`.
- Existing version 3 invalid requests remain invalid, including fluffy/original Open Bot requests.
- Random responses remain uncached; exact/seeded responses retain conditional ETag requests, CORS, and rate limiting.
- Update version-validation tests intentionally: version 4 will cease to be an invalid version.

### Record the pre-v4 performance baseline

Measure the current production build on desktop and a representative mobile device. Record the browser, device, transfer sizes, first render time, frame timing, long tasks, and memory after repeated design switches. Use the existing editor to compare flat and fluffy. Record the API page with its current flat Open Bot preview.

**Status: Desktop and emulated-mobile measurements recorded; physical mobile pending (25 November 2026).**

Measured the unchanged production build before compatibility edits: commit `fd6ed9089cd018496f5f8ece825f0c812f45cd0d`, build ID `groPEFmR2ehcrXTmAi9E4`. Runtime: Node `v24.17.0`, Playwright `1.58.2`, full Chromium `145.0.7632.6`, renderer `0.4.0`. Hardware: Windows x64, Ryzen 5 5600H, 12 logical CPUs, approximately 7.34 GiB RAM, AMD Radeon Graphics through ANGLE/Direct3D11. All fluffy scenarios observed actual GPU strand draws.

Desktop viewport: 1440 × 1000 at DPR 1. Mobile emulation: Pixel 7, 412 × 839 at DPR 2.625, touch/mobile user agent, 4× CPU slowdown, 1.6 Mbps download, 750 Kbps upload, and 150 ms configured network latency. Each scenario ran three times in fresh browser contexts with HTTP cache disabled against a warm local production server and browser process. Recorded a 3-second idle frame window, then 12 design switches with 300 ms dwell, and post-GC JS heap/DOM counters before and after switches.

The following values are medians across the three runs. Transfer sizes include the document and resources loaded before switching; long-task counts cover the whole run. Heap values are MiB after forced GC. First avatar means the first nonblank live preview canvas, including initial editor state before shared options finish applying; it is not time to final interactive readiness.

| Profile | Scenario | First avatar (ms) | FCP (ms) | Transfer (bytes) | Idle rAF p95 (ms) | Long tasks | JS heap before → after 12 switches (MiB) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Desktop | Editor flat | 597 | 64 | 709,907 | 7.0 | 3 | 13.92 → 14.46 |
| Desktop | Editor fluffy | 584 | 56 | 850,039 | 7.1 | 7 | 6.46 → 7.93 |
| Desktop | API flat preview | 702 | 120 | 446,891 | 7.0 | 4 | 5.87 → 7.45 |
| Mobile emulation | Editor flat | 4,797 | 816 | 429,643 | 7.0 | 19 | 13.78 → 14.35 |
| Mobile emulation | Editor fluffy | 3,465 | 760 | 429,643 | 7.1 | 18 | 6.27 → 7.81 |
| Mobile emulation | API flat preview | 4,039 | 1,100 | 385,053 | 7.1 | 13 | 5.78 → 7.47 |

Local API response-body measurements (three requests each, warm process): catalog median 7.22 ms / 11,323 bytes; exact mug PNG 2.80 ms / 12,466 bytes; seeded PNG 3.31 ms / 23,531 bytes; exact mug SVG 3.77 ms / 16,396 bytes; random PNG 3.45 ms with size varying by selected design. Exact/seeded requests retained public caching; random requests returned `no-store`. These are loopback timings, not deployed-network latency.

Evidence: [raw metrics, per-resource transfers, long tasks, heap/DOM counters, and API samples](experiments/performance-baseline/result.json); screenshots for [desktop flat editor](experiments/performance-baseline/desktop-editor-flat.png), [desktop fluffy editor](experiments/performance-baseline/desktop-editor-fluffy.png), [desktop API](experiments/performance-baseline/desktop-api-flat.png), [mobile flat editor](experiments/performance-baseline/mobile-emulated-editor-flat.png), [mobile fluffy editor](experiments/performance-baseline/mobile-emulated-editor-fluffy.png), and [mobile API](experiments/performance-baseline/mobile-emulated-api-flat.png). Screenshots capture the viewport after switching; the mobile API image shows the selected-design gallery.

Repeat with `npm run build`, then `node scripts/measure-performance.mjs experiments/performance-next` using a new output directory; the script refuses to overwrite saved results. Compare future measurements on the same hardware/browser with these exact profiles. The baseline does not establish a regression or memory leak: rAF intervals measure browser scheduling rather than individual avatar paint cost, GPU/shader caches can remain warm between contexts, and JS heap excludes GPU allocations. Mobile emulation retained the desktop GPU. Finish this row with physical-phone measurements before claiming a representative mobile-device baseline.

## 3. Ship fluffy Open Bot PNGs in v4

**Status: Completed locally — PASS (25 November 2026).** Implementation and local release checks are complete; no external deployment was performed.

### Implemented behavior and measured result

- `npm run generate:v4` uses public `mountAvatar`, existing webpack tooling, Node `v24.17.0`, Playwright `1.58.2`, full Chromium `145.0.7632.6` (`channel: 'chromium'`), and renderer `0.4.0`. On the AMD Radeon/ANGLE Direct3D11 GPU, all 23 designs produced nonblank transparent 512 × 512 PNGs with actual strand draws. Each design also rendered a fluffy-request control with WebGL disabled; controls drew no strands and differed from the textured output. Painted pixels stabilized for at least 750 ms within a 30-second bound, with no painted pixels on the export boundary.
- Inspected all designs at 512 px and 64 px: fur is visibly textured, eyes remain readable, and holes/handles are preserved. Review sheets: [512 px 1](experiments/v4-fluffy/coat-512-1.png), [2](experiments/v4-fluffy/coat-512-2.png), [3](experiments/v4-fluffy/coat-512-3.png), [4](experiments/v4-fluffy/coat-512-4.png), and [64 px fluffy/control pairs](experiments/v4-fluffy/fluffy-vs-fallback-64.png). The mug PNG is byte-identical to the approved first-experiment reference. [Per-design GPU/draw/pixel/hash evidence](experiments/v4-fluffy/result.json) is saved.
- New files live in `public/avatars/v4/` and `app/lib/catalogs/v4.json` / `v4-sources.json`. All 41 designs retain their original order and colors. Open Bot supports flat PNG, flat SVG, and fluffy PNG; Libraries.dev supports flat/original PNG. Version 4 uses explicit `variants`, not a Cartesian product. API requests only read cached saved files; the browser renderer runs offline during generation.
- `/api/avatar?v=4&collection=open-bot-avatar&avatar=mug&style=fluffy&format=png` returns the baked coat and a canonical v4 `Content-Location`. `/api/avatars?v=4` advertises the new pairs and finish URLs. Unversioned image and catalog requests preserve v3 behavior; seed-only legacy URLs remain unchanged. Fluffy SVG and Libraries.dev fluffy return readable uncached 400 errors. Conditional ETag, CORS, rate limiting, and random `no-store` are preserved.
- The new picker defaults to v4; saved v3 and unversioned picker selections retain v3. Initialization validates the version before catalog selection; gallery requests wait until URL version/finish parsing completes, avoiding initial wrong-version thumbnails. A no-JavaScript gallery remains available through `noscript`. Finish controls and thumbnails use valid PNG pairs, collection changes reset the finish, and fluffy selections hide SVG downloads. Copied URLs, snippets, exact/seeded shares, captions, and v4 download names preserve version/design/finish (for example `mug-fluffy-v4.png`). Fluffy previews animate by default, as requested by the user; Preview PNG shows the actual returned image on demand, and Show animation returns to the live preview. A WebGL2 fallback notice preserves the selected fluffy PNG. Explicit preview-mode choices persist through design/collection/seed changes.
- Validation: `npm test` passed 28 tests; `npm run test:e2e` passed 30 desktop/mobile tests; `npm run build` passed. `npm run validate:catalog` passed v3 (41 designs / 82 images / 59 thumbnails / 141 frozen hashes) and v4 (41 / 105 / 82 / 187). Tests serve every v4 variant and verify transparent decoded images/thumbnails, all frozen bytes, 20 old URL responses, 18 v4 seed mappings, version-separated caches, invalid pairs, conditional caching, shared links, fallback behavior, and byte-exact displayed/downloaded PNGs. V4 seed/asset fixtures are [saved here](test/fixtures/v4-compatibility.json).
- Deployment-size evidence: v3 remains 3,766,277 bytes across 141 files. The separate v4 directory adds 9,071,770 bytes across 187 files (including unchanged copies of previous variants plus 23 coats and their thumbnails). Both versions must remain deployed. Generation refuses to replace any existing v4 file with different bytes.
- Limits: only this generation machine has been verified; other-GPU bake reproducibility, physical-phone performance, production-host latency, external deployment, and reopening v4 links after a future v5 default remain unverified. Local saved v3/v4 URLs and bytes are covered by fixtures and browser reload tests.

### What to do

Support `style=fluffy` for Open Bot PNGs in version 4. Keep `style=flat` as the default and keep Libraries.dev's `style=original` naming and behavior.

Example target URL:

```text
/api/avatar?v=4&collection=open-bot-avatar&avatar=mug&style=fluffy&format=png
```

### How to do it

1. Generate all Open Bot fluffy PNGs once the sample succeeds, then generate their small WebP thumbnails. Commit the approved assets; public API requests must read files rather than launch browsers or render fur.
2. Record valid format/style pairs in the version 4 catalog, for example `variants: [{ format: 'png', style: 'flat' }, { format: 'svg', style: 'flat' }, { format: 'png', style: 'fluffy' }]`. Existing `formats`/`styles` summaries may remain, but validation and UI availability must use the pairs. A Cartesian product would incorrectly advertise fluffy SVG.
3. Map validated version 4 variants to filenames centrally, such as `mug-fluffy.png`. Include version and variant in asset cache keys. Keep the existing version 3 paths and cache behavior intact.
4. Update finish choices, shared URL parsing, canonical URLs, selected-image captions, download names, and integration snippets together. Replace binary flat/original assumptions with explicit finish handling. Hide SVG download for fluffy selections.
5. Pass the selected material to Open Bot live previews. Since devices without WebGL2 can fall back to flat, keep the real returned PNG available and explain a live fallback when it occurs. Do not change the selected download or URL to flat silently.
6. Include `v` when sharing exact-design and seeded picker links. When reopening either link, read its version before selecting the catalog and fetching the image.
7. Update README, API docs, and examples to explain version 4 support and valid combinations. Keep editor export behavior distinct: its SVG export remains explicitly flat.

### Acceptance checks

- All Open Bot designs have decodable fluffy PNGs and matching thumbnails with transparent backgrounds and no clipped fur.
- Fluffy PNG differs visibly from flat; eyes remain readable at 64 px.
- Exact URLs reproduce identical bytes; seeded URLs are stable within their frozen version and filters.
- Fluffy SVG and Libraries.dev `style=fluffy` return readable 400 errors.
- Copy/share/reload/download preserve version, design, and finish. Switching collections cannot leave an invalid finish selected.
- Separate GPU-enabled visual checks verify real fur. Existing WebGL-disabled browser checks continue verifying fallback behavior.

### Verify the existing API preview

**Status: Completed locally — PASS.** The animated demonstration is the default, and Preview PNG shows the actual returned image on demand. WebGL-disabled/reduced-motion browser tests verify the default live canvas, fallback notice, fluffy response bytes, copied URL, share/reload, filename, and downloaded bytes; static response updates are also checked after design, finish, collection, and seed changes. Saved [desktop](experiments/v4-fluffy/ui-desktop-response.png) and [mobile](experiments/v4-fluffy/ui-mobile-response.png) screenshots show the on-demand PNG mode. Flat preview toggling preserves the hero layout. Finish selection is also exercised with keyboard activation.

- Retain the existing static PNG toggle and verify it displays the fetched response blob, not a separate approximation.
- Use clear labels for the animated demonstration and actual returned PNG. Captions must show the selected finish accurately.
- Verify both modes after changing collections, finishes, seeds, and designs. Keep the static response available under reduced motion and without WebGL2.
- Add focused browser coverage for the toggle only where current tests lack it. Do not create another preview component or duplicate toggle.

Done when the displayed static image, copied URL, and downloaded image all identify the same version/design/finish.

### Repeat the measurements after v4 ships

Repeat the baseline scenarios on the same devices and browsers. Measure the new fluffy API preview separately. If performance regresses, check offscreen pausing, hidden tabs, reduced motion, and renderer cleanup. Fix the observed bottleneck and repeat the measurement before introducing a quality control.

**Local production comparison recorded (25 November 2026); physical-phone and hosted checks remain pending.** Used the same Node/Playwright/Chromium versions, AMD GPU, desktop viewport, and throttled Pixel 7 emulation as the baseline. The [initial 30-run comparison](experiments/performance-v4/result.json) repeated both editor finishes and the v3 flat API preview, adding separate v4 flat and fluffy API previews. Existing editor timings varied: desktop flat/fluffy medians were 623/950 ms versus baseline 597/584 ms; mobile emulation was 6,177/3,587 ms versus 4,797/3,465 ms. The editor renderer was unchanged. These observations require controlled profiling before attributing a cause or claiming all performance checks are complete.

**Current behavior supersedes the PNG-first experiment below:** the user explicitly requested animation by default and PNG viewing on demand. That preference is restored. The measurements remain historical evidence of each mode's costs, not a benchmark of the latest default. No new full performance run was performed for this preference change.

Two concrete costs were identified and addressed:

1. The initial mobile-emulated fluffy live preview needed a median 7,267 ms to first live canvas, with 34.8 ms idle rAF p95. A temporary PNG-first experiment was measured in the [18-run PNG/live follow-up](experiments/performance-v4-png-first/result.json): PNG mode drew no fur strands, while live rendering did. Live rendering remained expensive under 4× CPU emulation (median 4,016 ms from Show animation to the first live canvas and 41.7 ms idle rAF p95). The PNG-first default was subsequently reverted at the user's request; no renderer fork or overlapping lifecycle/quality controls were added.
2. Per-resource records showed saved v3 pages loading v4 thumbnails before URL parsing, then fetching v3 thumbnails. Thumbnail requests now wait until the requested version, collection, and finish are known. The no-JavaScript gallery is preserved via `noscript`. Final browser tests assert that v3 links make no v4 thumbnail requests and that all 41 gallery images remain present without JavaScript.

Before restoring the animated default, [12 runs](experiments/performance-v4-final/result.json) on production build `wro6LsynfnTuSK9k5J8t4` measured saved-v3 flat and the temporary PNG-first v4 view, three times per profile. The [historical summary](experiments/performance-v4-final/summary.json) contains medians and verification assertions:

| Profile | Final scenario | First visible response (ms) | Transfer (bytes) | Idle rAF p95 (ms) | Long tasks | Post-GC JS heap before → after 12 switches (MiB) |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop | Saved v3 flat | 424 | 395,961 | 7.1 | 4 | 5.97 → 7.52 |
| Desktop | Default v4 fluffy PNG | 511 | 605,378 | 7.1 | 3 | 5.34 → 5.87 |
| Mobile emulation | Saved v3 flat | 3,699 | 387,651 | 27.8 | 31 | 5.87 → 7.51 |
| Mobile emulation | Default v4 fluffy PNG | 5,025 | 591,866 | 7.1 | 12 | 5.43 → 5.90 |

All fluffy runs in that PNG-first snapshot drew zero GPU fur strands; these are not live-animation timings. Saved-v3 pages made zero wrong-version thumbnail requests. Relative to the initial v4 implementation, their median transfer decreased from 537,270 to 395,961 bytes on desktop and from 467,122 to 387,651 bytes in mobile emulation. That build's server trace includes all 141 v3 and 187 v4 files.

Interpret the clocks carefully: the original baseline/initial comparison waited for a live canvas; follow-ups can observe the decoded returned PNG. Opt-in live timing starts at the Show animation action. These are useful measurements of the chosen experience, not identical render pipelines or a controlled performance guarantee. RAF intervals measure browser scheduling, JS heap excludes GPU allocations, and mobile emulation retains the desktop GPU. Physical-device results, deployed-network latency, and the slower/variable unchanged-editor and flat-live cases remain follow-up work.

Measure current behavior with `npm run build` then `node scripts/measure-performance.mjs experiments/performance-next api-flat,api-fluffy-live`. `api-fluffy-live` measures the default animation from navigation start; `api-fluffy` measures the on-demand PNG from the Preview PNG action. Omit the last argument to inspect all scenarios. Use a new output directory for every run.

## 4. Expand to 47 designs in v5

### What to do

Create a mushroom, jellybean, ringed planet, lighthouse, sailboat, and teapot. Review all six alongside the existing gallery as 32 px silhouettes before producing any finishes. Revise any shape that is hard to distinguish at that size. Do not count recolors or finishes as additional designs. Target 47 total designs after all six pass review.

### How to do it

1. Start with the teapot. Use the [avatar generation skill](skills-generate-avatar/SKILL.md) and its [geometry prompt](skills-generate-avatar/references/system-prompt.md) to turn the brief into an `AvatarDefinition` with a silhouette path and eye placement. The editor and asset generator can use the same geometry for gaze, moods, animation, and both finishes.
2. Run the installed `open-bot-avatar` package's `validateAvatar` on the candidate and check its ID against the Open Bot collection. The [watering-can example](skills-generate-avatar/examples/watering-can.json) passes this schema check and already has a catalog entry. Use it as a validation example.
3. For stricter checks on space around the eyes and accidental notches in the outline, point `AVATAR_REPO` at an upstream checkout containing `packages/core/scripts/avatar-validate.ts`. From this project root in Git Bash or another compatible shell, substitute the checkout and candidate paths below. Record the schema and strict results separately for each candidate, including any check skipped.

   ```sh
   AVATAR_REPO=/path/to/open-bot-avatar sh skills-generate-avatar/scripts/validate.sh --strict /path/to/teapot.json
   ```

4. Compare the teapot with existing designs at 32 px. Check that its handle reads clearly and its eyes fit through changes of mood and gaze. Preview flat and fluffy at 32, 64, 128, and 512 px to check fur edges and transparent margins. Once the teapot passes, repeat for the remaining five. Give each approved design a default color and category, credit its origin, and add its local definition to the editor library and v5 generation input. Keep these first-party definitions separate from the upstream snapshot.
5. Bake all supported PNG/SVG assets and thumbnails, and update the editor's baked fluffy thumbnail atlas or its generation workflow as needed. Do not leave new entries using stale or missing atlas cells.
6. Publish this batch in v5 with 47 designs. Keep v4 frozen at 41 designs and verify its saved seed fixtures against the expanded release.
7. Derive current design counts from catalog data where practical; retain explicit frozen counts in compatibility tests.

Done when all six work in the API, picker, live editor, share links, and exports, without altering old seeded selections.

### Ship search and category filters with v5

- Add case-insensitive name/ID search and category filters to the existing picker. Combine them with collection and supported-finish filtering.
- Assign categories to existing and new designs: object, nature, food, abstract, and robot. Keep categories as catalog metadata, not API image parameters.
- Preserve the selected avatar when filtering hides it. Show the filtered count and an empty-state reset action.
- Keep filtering local over the already loaded catalog. No search backend or virtualization is needed for this catalog size.
- Reuse the existing Random avatar action; do not add a duplicate “Surprise me” control.
- Check keyboard access, visible focus, screen-reader labels, and mobile layout.

Done when combined filters work and clearing them restores the catalog without changing the current image URL.

## 5. Later improvements

### Smaller PNGs

- Add a validated `size` parameter for 64, 128, 256, and 512 px, with 512 as default, in the new version only. Initially keep SVG size handling unchanged and reject incompatible requests clearly.
- Pre-generate smaller PNGs from approved source assets. Include size in filenames, lookup keys, ETags, canonical URLs, shares, and downloads. Keep previews' dimensions and captions accurate.
- Verify decoded dimensions, transparency, identity, cache separation, and smaller transfer sizes. Compare against existing WebP gallery thumbnails; they already serve the browsing use case.

### Curated colors and backgrounds

- Start with a small named palette and transparent/light/dark backgrounds rather than arbitrary CSS input. Keep transparent as default.
- Bake supported combinations offline and describe valid variants in the catalog. Calculate asset count and deployment size before committing to a palette; designs × finishes × colors × backgrounds × sizes can grow quickly.
- Keep color/background choices independent of seed identity: select the design, then apply its supported appearance. Carry every appearance option into canonical URLs and cache keys.
- Treat this as a separate release with explicit parameter documentation and tests. Do not implement an unrestricted browser renderer inside the public API.

### Favorites

- Store collection/ID pairs locally using the existing stored-state patterns. Add favorite buttons and a favorites filter, handle removed entries gracefully, and make clear that favorites stay on this device. No accounts or backend are needed.

### Additional fur finishes

- Evaluate short velvet and shaggy fur only after basic fluffy delivery succeeds. First inspect the renderer's public customization API; the current wrapper exposes a material choice, not arbitrary fur controls.
- If new finishes require maintaining a renderer fork, reassess their value before implementation. Keep the existing fluffy material as the only committed first-release finish.

## Validation and release checklist

- Extend existing API, catalog, and browser tests rather than creating a parallel suite. Some test files match `.gitignore` rules; confirm new tests are tracked with `git status` and `git ls-files`.
- Make catalog checks variant-aware. Cover asset existence, unique IDs, dimensions, transparency, thumbnail coverage, valid format/style pairs, and versioned seed fixtures. Current tests already cover several of these; extend them rather than duplicating them.
- Run `npm test` and `npm run build`. Then run `npm run test:e2e` against the production build. Run these checks for each release.
- Run the separate WebGL2-enabled generation/visual checks for fluffy assets. Ordinary fallback E2E success is insufficient evidence of fur quality.
- Review desktop and mobile screenshots, 64 px crops, keyboard operation, reduced motion, unsupported WebGL behavior, API errors, retries, and downloads.
- Publish catalogs, assets, API support, UI, and docs together. Keep previous versioned assets deployed. Roll back the new UI/default selection to version 3 if needed without deleting already published version 4 URLs.
- Observe existing platform error/latency and deployment-size information before adding telemetry services. Track new version 4 400/503 responses and missing assets without logging public seed values unnecessarily.

## Evidence and limits

Repository cleanup (25 November 2026): `.gitignore` now covers dependencies, builds/caches, environment secrets, deployment state, logs, and browser output without excluding test sources or fixtures. Removed duplicate `out/v4-bake` assets, generated test output, the TypeScript build-info cache, and 20 unreferenced screenshots from intermediate performance runs (212 files / 20,132,321 bytes at cleanup). Raw measurement JSON, summaries, linked baseline screenshots, GPU review sheets, visual references, published assets, demos, and native ports were retained. Historical benchmark data was not rewritten to match the user's changed preview preference.

This roadmap is based on the repository, existing tests, installed `open-bot-avatar` 0.4.0 public types and renderer implementation, and installed Libraries.dev renderer code. During roadmap verification, all 22 local tests passed. The linked Playwright documentation confirms the Chromium channel option. Experiment 1 subsequently verified GPU rendering on the generation machine; mobile performance still requires measurement on target devices.

Experiment 1 passed the first checkpoint with a visually verified, repeatable fluffy mug bake. The local v4 implementation now includes all 23 verified fluffy designs, frozen v3/v4 catalogs and assets, API/picker support, and static preview verification. GPU bake reproducibility across machines, physical-device mobile performance, production-host latency, user demand, revenue impact, and the effort of authoring the six new v5 designs remain unmeasured. No external deployment has been performed in these experiments.
