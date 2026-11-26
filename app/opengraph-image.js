import catalog from "./lib/catalogs/v5.json";
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "OpenBot Avatars API by Lakshman Bhukya. GET /api/avatar.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function SocialImage() {
  const bots = await Promise.all(
    [
      ["open-bot-avatar", "controller"],
      ["bot-avatars", "clover"],
      ["open-bot-avatar", "chat"],
    ].map(
      async ([collection, id]) =>
        "data:image/png;base64," +
        (
          await readFile(
            path.join(
              process.cwd(),
              "public/avatars/v5",
              collection,
              id + ".png",
            ),
          )
        ).toString("base64"),
    ),
  );
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#111111",
        color: "#f2f2f2",
        padding: 64,
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: 650 }}>
        <div style={{ fontSize: 28, color: "#ff6a1a", marginBottom: 36 }}>
          OpenBot Avatars API
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: -4,
            lineHeight: 1.05,
          }}
        >
          <span>Make it yours.</span>
          <span>One image URL.</span>
        </div>
        <div style={{ fontSize: 26, color: "#9a9a9a", marginTop: 28 }}>
          {`Live editor. ${catalog.length} original designs. Image API.`}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            marginTop: 36,
            color: "#ff6a1a",
          }}
        >
          GET /api/avatar
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 400,
          background: "#1f1f1f",
          borderRadius: 40,
          padding: 16,
        }}
      >
        {bots.map((src, index) => (
          <img key={index} alt="" width={144} height={144} src={src} />
        ))}
      </div>
    </div>,
    size,
  );
}
