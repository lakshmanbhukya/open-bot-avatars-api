import { useEffect, useState } from "react";

export const REPO = "https://github.com/DominikScholz/open-bot-avatar";

export type Route = "studio" | "docs" | "api";

const ROUTES: Record<string, Route> = { "": "api", "#/": "studio", "#/docs": "docs", "#/api": "api" };

export function readRoute(hash: string, search: string): Route {
  const params = new URLSearchParams(search);
  if (!hash && !params.has("collection") && (params.has("avatar") || params.has("def"))) return "studio";
  return ROUTES[hash] ?? "api";
}

/** Hash routes keep editor and picker links on the same page. */
export function useRoute(): Route {
  const read = (): Route => readRoute(window.location.hash, window.location.search);
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      if (Object.hasOwn(ROUTES, window.location.hash)) window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const href: Record<Route, string> = { studio: "#/", docs: "#/docs", api: "#/api" };
