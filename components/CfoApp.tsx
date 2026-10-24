"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { analyze, defaultDrivers, computePeriod, hasPriorPeriod } from "@/lib/finance/engine";
import { parseTrialBalance, toCsv, TEMPLATE_HEADER } from "@/lib/finance/parse";
import { SAMPLE_TB_CSV } from "@/lib/finance/sample";
import { CATEGORIES, type Category, type Drivers, type Issue, type ScenarioDrivers, type ScenarioName, type TBRow } from "@/lib/finance/types";
import type { Focus, Language } from "@/lib/ai/prompt";
import { makeT } from "@/lib/i18n";

const SCENARIOS: ScenarioName[] = ["base", "bull", "bear"];
const DRIVER_KEYS: (keyof Drivers)[] = ["revenueGrowth", "grossMargin", "opexPctRevenue", "financeCostChange", "taxRate"];

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CfoApp() {
  const [lang, setLang] = useState<Language>("en");
  const { t, category, line, issue } = useMemo(() => makeT(lang), [lang]);
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-EG";

  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<TBRow[]>([]);
  const [parseIssues, setParseIssues] = useState<Issue[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [currentLabel, setCurrentLabel] = useState("FY2025");
  const [priorLabel, setPriorLabel] = useState("FY2024");
  const [periodDays, setPeriodDays] = useState(365);
  const [drivers, setDrivers] = useState<ScenarioDrivers | null>(null);

  const [focus, setFocus] = useState<Focus>("all");
  const [aiText, setAiText] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    fetch("/api/explain")
      .then((r) => r.json())
      .then(setAiStatus)
      .catch(() => setAiStatus({ configured: false, model: "" }));
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
  const fmtMoney = (n: number) => `${fmt(n)} ${currency}`;
  const fmtPct = (n: number | null) => (n === null ? t("na") : `${n.toFixed(1)}%`);

  const analysis = useMemo(
    () => (rows.length ? analyze(rows, drivers ?? undefined, periodDays) : null),
    [rows, drivers, periodDays],
  );

  const loadText = (text: string) => {
    const res = parseTrialBalance(text);
    setRows(res.rows);
    setParseIssues(res.issues);
    setDrivers(null);
    setAiText("");
    setAiError("");
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const buf = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    // Arabic exports from older Windows ERPs are often Windows-1256 rather than UTF-8.
    if (text.includes("�")) text = new TextDecoder("windows-1256").decode(buf);
    setCsvText(text);
    loadText(text);
  };

  const setRowCategory = (i: number, value: string) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, category: value as Category | "", suggested: false } : r)));

  const resetDrivers = () => {
    if (!rows.length) return;
    const cur = computePeriod(rows, "current");
    setDrivers(defaultDrivers(cur, hasPriorPeriod(rows) ? computePeriod(rows, "prior") : null));
  };

  const setDriver = (s: ScenarioName, k: keyof Drivers, pct: number) => {
    if (!analysis || !Number.isFinite(pct)) return;
    const next = Object.fromEntries(SCENARIOS.map((name) => [name, { ...analysis.scenarios[name].drivers }])) as ScenarioDrivers;
    next[s][k] = pct / 100;
    setDrivers(next);
  };

  const explain = async () => {
    if (!analysis) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAiBusy(true);
    setAiText("");
    setAiError("");
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          rows,
          drivers: Object.fromEntries(SCENARIOS.map((s) => [s, analysis.scenarios[s].drivers])),
          companyName,
          currency,
          currentLabel,
          priorLabel,
          periodDays,
          language: lang,
          focus,
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "notConfigured") setAiStatus((s) => ({ model: s?.model ?? "", configured: false }));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiText((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setAiError(t("aiError", { message: (e as Error).message }));
    } finally {
      setAiBusy(false);
    }
  };

  const allIssues = [...parseIssues, ...(analysis?.issues ?? [])];
  const totals = analysis && {
    cd: analysis.current.totalDebits,
    cc: analysis.current.totalCredits,
    pd: analysis.prior?.totalDebits ?? 0,
    pc: analysis.prior?.totalCredits ?? 0,
  };

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>{t("appTitle")}</h1>
          <p className="muted">{t("appSubtitle")}</p>
        </div>
        <button className="ghost" onClick={() => setLang(lang === "en" ? "ar" : "en")}>
          {t("langToggle")}
        </button>
      </header>

      <section className="card">
        <h2>{t("step1")}</h2>
        <div className="grid4">
          <label>
            {t("company")}
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </label>
          <label>
            {t("currency")}
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["EGP", "USD", "EUR", "SAR", "AED", "GBP"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            {t("currentLabel")}
            <input value={currentLabel} onChange={(e) => setCurrentLabel(e.target.value)} />
          </label>
          <label>
            {t("priorLabel")}
            <input value={priorLabel} onChange={(e) => setPriorLabel(e.target.value)} />
          </label>
          <label>
            {t("periodDays")}
            <input
              type="number"
              min={1}
              max={366}
              value={periodDays}
              onChange={(e) => setPeriodDays(Math.min(366, Math.max(1, Number(e.target.value) || 365)))}
            />
          </label>
        </div>
        <p className="muted small">{t("pasteHint")}</p>
        <textarea
          dir="ltr"
          rows={8}
          value={csvText}
          placeholder={TEMPLATE_HEADER}
          onChange={(e) => setCsvText(e.target.value)}
        />
        <div className="actions">
          <button onClick={() => loadText(csvText)} disabled={!csvText.trim()}>
            {t("parse")}
          </button>
          <label className="button ghost">
            {t("uploadCsv")}
            <input type="file" accept=".csv,text/csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <button
            className="ghost"
            onClick={() => {
              setCsvText(SAMPLE_TB_CSV);
              setCompanyName("Nile Trading Co. (sample)");
              loadText(SAMPLE_TB_CSV);
            }}
          >
            {t("loadSample")}
          </button>
          <button className="ghost" onClick={() => download("trial-balance-template.csv", TEMPLATE_HEADER + "\n")}>
            {t("downloadTemplate")}
          </button>
          {rows.length > 0 && (
            <button className="ghost" onClick={() => download("trial-balance-mapped.csv", toCsv(rows))}>
              CSV ↓
            </button>
          )}
          <button
            className="ghost"
            onClick={() => {
              setCsvText("");
              loadText("");
              setParseIssues([]);
            }}
          >
            {t("clear")}
          </button>
        </div>
        {allIssues.length > 0 && (
          <ul className="issues">
            {allIssues.map((i, k) => (
              <li key={k} className={i.level}>
                {issue(i, fmt)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {analysis && (
        <section className="card">
          <h2>{t("step2")}</h2>
          <p className="muted small">
            {t("rowsLoaded", { count: rows.length })}
            {rows.some((r) => r.suggested) && (
              <button
                className="link"
                onClick={() => setRows((prev) => prev.map((r) => ({ ...r, suggested: false })))}
              >
                {t("confirmAll")}
              </button>
            )}
          </p>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("code")}</th>
                  <th>{t("name")}</th>
                  <th>{t("category")}</th>
                  <th className="num">{t("currentDebit")}</th>
                  <th className="num">{t("currentCredit")}</th>
                  <th className="num">{t("priorDebit")}</th>
                  <th className="num">{t("priorCredit")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.sourceRow}-${i}`} className={r.category === "" ? "unmapped" : ""}>
                    <td>{r.code}</td>
                    <td>{r.name}</td>
                    <td>
                      <select value={r.category} onChange={(e) => setRowCategory(i, e.target.value)}>
                        <option value="">{t("unmappedOption")}</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {category(c)}
                          </option>
                        ))}
                      </select>
                      {r.suggested && (
                        <button className="tag" title={t("confirm")} onClick={() => setRowCategory(i, r.category)}>
                          {t("suggestedTag")} ✓
                        </button>
                      )}
                    </td>
                    <td className="num">{fmt(r.currentDebit)}</td>
                    <td className="num">{fmt(r.currentCredit)}</td>
                    <td className="num">{fmt(r.priorDebit)}</td>
                    <td className="num">{fmt(r.priorCredit)}</td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot>
                  <tr>
                    <td colSpan={3}>{t("totals")}</td>
                    <td className="num">{fmt(totals.cd)}</td>
                    <td className="num">{fmt(totals.cc)}</td>
                    <td className="num">{fmt(totals.pd)}</td>
                    <td className="num">{fmt(totals.pc)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3}>{t("difference")}</td>
                    <td colSpan={2} className={`num ${Math.abs(totals.cd - totals.cc) > 0.005 ? "bad" : "good"}`}>
                      {fmt(totals.cd - totals.cc)}
                    </td>
                    <td colSpan={2} className={`num ${Math.abs(totals.pd - totals.pc) > 0.005 ? "bad" : "good"}`}>
                      {fmt(totals.pd - totals.pc)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}

      {analysis && !analysis.ready && <p className="banner error">{t("fixErrorsFirst")}</p>}

      {analysis?.ready && (
        <>
          <section className="card">
            <h2>{t("step3")}</h2>
            {(["PL", "BS"] as const).map((st) => (
              <div key={st} className="scroll">
                <h3>{st === "PL" ? t("incomeStatement") : t("balanceSheet")}</h3>
                <table>
                  <thead>
                    <tr>
                      <th>{t("line")}</th>
                      <th className="num">{currentLabel}</th>
                      <th className="num">{analysis.hasPrior ? priorLabel : t("notProvided")}</th>
                      <th className="num">{t("change")}</th>
                      <th className="num">{t("changePct")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.variances
                      .filter((v) => v.statement === st)
                      .filter((v) => v.key !== "unmappedHolding" || v.current !== 0 || (v.prior ?? 0) !== 0)
                      .map((v) => (
                        <tr key={v.key} className={v.key.startsWith("total") || ["grossProfit", "ebitda", "ebit", "ebt", "netProfit", "currentAssets", "nonCurrentAssets", "currentLiabilities", "nonCurrentLiabilities"].includes(v.key) ? "total" : ""}>
                          <td>
                            {line(v.key)} {v.material && <span className="pill">{t("material")}</span>}
                          </td>
                          <td className="num">{fmt(v.current)}</td>
                          <td className="num">{v.prior === null ? "—" : fmt(v.prior)}</td>
                          <td className={`num ${v.change !== null && v.change < 0 ? "neg" : ""}`}>
                            {v.change === null ? "—" : fmt(v.change)}
                          </td>
                          <td className="num">{v.changePct === null ? "—" : `${v.changePct.toFixed(1)}%`}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}
            <p className="muted small">
              {t("indicativeTax", {
                tax: fmtMoney(analysis.indicativeTax.tax),
                booked: fmtMoney(analysis.indicativeTax.booked),
              })}
            </p>
          </section>

          <section className="card">
            <h2>{t("step4")}</h2>
            <div className="ratios">
              {(["liquidity", "profitability", "efficiency", "leverage"] as const).map((g) => (
                <div key={g}>
                  <h3>{t(`group_${g}`)}</h3>
                  <table>
                    <tbody>
                      {analysis.ratios
                        .filter((r) => r.group === g)
                        .map((r) => {
                          const show = (v: number | null) =>
                            v === null ? t("na") : r.unit === "%" ? fmtPct(v) : r.unit === "days" ? `${v.toFixed(0)}` : `${v.toFixed(2)}×`;
                          return (
                            <tr key={r.key} title={r.formula}>
                              <td>{line(r.key)}</td>
                              <td className="num strong">{show(r.current)}</td>
                              <td className="num muted">{analysis.hasPrior ? show(r.prior) : "—"}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>{t("step5")}</h2>
            <p className="muted small">
              {t("assumptionsNote")}{" "}
              <button className="link" onClick={resetDrivers}>
                {t("resetDrivers")}
              </button>
            </p>
            <div className="scenarios">
              {SCENARIOS.map((s) => {
                const sc = analysis.scenarios[s];
                return (
                  <div key={s} className={`scenario ${s}`}>
                    <h3>{t(`scenario_${s}`)}</h3>
                    {DRIVER_KEYS.map((k) => (
                      <label key={k} className="driver">
                        <span>{t(`driver_${k}`)}</span>
                        <input
                          type="number"
                          step="0.5"
                          value={Math.round(sc.drivers[k] * 10000) / 100}
                          onChange={(e) => setDriver(s, k, Number(e.target.value))}
                        />
                      </label>
                    ))}
                    <table>
                      <thead>
                        <tr>
                          <th>{t("year")}</th>
                          <th className="num">{t("fc_revenue")}</th>
                          <th className="num">{t("fc_netProfit")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sc.years.map((y) => (
                          <tr key={y.year} title={`${t("fc_ebitda")}: ${fmt(y.ebitda)} · ${t("fc_ebt")}: ${fmt(y.ebt)}`}>
                            <td>+{y.year}</td>
                            <td className="num">{fmt(y.revenue)}</td>
                            <td className={`num ${y.netProfit < 0 ? "neg" : ""}`}>{fmt(y.netProfit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card">
            <h2>{t("step6")}</h2>
            {aiStatus && !aiStatus.configured && <p className="banner warning">{t("aiNotConfigured")}</p>}
            <div className="actions">
              <label>
                {t("focus")}{" "}
                <select value={focus} onChange={(e) => setFocus(e.target.value as Focus)}>
                  {(["all", "variances", "ratios", "forecast"] as const).map((f) => (
                    <option key={f} value={f}>
                      {t(`focus_${f}`)}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={explain} disabled={aiBusy || aiStatus?.configured === false}>
                {aiBusy ? t("explaining") : t("explain")}
              </button>
              {aiBusy && (
                <button className="ghost" onClick={() => abortRef.current?.abort()}>
                  {t("stop")}
                </button>
              )}
              {aiStatus?.model && (
                <span className="muted small">
                  {t("model")}: {aiStatus.model}
                </span>
              )}
            </div>
            {aiError && <p className="banner error">{aiError}</p>}
            {aiText && <div className="ai-output">{aiText}</div>}
            <p className="muted small">{t("aiDisclaimer")}</p>
          </section>
        </>
      )}

      <footer className="muted small">{t("footer")}</footer>
    </div>
  );
}
