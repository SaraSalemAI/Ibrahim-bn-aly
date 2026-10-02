# Claude Mastery platform — project memory

Bilingual (Arabic/English) Claude training platform by Dr. Sara Salem. Output is ONE self-contained HTML file published as a claude.ai artifact.

## Build & test
- Build: `bash build.sh` → writes `out.html` and `check.js`, runs `node --check`.
- Smoke test (needs Playwright): `python3 t10.py` → must print `[]` (no page errors).
- PDFs: `python3 pdf2.py` (renders `#print/ar|en` and `#printmp/ar|en`), then re-encode into `pdf_AR.js`, `pdf_EN.js`, `pdfmp.js`.
- Deck: `node deck.js` → `Claude-Mastery-Deck.pptx`, then re-encode into `pptx.js`.

## Structure (concatenation order matters — see build.sh)
- Data: d1/d2/d3 (modules), extra.js, pe.js, masters.js (lessons + master prompts), deep.js, agentic.js, integ.js, playbook.js, agent.js, mcpsec.js (deep dives), cases.js, cases2.js, cases3.js (use-case library), lab.js + data.js (lab + dummy data), skills.js, work.js, workfull.js, more.js (refs, glossary, curriculum features), feat_data.js (quiz, CEO notes, simulator).
- UI: labview.js, features.js, tools.js, assist.js, app.js (router + views). CSS: head.html + extra.css + ui2–ui4.css.
- packs2.js: Prompt packs tab inside Lab & Studio (basket, 📦 on prompt cards, filtered/starter exports, JSON/MD/PDF, import preview + dedupe, quality scores).
- community2.js: References page (Anthropic community + official sources), #community hub (checklist, MENA spotlight, share your work), lesson 8.2 + quiz question. COMMUNITY data is in mcpsec.js.
- Helpers: `T(en,ar)`, `MPen/MPar` (six-block master prompt), `CM(...)` (case with master prompt).

## Rules
- ALWAYS keep every string bilingual via `T(en, ar)`; Arabic in Egyptian dialect for explanations.
- ALWAYS keep the page under 16,000,000 bytes (embedded PDFs are the big part; the image gallery was removed).
- NEVER use browser APIs not allowed on published pages; runtime capabilities used: `downloads`, `sample`.
- NEVER invent Claude features; date-sensitive facts are "as of Sept 2026".
- Test every route in both languages and both themes before publishing.
