import "./style.css";
import "@fontsource-variable/geist";
import "@fontsource/geist-mono/400.css";
import "./studio/studio.css";
import "./studio/site.css";
import "./studio/api.css";

export const metadata = {
  metadataBase: new URL(
    process.env.SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"),
  ),
  title: "OpenBot Avatars API",
  description:
    "Choose from 41 bot avatar designs, copy an image URL, and use it in your app. Repeatable seeds, PNG and SVG images, and no API key required.",
  openGraph: {
    title: "OpenBot Avatars API",
    description:
      "Bot avatars for your app. Choose a design or use a repeatable seed, then copy its image URL. No API key required.",
    siteName: "OpenBot Avatars API",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
