import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation.js";

export const REPO = "https://github.com/DominikScholz/open-bot-avatar";

export type Route = "studio" | "docs" | "api";

const ROUTES: Record<string, Route> = { "": "api", "#/": "studio", "#/docs": "docs", "#/api": "api" };

export function readRoute(hash: string, search: string, pathname = "/"): Route {
  if (pathname === "/editor") return "studio";
  if (pathname === "/docs") return "docs";
  const params = new URLSearchParams(search);
  if (!hash && !params.has("collection") && (params.has("avatar") || params.has("def"))) return "studio";
  return ROUTES[hash] ?? "api";
}

/** Preserve older hash links while using normal paths for new navigation. */
export function useRoute(): Route {
  const pathname = usePathname();
  const router = useRouter();
  const [legacy, setLegacy] = useState<Route | null>(null);
  useEffect(() => {
    const onChange = () => {
      const { hash, search } = window.location;
      if ((Object.hasOwn(ROUTES, hash) && hash !== "") || (pathname === "/" && !hash && readRoute(hash, search) === "studio")) {
        const route = readRoute(hash, search);
        setLegacy(route);
        router.replace(`${href[route]}${search}`, { scroll: true });
      }
    };
    setLegacy(null);
    onChange();
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, [pathname, router]);
  return legacy ?? readRoute("", "", pathname);
}

export const href: Record<Route, string> = { studio: "/editor", docs: "/docs", api: "/" };
