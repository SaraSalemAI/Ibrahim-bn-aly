import { useSyncExternalStore } from "react";

/**
 * In-page router for the single-file HTML build. The artifact viewer only passes plain `#token`
 * hashes, so a route is stored in memory and mirrored to `#token` (e.g. #statements) for bookmarks.
 */
export interface Route {
  path: string;
  query: string;
}

const listeners = new Set<() => void>();

function fromHash(): Route {
  try {
    const token = location.hash.replace(/^#/, "");
    if (/^[A-Za-z0-9._~-]+$/.test(token)) return { path: token === "overview" ? "/" : `/${token}`, query: "" };
  } catch {
    /* no location in this context */
  }
  return { path: "/", query: "" };
}

let current: Route = typeof window === "undefined" ? { path: "/", query: "" } : fromHash();

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    const next = fromHash();
    if (next.path !== current.path) {
      current = next;
      listeners.forEach((l) => l());
    }
  });
}

export function navigate(href: string) {
  const [path, query = ""] = href.split("?");
  current = { path: path || "/", query };
  try {
    history.replaceState(null, "", path === "/" ? "#overview" : `#${path.replace(/^\//, "")}`);
  } catch {
    /* history unavailable: the route still changes in memory */
  }
  window.scrollTo?.(0, 0);
  listeners.forEach((l) => l());
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}
