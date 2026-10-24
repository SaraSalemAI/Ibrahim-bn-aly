/** True in the single-file HTML build (scripts/build-html.mjs), where there is no server and downloads are blocked. */
export const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_HTML === "1";
