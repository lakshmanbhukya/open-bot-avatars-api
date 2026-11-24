import { readFile } from "node:fs/promises";
import path from "node:path";

export const metadata = { title: "License and credits | OpenBot Avatars API" };

export default async function License() {
  const license = await readFile(path.join(process.cwd(), "LICENSE"), "utf8");
  const notices = await readFile(
    path.join(process.cwd(), "THIRD_PARTY_NOTICES.md"),
    "utf8",
  );
  return (
    <main className="legal">
      <header>
        <a href="/">OpenBot Avatars API</a>
      </header>
      <h1>License and credits</h1>
      <p>OpenBot Avatars API by Lakshman Bhukya.</p>
      <p>
        Artwork comes from{" "}
        <a href="https://github.com/DominikScholz/open-bot-avatar">
          Open Bot Avatar
        </a>{" "}
        and{" "}
        <a href="https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/bot-avatars">
          Libraries.dev Bot Avatars
        </a>
        .
      </p>
      <h2>Project license</h2>
      <pre>{license}</pre>
      <h2 id="third-party">Third-party notices</h2>
      <pre>{notices}</pre>
      <footer>
        <a href="/">Back to the avatar picker</a>
      </footer>
    </main>
  );
}
