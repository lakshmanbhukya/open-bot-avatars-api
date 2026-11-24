"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BotAvatar } from "./BotAvatar";
import dynamic from "next/dynamic";
import { href, useRoute, type Route } from "./navigation";
import { usePrefersReducedMotion, useStoredState } from "./studio/hooks";
import { DEFAULT_LOOK, reviveLook } from "./studio/look";
import { LOGO, LOGO_COLOR } from "./logo";
import { Api } from "./Api";

const loading = () => <main className="page" role="status">Loading…</main>;
const Studio = dynamic(() => import("./Studio").then(module => module.Studio), { loading });

const GITHUB_URL = "https://github.com/lakshmanbhukya/open-bot-avatars-api";

const NAV: { route: Route; label: string }[] = [
  { route: "api", label: "API" },
  { route: "studio", label: "Editor" },
  { route: "docs", label: "Docs" },
];

export function App({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const route = useRoute();
  const [visited, setVisited] = useState({ api: route === "api", studio: route === "studio" });
  const content = useRef<HTMLDivElement>(null);
  const previousRoute = useRef(route);
  useEffect(() => {
    if (!["/", "/editor", "/docs"].includes(pathname)) return;
    setVisited(previous => ({ ...previous, [route]: true }));
    document.title = route === "api" ? "OpenBot Avatars API" : `${route === "studio" ? "Avatar editor" : "API docs"} | OpenBot Avatars API`;
    if (previousRoute.current !== route) content.current?.focus({ preventScroll: true });
    previousRoute.current = route;
  }, [route, pathname]);
  const reducedMotion = usePrefersReducedMotion();
  const [look, setLook, lookReady] = useStoredState(
    "open-bot-avatar:look",
    DEFAULT_LOOK,
    reviveLook,
  );
  if (!["/", "/editor", "/docs"].includes(pathname)) return children;
  return (
    <div className={`avatar-studio route-${route}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-top">
        <Link
          className="brand"
          href={href.api}
          aria-label="OpenBot Avatars API, home"
        >
          <BotAvatar
            className="avatar-view brand-avatar"
            definition={LOGO}
            color={LOGO_COLOR}
            followPointer={!reducedMotion}
            reducedMotion={reducedMotion}
            label=""
          />
          <span className="brand-name">OpenBot Avatars API</span>
        </Link>
        <nav className="site-nav" aria-label="Site">
          {NAV.map((n) => (
            <Link
              key={n.route}
              href={href[n.route]}
              aria-current={route === n.route ? "page" : undefined}
            >
              {n.label}
            </Link>
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
      <div id="main-content" className="site-content" tabIndex={-1} ref={content}>
        <div hidden={route !== "api"}>{(visited.api || route === "api") && <Api active={route === "api"} />}</div>
        <div hidden={route !== "studio"}>{(visited.studio || route === "studio") && (lookReady ? <Studio look={look} setLook={setLook} active={route === "studio"} /> : loading())}</div>
        {route === "docs" && children}
      </div>
      <footer className="credit">
        <span>by Lakshman Bhukya</span>
        <a href="/license">Credits &amp; licenses</a>
      </footer>
    </div>
  );
}
