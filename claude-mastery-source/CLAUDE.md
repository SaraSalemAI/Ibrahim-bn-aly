# Claude Mastery platform — project memory

Bilingual (Arabic/English) Claude training platform by Dr. Sara Salem. Output is ONE self-contained HTML file published as a claude.ai artifact.

## Build & test
- Build: `bash build.sh` → writes `out.html` and `check.js`, runs `node --check`.
- Smoke test (needs Playwright): `python3 t10.py` → must print `[]` (no page errors).
- PDFs: render `#print/ar` and `#printmp/ar` to PDF with Playwright (Readex Pro + Amiri must load — no Arabic system fonts here, so serve @fontsource files for fonts.googleapis.com), then base64 into `PDF_AR` (pdf_AR.js) and `PDF_MP_AR` (pdfmp.js). Only the Arabic PDFs are embedded.
- Deck: `npm i pptxgenjs@3.12.0` somewhere, `NODE_PATH=… DECK_OUT=… node deck.js`, then base64 into `PPTX_B64` (pptx.js).

## Structure (concatenation order matters — see build.sh)
- Data: d1/d2/d3 (modules), extra.js, pe.js, masters.js (lessons + master prompts), deep.js, agentic.js, integ.js, playbook.js, agent.js, mcpsec.js (deep dives), cases.js, cases2.js, cases3.js (use-case library), lab.js + data.js (lab + dummy data), skills.js, work.js, workfull.js, more.js (refs, glossary, curriculum features), feat_data.js (quiz, CEO notes, simulator).
- UI: labview.js, features.js, tools.js, assist.js, app.js (router + views). CSS: head.html + extra.css + ui2–ui4.css.
- packs2.js: Prompt packs tab inside Lab & Studio (basket, 📦 on prompt cards, filtered/starter exports, JSON/MD/PDF, import preview + dedupe, quality scores).
- community2.js: References page (Anthropic community + official sources), #community hub (checklist, MENA spotlight, share your work), lesson 8.2 + quiz question. COMMUNITY data is in mcpsec.js.
- features3.js: #rescue (prompt rescue game), "Explain like my manager" on lessons (sample), pack test with Claude + Skill-folder export in the packs tab, offline course pack on #export, #showcase wall (db collection `wall`, one doc per user id).
- curr4.js: Module 10 (Claude for Arabic content, 10.1–10.4 + QUIZ[10]), 1.9 Prompt failures clinic, 9.5 Claude for audit & compliance, extra quiz questions. Embedded PDFs predate these lessons.
- features4.js: #spot (spot the hallucination: 5 fixed rounds + Claude-generated rounds), #remix (adapt a lab prompt to another industry).
- features5.js: merged pages — Studio tabs (🛟 rescue game, 🎚 remix), #path + feature picker tabs, #sim (agent loop + case simulator + showcase wall tabs), #gallery = references + community hub + email alerts (db `alerts/{uid}`), "Check the output" checklist under every master prompt. Old routes (#rescue #remix #pick #csim #showcase #community #wb) redirect.
- curr5.js: 4.4 one job six tools, 9.6 Egypt & GCC regulations pack, Module 11 family business & SMEs + QUIZ[11], PROJECTS (one per module). `ENR()` enriches master prompts (market in role, language/currency, assumptions).
- fields1.js / fields2.js: FIELDLIB — 23 fields × daily/weekly/monthly/yearly master prompts + example outputs. fieldsview.js: #fields, #tracks (+ track certificate PNG), recipe-card PDF, #projects + project card on each module page (graded with sample). e2e.js: #e2e five end-to-end company cases.
- e2e2.js: 3 more company cases (finance, supply chain, business strategy). fgloss.js: FGLOSS 20 EN–AR terms per field. chains.js: CHAINS one 3-step prompt chain per field.
- features6.js: #prog = progress + achievement card + ROI tabs (#card #roi redirect); quiz page gets a 🔎 spot tab (#spot redirects); lesson page = sticky module TOC + lesson progress + reading bar; ⏱ Lesson in 60 seconds overlay; 🩺 Fix my real prompt Studio tab (sample); industry editions + glossary marks + chain on #fields; field booklet PDF (html2canvas foreignObjectRendering + jsPDF, page-sliced — foreignObject is required for correct Arabic shaping).
- e2e3.js / e2e4.js: company cases for the 17 remaining fields (E2E now covers all 23 fields + supply chain + business). dayinlife.js: DIL six-moment working day per field.
- features7.js: 6 more industry editions; day-in-the-life on #fields/#tracks; routes fields/<k>, tracks/<k>, e2e/<k>; 🕸 skills radar on #prog; 📓 module workbook PDF (modExportBar); home "Today" panel; wider search with type filters; #news = verified NEWS array (checked date) + owner-added items in db `news`; My work platform banner.
- safe.js (first in build): the published page runs in a sandboxed srcdoc iframe (origin 'null'), so `history.replaceState(null,'','#x')` throws and `<a href="#x">` navigates away (blank page). safe.js patches replaceState to use an absolute URL and routes hash links through `go()`. render() wraps renderInner() in an error boundary. Test in a sandboxed srcdoc iframe (tsand.py pattern), not only file://.
- Helpers: `T(en,ar)`, `MPen/MPar` (six-block master prompt), `CM(...)` (case with master prompt).

## Rules
- ALWAYS keep every string bilingual via `T(en, ar)`; Arabic in Egyptian dialect for explanations.
- ALWAYS keep the page under 16,000,000 bytes (embedded PDFs are the big part; the image gallery was removed).
- NEVER use browser APIs not allowed on published pages; runtime capabilities used: `downloads`, `sample`, `user` (profile), `db` (rules: `wall` read view / write owner, `wall/{self}` write interact; `alerts` read owner / write owner, `alerts/{self}` read+write interact; `news` read view / write owner) — restate all of them on any publish that passes `capabilities`.
- NEVER invent Claude features; date-sensitive facts are "as of Sept 2026".
- Test every route in both languages and both themes before publishing.
