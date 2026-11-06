"use client";
// Console Builder — design any command console as JSON and try it live.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.

import { useEffect, useMemo, useRef, useState } from "react";
import { Terminal, type TerminalApi } from "@/components/Terminal";
import { Banner, Card, Page, download } from "@/components/ui";
import { buildFromSpec, parseSpec, type ConsoleSpec, type SpecContext } from "console-builder";
import { TEMPLATES } from "console-builder";
import { useL } from "@/lib/workspace/store";

const STORAGE = "console-builder.spec";

const toB64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
const pretty = (spec: unknown) => JSON.stringify(spec, null, 2);

function analyse(text: string): { spec: ConsoleSpec | null; errors: string[] } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { spec: null, errors: [`JSON: ${(e as Error).message}`] };
  }
  const r = parseSpec(json);
  if (!r.ok) return { spec: null, errors: r.errors };
  try {
    buildFromSpec(json as ConsoleSpec);
  } catch (e) {
    return { spec: null, errors: [(e as Error).message] };
  }
  return { spec: json as ConsoleSpec, errors: [] };
}

export default function ConsoleBuilderPage() {
  const L = useL();
  const [text, setText] = useState(() => pretty(TEMPLATES[0].spec));
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load from share link, then saved draft.
  useEffect(() => {
    const m = /#spec=([\w-]+)/.exec(window.location.hash);
    if (m) {
      try {
        setText(pretty(JSON.parse(fromB64(m[1]))));
        setNotice("Loaded console from the share link.");
        return;
      } catch {
        setNotice("The share link could not be read.");
      }
    }
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) setText(saved);
    } catch {
      /* storage blocked */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE, text);
      } catch {
        /* storage blocked */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [text]);

  const { spec, errors } = useMemo(() => analyse(text), [text]);
  const [lastGood, setLastGood] = useState<ConsoleSpec>(TEMPLATES[0].spec);
  useEffect(() => {
    if (spec) setLastGood(spec);
  }, [spec]);

  const cli = useMemo(() => buildFromSpec(lastGood), [lastGood]);
  const vars = useRef<Record<string, string>>({});
  useEffect(() => {
    vars.current = { ...(lastGood.vars ?? {}) };
  }, [lastGood]);

  const makeCtx = (api: TerminalApi): SpecContext => ({
    vars: vars.current,
    setVar: (name, value) => {
      if (value === null) delete vars.current[name];
      else vars.current[name] = value;
    },
    clear: api.clear,
    open: (url) => window.open(url, "_blank", "noopener,noreferrer"),
    fetch: (url, init) => fetch(url, init),
    history: api.history,
  });

  const share = async () => {
    const url = `${location.origin}${location.pathname}#spec=${toB64(JSON.stringify(JSON.parse(text)))}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Share link copied to the clipboard.");
    } catch {
      setNotice(url);
    }
  };

  const importFile = async (f: File | undefined) => {
    if (!f) return;
    setText(pretty(JSON.parse(await f.text())));
    setNotice(`Imported ${f.name}.`);
  };

  return (
    <Page
      title={L("Console builder", "منشئ وحدات التحكم")}
      subtitle={L(
        "Design any command console as JSON — commands, arguments, variables, calculations, HTTP calls and macros — and try it live. Prepared by Sara Salem © 2026.",
        "صمّم أي وحدة أوامر بصيغة JSON وجرّبها مباشرة. إعداد سارة سالم © 2026.",
      )}
    >
      {notice && <Banner kind="info">{notice}</Banner>}
      <Card title={L("Start from a template", "ابدأ من قالب")}>
        <div className="cb-templates">
          {TEMPLATES.map((t) => (
            <button key={t.id} className="ghost" title={t.description} onClick={() => (setText(pretty(t.spec)), setNotice(`${t.title}: ${t.description}`))}>
              {t.title}
            </button>
          ))}
        </div>
      </Card>
      <div className="cb-grid">
        <Card
          title={L("Console spec (JSON)", "مواصفات الوحدة (JSON)")}
          actions={
            <>
              <button className="ghost" onClick={() => spec && setText(pretty(spec))} disabled={!spec}>
                {L("Format", "تنسيق")}
              </button>
              <button className="ghost" onClick={() => download(`${lastGood.name}.console.json`, text, "application/json")}>
                {L("Export", "تصدير")}
              </button>
              <button className="ghost" onClick={() => fileRef.current?.click()}>
                {L("Import", "استيراد")}
              </button>
              <button className="ghost" onClick={share} disabled={!spec}>
                {L("Share link", "رابط مشاركة")}
              </button>
              <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => importFile(e.target.files?.[0]).catch((err) => setNotice(`Import failed: ${err.message}`))} />
            </>
          }
        >
          <textarea className="cb-editor" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="Console spec JSON" />
          {errors.length > 0 ? (
            <ul className="cb-errors">
              {errors.slice(0, 8).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : (
            <p className="muted small">✓ {L("Valid — the preview is live.", "صالحة — المعاينة مباشرة.")}</p>
          )}
        </Card>
        <div>
          <Terminal<SpecContext> cli={cli} makeCtx={makeCtx} title={lastGood.name} subtitle={errors.length ? "showing last valid version" : "live preview"} welcome={lastGood.welcome} prompt={lastGood.prompt} theme={lastGood.theme} historyKey={`console-builder.history.${lastGood.name}`} autoFocus={false} />
        </div>
      </div>
      <Card title={L("Commands in this console", "أوامر هذه الوحدة")}>
        <table>
          <thead>
            <tr>
              <th>{L("Usage", "الاستخدام")}</th>
              <th>{L("Description", "الوصف")}</th>
            </tr>
          </thead>
          <tbody>
            {cli.commands().map((c) => (
              <tr key={c.path.join(" ")}>
                <td>
                  <code>{cli.usage(c)}</code>
                </td>
                <td>{c.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title={L("Spec reference", "مرجع المواصفات")}>
        <ul className="small">
          <li>
            <code>commands[].name</code> — one or more words (<code>deploy app</code>). <code>args</code>: <code>{"{ name, type: string|number|boolean|enum, positional, required, rest, alias, choices, default }"}</code>.
          </li>
          <li>
            Text uses <code>{"{arg}"}</code> for arguments and <code>{"{$var}"}</code> for variables. Top-level <code>vars</code> sets initial variables.
          </li>
          <li>
            Actions: <code>print</code>, <code>table</code>, <code>kv</code>, <code>calc</code> (safe arithmetic, <code>saveAs</code>), <code>set</code>, <code>http</code> (GET/POST JSON, <code>pick</code>, <code>as: table|kv|json|text</code>), <code>open</code>, <code>run</code> (macro of other commands), <code>choice</code>, <code>date</code>.
          </li>
          <li>
            Built in to every console: <code>help</code>, <code>clear</code>, <code>echo</code>, <code>set</code>, <code>unset</code>, <code>vars</code>, <code>calc</code>, <code>history</code>. Chain with <code>&amp;&amp;</code> (stop on error) or <code>;</code>.
          </li>
          <li>
            <code>theme</code>: <code>{"{ background, foreground, accent }"}</code>; <code>welcome</code> and <code>prompt</code> customise the terminal.
          </li>
        </ul>
      </Card>
    </Page>
  );
}
