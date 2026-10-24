"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FootballField, Waterfall } from "@/components/charts";
import { Markdown } from "@/components/Markdown";
import { payloadCompany } from "@/components/AiPanel";
import { makeT } from "@/lib/i18n";
import { TOTAL_LINES } from "@/lib/labels";
import { useWorkspace } from "@/lib/workspace/store";

function Pack() {
  const params = useSearchParams();
  const lang = params.get("lang") === "ar" ? "ar" : "en";
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const { company, computed, loaded } = useWorkspace();
  const { line } = makeT(lang);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const nf = new Intl.NumberFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-EG", { maximumFractionDigits: 0 });
  const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : nf.format(v));
  const compact = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}m` : n(v));

  if (!loaded) return <p>…</p>;
  const a = computed?.analysis;
  if (!company || !computed || !a) return <p style={{ padding: 24 }}>{L("Load a company with a trial balance first.", "حمّل شركة بميزان مراجعة أولًا.")}</p>;
  const name = (lang === "ar" && company.settings.tradeNameAr) || company.settings.tradeNameEn;
  const ccy = company.settings.presentationCurrency;

  const genSummary = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: "overview", language: lang, company: payloadCompany(company, "overview") }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).message ?? `HTTP ${res.status}`);
      setSummary(await res.text());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const stmt = (s: "PL" | "BS") => (
    <table>
      <thead>
        <tr>
          <th />
          <th className="num">{company.period.currentLabel}</th>
          {a.hasPrior && <th className="num">{company.period.priorLabel}</th>}
        </tr>
      </thead>
      <tbody>
        {a.variances
          .filter((v) => v.statement === s && (v.key !== "unmappedHolding" || v.current !== 0))
          .map((v) => (
            <tr key={v.key} className={TOTAL_LINES.has(v.key) ? "total" : ""}>
              <td>{line(v.key)}</td>
              <td className="num">{n(v.current)}</td>
              {a.hasPrior && <td className="num">{n(v.prior)}</td>}
            </tr>
          ))}
      </tbody>
    </table>
  );

  return (
    <div className="pack" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <div className="no-print pack-toolbar">
        <button onClick={() => window.print()}>{L("Print / Save as PDF", "طباعة / حفظ PDF")}</button>
        <button className="ghost" disabled={busy} onClick={genSummary}>
          {busy ? L("Writing…", "جارٍ الكتابة…") : L("Add AI executive commentary", "إضافة تعليق تنفيذي بالذكاء الاصطناعي")}
        </button>
        {err && <span className="bad small">{err}</span>}
      </div>

      <section className="pack-page cover">
        <h1>{name}</h1>
        <h2>{L("Board financial pack", "حزمة مجلس الإدارة المالية")}</h2>
        <p>
          {company.period.currentLabel} · {company.settings.framework} · {ccy}
        </p>
        <p className="muted">{L("Prepared", "تاريخ الإعداد")}: {new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB")} · {L("Period status", "حالة الفترة")}: {company.period.status}</p>
      </section>

      <section className="pack-page">
        <h2>{L("Executive summary", "الملخص التنفيذي")}</h2>
        <div className="stats">
          {(
            [
              [L("Revenue", "الإيرادات"), a.current.revenue],
              ["EBITDA", a.current.ebitda],
              [L("Net profit", "صافي الربح"), a.current.netProfit],
              [L("Cash", "النقدية"), a.current.cash],
              [L("Total equity", "حقوق الملكية"), a.current.totalEquity],
            ] as const
          ).map(([k, v]) => (
            <div className="stat" key={k}>
              <div className="stat-label">{k}</div>
              <div className="stat-value">{n(v)}</div>
            </div>
          ))}
        </div>
        {summary ? <Markdown text={summary} /> : <p className="muted">{L("Key movements:", "أهم التغيرات:")} {a.variances.filter((v) => v.material).map((v) => `${line(v.key)} ${v.changePct === null ? "" : `${v.changePct > 0 ? "+" : ""}${v.changePct}%`}`).join(" · ") || "—"}</p>}
        {summary && <p className="muted small">{L("Commentary drafted by AI from the figures in this pack; reviewed by management.", "تعليق أعده الذكاء الاصطناعي من أرقام هذه الحزمة؛ تتم مراجعته من الإدارة.")}</p>}
      </section>

      <section className="pack-page">
        <h2>{L("Income statement", "قائمة الدخل")}</h2>
        {stmt("PL")}
      </section>
      <section className="pack-page">
        <h2>{L("Statement of financial position", "قائمة المركز المالي")}</h2>
        {stmt("BS")}
      </section>

      {computed.cashFlow && (
        <section className="pack-page">
          <h2>{L("Cash flow bridge", "جسر التدفقات النقدية")}</h2>
          <Waterfall
            format={compact}
            items={[
              { label: L("Opening cash", "نقدية أول المدة"), value: computed.cashFlow.beginningCash, total: true },
              { label: L("Operating", "التشغيلية"), value: computed.cashFlow.operating },
              { label: L("Investing", "الاستثمارية"), value: computed.cashFlow.investing },
              { label: L("Financing", "التمويلية"), value: computed.cashFlow.financing },
              { label: L("Ending cash", "نقدية آخر المدة"), value: computed.cashFlow.endingCashPerCashFlow, total: true },
            ]}
          />
        </section>
      )}

      <section className="pack-page">
        <h2>{L("Ratios and DuPont", "النسب ودوبونت")}</h2>
        <table>
          <tbody>
            {a.ratios.map((r) => (
              <tr key={r.key}>
                <td>{line(r.key)}</td>
                <td className="num">{r.current === null ? "—" : r.unit === "%" ? `${r.current.toFixed(1)}%` : r.unit === "days" ? r.current.toFixed(0) : `${r.current.toFixed(2)}×`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          ROE = {L("net margin", "هامش الربح")} {((computed.dupont.threeStep.netMargin ?? 0) * 100).toFixed(1)}% × {L("asset turnover", "دوران الأصول")} {(computed.dupont.threeStep.assetTurnover ?? 0).toFixed(2)} × {L("equity multiplier", "مضاعف حقوق الملكية")} {(computed.dupont.threeStep.equityMultiplier ?? 0).toFixed(2)} = {((computed.dupont.threeStep.roe ?? 0) * 100).toFixed(1)}% · Altman Z'' {computed.altman.z ?? "—"} ({computed.altman.zone ?? "—"})
        </p>
      </section>

      <section className="pack-page">
        <h2>{L("Scenarios (final projected period)", "السيناريوهات (آخر فترة متوقعة)")}</h2>
        <table>
          <thead>
            <tr>
              <th />
              <th className="num">{L("Base", "الأساسي")}</th>
              <th className="num">{L("Bull", "المتفائل")}</th>
              <th className="num">{L("Bear", "المتحفظ")}</th>
            </tr>
          </thead>
          <tbody>
            {(["revenue", "ebitda", "netProfit", "cash"] as const).map((k) => (
              <tr key={k}>
                <td>{{ revenue: L("Revenue", "الإيرادات"), ebitda: "EBITDA", netProfit: L("Net profit", "صافي الربح"), cash: L("Cash", "النقدية") }[k]}</td>
                {(["base", "bull", "bear"] as const).map((s) => (
                  <td key={s} className="num">{n(computed.scenarios[s].periods.at(-1)![k])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {computed.valuation.footballField.length > 0 && (
          <>
            <h3>{L("Valuation ranges (equity value)", "نطاقات التقييم (قيمة حقوق الملكية)")}</h3>
            <FootballField bars={computed.valuation.footballField} format={compact} />
          </>
        )}
      </section>

      <section className="pack-page">
        <h2>{L("Tax summary", "ملخص الضريبة")}</h2>
        <p>
          {L("Taxable profit", "الربح الضريبي")} {n(computed.tax.taxableProfit)} · {L("tax", "الضريبة")} {n(computed.tax.tax)} · {L("payable", "المستحق")} {n(computed.tax.payable)} · {L("deferred tax", "الضريبة المؤجلة")} {computed.tax.deferredTax.position} {n(Math.abs(computed.tax.deferredTax.net))}
        </p>
        <h2>{L("Notes to the financial statements", "الإيضاحات المتممة")}</h2>
        {computed.notes.map((nt, i) => (
          <div key={nt.id} className="pack-note">
            <h4>
              {i + 1}. {lang === "ar" ? nt.title[1] : nt.title[0]}
            </h4>
            <p>{company.disclosures[nt.id]?.override ?? nt.body({ ...computed.noteCtx, fmt: n }, lang)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

export default function BoardPackPage() {
  return (
    <Suspense fallback={<p>…</p>}>
      <Pack />
    </Suspense>
  );
}
