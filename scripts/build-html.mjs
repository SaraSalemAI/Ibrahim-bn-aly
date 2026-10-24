// Builds dist/ai-cfo.html: the whole client app in one self-contained file (React 18 from cdnjs).
// Server features (AI, Excel export, .xlsx conversion) are unavailable there and say so.
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shim = (f) => resolve(root, "html/shims", f);

const result = await build({
  entryPoints: [resolve(root, "html/entry.tsx")],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: "es2020",
  minify: true,
  jsx: "automatic",
  tsconfig: resolve(root, "tsconfig.json"),
  alias: {
    "next/link": shim("link.tsx"),
    "next/navigation": shim("navigation.ts"),
    "react/jsx-runtime": shim("jsx-runtime.js"),
    "react/jsx-dev-runtime": shim("jsx-runtime.js"),
    "react-dom/client": shim("react-dom-client.js"),
    react: shim("react.js"),
  },
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_STATIC_HTML": '"1"' },
  legalComments: "none",
  logLevel: "warning",
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync(resolve(root, "app/globals.css"), "utf8");

const html = `<title>AI CFO Financial Intelligence</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Trial balance to statements, models, Egyptian tax, valuation and board pack, in English and Arabic.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Amiri:wght@400;700&display=swap">
<style>
${css}
.offline-note { background: var(--info-bg); color: var(--info); font-size: 0.82rem; padding-block: 6px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.boot { padding: 40px max(16px, env(safe-area-inset-left, 0px)); color: var(--muted); }
</style>
<div class="offline-note" id="offline-note">HTML version: all calculations run in your browser and your data stays in it. AI explanations, the AI agent, Excel export and .xlsx upload need the full app with AI Gateway. · نسخة HTML: كل الحسابات تتم في متصفحك. الذكاء الاصطناعي وتصدير Excel ورفع xlsx تتطلب التطبيق الكامل.</div>
<div id="root"><p class="boot">Loading AI CFO…</p></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;

mkdirSync(resolve(root, "dist"), { recursive: true });
writeFileSync(resolve(root, "dist/ai-cfo.html"), html);
console.log(`dist/ai-cfo.html ${(html.length / 1024).toFixed(0)} KB`);
