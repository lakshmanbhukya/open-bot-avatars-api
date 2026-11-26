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

## Credits

Built by Lakshman Bhukya, using artwork and renderers from [Open Bot Avatar](https://github.com/DominikScholz/open-bot-avatar) and [Libraries.dev](https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/bot-avatars). The six first-party silhouettes are available under this project's MIT license.

[MIT license](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)
