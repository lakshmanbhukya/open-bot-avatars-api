<p><img src="docs/open-bot-avatars-api.png" width="100%" alt="OpenBot Avatars API preview"></p>

# OpenBot Avatars API

Bot avatars for profile pictures, chat interfaces, and apps. Open source, MIT licensed. No API key required.

- **41 designs** from Open Bot Avatar and Libraries.dev.
- **Transparent PNGs**, repeatable seeds, and reusable image URLs.
- **Live editor** with animation, colors, moods, and PNG/SVG downloads from [Open Bot Avatar](https://github.com/DominikScholz/open-bot-avatar) 

<p><img src="docs/look01.png" width="100%" alt="OpenBot Avatars API homepage showing a green plush flower avatar and an API request example"></p>

## Use an avatar

```html
<img src="https://open-bot-avatars-api.vercel.app/api/avatar?v=3" width="64" height="64" alt="Bot avatar">
```

The [hosted API](https://open-bot-avatars-api.vercel.app/) returns a transparent 512 × 512 PNG, ready to use in your app.

| Endpoint | Result |
| --- | --- |
| `/api/avatar` | Random avatar. |
| `/api/avatar?v=3&seed=user-42` | Repeatable avatar for a public seed. |
| `/api/avatar?collection=open-bot-avatar&avatar=mug` | A specific design. |
| `/api/avatars` | Full catalog and image URLs. |

Save the response's `Content-Location` URL to keep the same avatar. Open Bot designs also support `format=svg`; Libraries.dev supports `style=original` for plush PNGs. Hosted images use fixed poses and original colors; editor changes apply to the live preview.

## Development

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000) to browse avatars, try the editor, and read the API docs.

```sh
npm test
npm run build
npm start
```

For deployment, set `SITE_URL` to your public origin before building. Vercel detects its production domain automatically. Include the `public` directory with your deployment.

Both API endpoints share a limit of **180 requests per minute per client IP**. Excess requests return `429` with `Retry-After`. On Vercel, configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for a shared limiter; missing credentials or a store outage return `503`. Local development uses a bounded in-memory limiter. See [.env.example](.env.example). Only trust IP headers overwritten by your hosting platform. Cached images and static assets do not consume the function quota; use Vercel Firewall for traffic protection before requests reach the app.

## Credits

Built by Lakshman Bhukya, using artwork and renderers from [Open Bot Avatar](https://github.com/DominikScholz/open-bot-avatar) and [Libraries.dev](https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/bot-avatars).

[MIT license](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)
