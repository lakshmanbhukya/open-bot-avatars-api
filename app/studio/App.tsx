"use client";

import { BotAvatar } from "./BotAvatar";
import dynamic from "next/dynamic";
import { href, useRoute, type Route } from "./navigation";
import { useStoredState } from "./studio/hooks";
import { DEFAULT_LOOK, reviveLook } from "./studio/look";
import { LOGO, LOGO_COLOR } from "./logo";
import { Api } from "./Api";

const loading = () => <main className="page" role="status">Loading?</main>;
const Studio = dynamic(() => import("./Studio").then(module => module.Studio), { loading });
const Docs = dynamic(() => import("./Docs").then(module => module.Docs), { loading });

const GITHUB_URL = "https://github.com/lakshmanbhukya/open-bot-avatars-api";

const NAV: { route: Route; label: string }[] = [
  { route: "api", label: "API" },
  { route: "studio", label: "Editor" },
  { route: "docs", label: "Docs" },
];

export function App() {
  const route = useRoute();
  const [look, setLook] = useStoredState(
    "open-bot-avatar:look",
    DEFAULT_LOOK,
    reviveLook,
  );
  return (
    <div className={`avatar-studio route-${route}`}>
      <header className="site-top">
        <a
          className="brand"
          href={href.api}
          aria-label="OpenBot Avatars API, home"
        >
          <BotAvatar
            className="avatar-view brand-avatar"
            definition={LOGO}
            color={LOGO_COLOR}
            followPointer
            label=""
          />
          <span className="brand-name">OpenBot Avatars API</span>
        </a>
        <nav className="site-nav" aria-label="Site">
          {NAV.map((n) => (
            <a
              key={n.route}
              href={href[n.route]}
              aria-current={route === n.route ? "page" : undefined}
            >
              {n.label}
            </a>
          ))}
          <a
            href={GITHUB_URL}
            className="nav-github"
            aria-label="GitHub repository"
            title="GitHub repository"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            <span>GitHub</span>
          </a>
        </nav>
      </header>
      {route === "studio" ? (
        <Studio look={look} setLook={setLook} />
      ) : route === "api" ? (
        <Api />
      ) : (
        <Docs />
      )}
      <footer className="credit">
        <span>by Lakshman Bhukya</span>
        <a href="/license">Credits &amp; licenses</a>
      </footer>
    </div>
  );
}
