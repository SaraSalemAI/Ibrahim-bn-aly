import { useRoute } from "../router";

/** Stand-ins for next/navigation backed by the in-page router. */
export function usePathname(): string {
  return useRoute().path;
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(useRoute().query);
}
