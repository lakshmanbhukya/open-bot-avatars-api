import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "Your bot. Your style. Matching fluffy and flat avatars from OpenBot Avatars API v5.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function SocialImage() {
  const bots = await Promise.all(
    [
      ["open-bot-avatar", "controller-fluffy"],
      ["open-bot-avatar", "controller"],
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
        padding: "48px 64px",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: -4,
            lineHeight: 1.05,
          }}
        >
          Your bot. Your style.
        </div>
        <div style={{ fontSize: 26, color: "#b0b0b0", marginTop: 16 }}>
          Fluffy or flat. Customize it. Copy the image URL.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          width: "100%",
          gap: 24,
        }}
      >
        {bots.map((src, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
              background: "#1f1f1f",
              borderRadius: 24,
              padding: 16,
            }}
          >
            <img alt="" width={240} height={240} src={src} />
            <div style={{ fontSize: 22, color: "#ff6a1a", marginTop: 8 }}>
              {index === 0 ? "Fluffy" : "Flat"}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          fontSize: 22,
          color: "#9a9a9a",
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: 5, background: "#ff6a1a", marginRight: 12 }} />
        OpenBot Avatars API · v5
      </div>
    </div>,
    size,
  );
}
