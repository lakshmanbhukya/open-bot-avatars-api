<p><img src="docs/open-bot-avatars-api.png" width="100%" alt="OpenBot Avatars API preview"></p>

# OpenBot Avatars API

Bot avatars for profile pictures, chat interfaces, and apps. Open source, MIT licensed. No API key required.

- **47 designs** from Open Bot Avatar, Libraries.dev, and six first-party originals.
- **Transparent PNGs**, repeatable seeds, and reusable image URLs.
- **Fluffy Open Bot PNGs in v5**, baked once and ready to embed without WebGL.
- **Live editor** with animation, colors, moods, and PNG/SVG downloads from [Open Bot Avatar](https://github.com/DominikScholz/open-bot-avatar) and [Libraries.dev](https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/bot-avatars)

<p><img src="docs/look01.png" width="100%" alt="OpenBot Avatars API homepage showing a green plush flower avatar and an API request example"></p>

## Use an avatar

```html
<img
  src="https://open-bot-avatars-api.vercel.app/api/avatar?v=5"
  width="64"
  height="64"
  alt="Bot avatar"
/>
```

The [hosted API](https://open-bot-avatars-api.vercel.app/) returns a transparent 512 × 512 PNG, ready to use in your app.

| Endpoint                                                             | Result                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------- |
| `/api/avatar?v=5`                                                    | Random flat avatar from the frozen 47-design v5 catalog. |
| `/api/avatar?v=5&seed=user-42`                                       | Repeatable avatar for a public seed.                     |
| `/api/avatar?v=5&collection=open-bot-avatar&avatar=mug&style=fluffy` | A fluffy mug as a transparent PNG.                       |
| `/api/avatars?v=5`                                                   | v5 catalog, valid format/style pairs, and image URLs.    |
| `/api/avatar` and `/api/avatars`                                     | Default to v5, including seed-only requests.             |

For smaller PNGs, add `size=64`, `size=128`, or `size=256` to an image URL.
Omit `size` for the existing 512 px image. Size preserves seeded design selection
and is PNG-only; SVG requests must omit it. The playground copies and downloads
the selected PNG size.

Smaller images are pre-generated from the frozen 512 px assets:

```sh
npm run generate:sizes
```

`npm run generate:v5` also generates these derivatives after baking the catalog.

## Development

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000) to browse avatars, try the editor, and read the API docs.

The [editor](https://open-bot-avatars-api.vercel.app/editor) exports the current preview as a transparent PNG or a flat SVG. The [API docs](https://open-bot-avatars-api.vercel.app/docs) include copyable integration examples. Selections stay in place when switching between these pages.

```sh
npm test
npm run build
npm start
```

For desktop and mobile browser checks, build the app first, then run:

```sh
npx playwright install chromium
npm run test:e2e
```

## Deployment

Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to your shared
Upstash Redis credentials on Vercel. They are server-only secrets. Missing,
invalid, or unavailable configured Redis causes API requests to return **503**;
the app does not fall back to an in-memory quota on Vercel. Local development
can leave both unset to use the per-process limiter.

Set `NEXT_PUBLIC_SITE_URL` before building if copied links should use a fixed
public origin. Otherwise client actions use the current browser origin. Server
metadata uses `NEXT_PUBLIC_SITE_URL`, then server-only `SITE_URL`, then the
hosting platform's production-domain fallback. Use matching origins if setting
both variables. Public variables are included in the browser bundle at build
time; never put credentials in them.

Vercel supplies the trusted client-IP header automatically. On another reverse
proxy, set `RATE_LIMIT_IP_HEADER` only to a header that the proxy overwrites with
the client's IP. Without a trusted header, requests share one quota.

After deployment, open `/api/avatars?v=5` and
`/api/avatar?v=5&collection=open-bot-avatar&avatar=mug`, then copy an endpoint
and an editor share link to confirm their origin and selected avatar. A 503
means the server's Redis or image-asset diagnostics should be checked.

## Credits

Built by Lakshman Bhukya, using artwork and renderers from [Open Bot Avatar](https://github.com/DominikScholz/open-bot-avatar) and [Libraries.dev](https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/bot-avatars). The six first-party silhouettes are available under this project's MIT license.

[MIT license](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)
