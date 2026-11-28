# OpenBot Avatars improvements

Updated: **28 November 2026**. The six approved improvements are implemented locally below, ranked by effort from small to medium. All six are complete locally and verified on 28 November 2026.

| Order | Improvement | Effort | Status |
| --- | --- | --- | --- |
| 1 | Essential deployment instructions | Small | Complete locally |
| 2 | API failure diagnostics | Small | Complete locally |
| 3 | Keyboard access | Small to Medium | Complete locally |
| 4 | Deployment-aware copied URLs | Medium | Complete locally |
| 5 | Animated-preview recovery | Medium | Complete locally |
| 6 | Smaller PNG downloads | Medium | Complete locally |

## Completed work

### 1. Essential deployment instructions

Added a short [README deployment section](README.md#deployment) covering required Redis credentials, public-origin configuration, trusted client-IP headers, 503 behavior, and basic deployment checks. Updated [.env.example](.env.example) to distinguish build-time public configuration from server-only settings.

### 2. API failure diagnostics

Added [bounded server diagnostics](app/lib/diagnostics.js) for Redis configuration, connection, and response failures, plus missing/unreadable image assets. Logs contain only the subsystem and a fixed error category, with at most one message per subsystem per minute per process. Existing public responses and Redis fail-closed behavior are preserved; no logging service was added.

### 3. Keyboard access

Added Home/End handling to [segmented controls and menus](app/studio/studio/ui.tsx). Extended local browser checks to cover keyboard selection, menu navigation, settings access, visible thumbnail focus, editor link copying, PNG export, and focus returning to triggers. Reused the existing focus styles and Escape behavior.

### 4. Deployment-aware copied URLs

[Origin resolution](app/lib/site-url.js) now prefers an explicitly configured `NEXT_PUBLIC_SITE_URL`; otherwise picker/editor actions use the browser's current origin. API documentation examples use the request origin when no public override is configured. Server metadata honors the public override before its existing server-only and hosting-platform fallbacks. Public configuration is read at build time; Redis credentials stay server-only.

### 5. Animated-preview recovery

Added a [preview error boundary](app/studio/PreviewBoundary.tsx) that retains the returned PNG and usable copy/download actions when a renderer import or render fails. Loading that stalls for 15 seconds also falls back to PNG. A concise message and Show PNG action appear only on failure. Changing avatar, version, or finish, or toggling the preview, remounts the animation boundary. Normal preview explanations remain removed.

### 6. Smaller PNG downloads

Generated **282 derivatives**: 64, 128, and 256 px images for all 94 supported PNG finishes. Added a validated PNG-only `size` parameter, picker size control, size-preserving shares/downloads, and API documentation. Unsupported sizes, duplicate parameters, and all SVG requests containing `size` return 400. The default remains 512 px, with existing canonical URLs, bytes, and seeded design selection preserved. Smaller sizes have distinct canonical URLs and ETags.

Added `npm run generate:sizes`; the v5 generation command also generates derivatives after baking. The [generator](scripts/generate-sizes.mjs) refuses to overwrite an existing derivative with different bytes. The 282 new PNGs total **3,618,355 bytes**. Across the catalog, 64/128/256 px PNGs save approximately **97.5% / 92.3% / 74.2%** compared with their 512 px sources.

## Verification

- All **33 unit tests** pass, including new size validation, transparency, cache separation, seeded identity, origin configuration, and diagnostic throttling checks.
- Production build, TypeScript checks, and Git whitespace checks pass. Regenerating all 282 derivatives also passes without changing their bytes.
- Existing catalog validation passes: **47 designs, 123 original image variants, 94 thumbnails, and 223 frozen hashes**. All published original assets remain unchanged.
- The deployment image-route trace includes **505 avatar assets**, including all **282 derivatives**, with no retired v4 assets.
- All **56 local browser checks** pass: 28 desktop and 28 mobile-emulation checks, including keyboard use, copied origins, PNG sizes, and renderer import/render/timeout recovery. Recovery screenshots were visually reviewed on both layouts. No Chromium installation or browser execution was added to CI.
- Live deployment and physical-device behavior have not been verified.

## Repository cleanup completed

Completed on **28 November 2026**, following approval to perform the reviewed cleanup. Removed **1,022 generated files**, reclaiming **224,864,949 bytes** (about 225 MB). No automatic cleanup is scheduled.

| Removed target | Files | Bytes | Verification |
| --- | --- | --- | --- |
| `out/v5-bake/` | 223 | 11,042,657 | Every staged file matched its published counterpart by SHA-256 before removal. Generators recreate staging output. |
| `.next/` | 786 | 208,597,658 | Generated build/cache output; no Node process was running. |
| `tsconfig.tsbuildinfo` | 1 | 184,260 | Regenerable TypeScript incremental cache. |
| `test-results/` | 12 | 5,040,374 | Generated browser output from the completed verification runs. |

All deletion targets were verified to stay inside the repository, contain no tracked files, and contain no filesystem links. Published assets, new PNG derivatives, source files, curated experiment evidence, tests, fixtures, dependencies, and environment files were preserved. The verification results above describe the completed runs before cleanup; run `npm run build` again before `npm start` or production browser checks.

No source file has been confirmed unused by this review. `scripts/generate-avatars.mjs` is imported by the v5 generator, `scripts/gen-shapes.mjs` generates `src/shapes.ts`, and the watermark generator remains a package command. Keep renderer sources, demos, native ports, curated experiment evidence, tests, fixtures, secrets, and published assets. Absence from the Next.js build alone does not prove a file is disposable.

## Scope retained

Keep the current 47-design v5 catalog, existing filters, favorites, animation default, and actual-PNG toggle. Do not restore the intentionally removed preview explanations. Separate catalog-validation CI work, general ignore-rule cleanup, speculative performance changes, and product expansion remain outside this work. The only ignore-rule additions expose the new generator and unit tests to Git.
