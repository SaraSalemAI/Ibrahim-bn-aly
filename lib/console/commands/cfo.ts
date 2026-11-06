// AI CFO console — the concrete command set, built with ConsoleBuilder.
// Prepared by Sara Salem. Copyright (c) Sara Salem 2026.
//
// Commands only read the workspace and dispatch existing store actions, so every
// change still goes through the reducer (period lock, hash-chained audit log).

import { STATEMENT_LINES } from "../../finance/engine";
import { verifyAudit } from "../../finance/audit";
import { NAV } from "../../nav";
import { CHECK_LABELS } from "../../labels";
import { canAdvance, type Computed } from "../../workspace/compute";
import { sampleCompany } from "../../workspace/sampleCompany";
import type { Company, PeriodStatus, Workspace } from "../../workspace/types";
import { ConsoleBuilder, type BuiltConsole } from "../builder";
import { requireTag, roleGuard } from "../middleware";

type StoreAction =
  | { type: "setLang"; lang: "en" | "ar" }
  | { type: "selectCompany"; id: string }
  | { type: "addCompany"; company: Company };

export interface CfoContext {
  ws: Workspace;
  company: Company | null;
  computed: Computed | null;
  dispatch: (a: StoreAction) => void;
  /** Requests a period status change (goes through the store's audited update). */
  setPeriodStatus: (to: PeriodStatus) => void;
  navigate: (href: string) => void;
  clear: () => void;
}

const L = (ctx: CfoContext, en: string, ar: string) => (ctx.ws.lang === "ar" ? ar : en);
const nameOf = (ctx: CfoContext, c: Company) => (ctx.ws.lang === "ar" && c.settings.tradeNameAr) || c.settings.tradeNameEn;
const nf = new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 });
const num = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : nf.format(v));
const slug = (href: string) => href.replace(/^\//, "") || "home";
const humanize = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const ORDER: PeriodStatus[] = ["DRAFT", "MAPPED", "RECONCILED", "LOCKED"];

export function buildCfoConsole(): BuiltConsole<CfoContext> {
  return (
    new ConsoleBuilder<CfoContext>("ai-cfo")
      .use(roleGuard((ctx) => ctx.ws.profile.role))
      .use(requireTag("needs:company", (ctx) => !!ctx.company, (ctx) => L(ctx, "No active company. Run: company sample  or  company select <name>", "لا توجد شركة نشطة. نفّذ: company sample")))
      .use(requireTag("needs:data", (ctx) => !!ctx.computed?.analysis, (ctx) => L(ctx, "No trial balance loaded for this company. Run: go ingest", "لم يتم تحميل ميزان مراجعة. نفّذ: go ingest")))

      .command({ path: ["clear"], aliases: ["cls"], summary: "Clear the console", run: (_a, ctx) => ctx.clear() })

      .command({
        path: ["whoami"],
        summary: "Current user, role and language",
        run: (_a, ctx, io) => io.kv([["User", ctx.ws.profile.name], ["Role", ctx.ws.profile.role], ["Language", ctx.ws.lang], ["Companies", ctx.ws.companies.length]]),
      })

      .command({
        path: ["lang"],
        summary: "Switch interface language",
        args: [{ name: "language", type: "enum", choices: ["en", "ar"], positional: true, required: true }],
        examples: ["lang ar"],
        run: (a, ctx, io) => {
          ctx.dispatch({ type: "setLang", lang: a.language as "en" | "ar" });
          io.print(a.language === "ar" ? "تم التبديل إلى العربية" : "Switched to English", "ok");
        },
      })

      .command({
        path: ["modules"],
        aliases: ["ls"],
        summary: "List the 17 modules",
        run: (_a, ctx, io) => io.table(["#", "Key", "Module"], NAV.map((n) => [n.n, slug(n.href), L(ctx, n.en, n.ar)])),
      })

      .command({
        path: ["go"],
        aliases: ["open", "cd"],
        summary: "Open a module by key or number",
        args: [{ name: "module", type: "string", positional: true, required: true, description: "Key (e.g. tax) or number (1-18)", complete: () => ["home", ...NAV.map((n) => slug(n.href))] }],
        examples: ["go tax", "go 5"],
        run: (a, ctx, io) => {
          const q = String(a.module).toLowerCase();
          if (q === "home" || q === "/") {
            ctx.navigate("/");
            return;
          }
          const hit = NAV.find((n) => String(n.n) === q || slug(n.href) === q) ?? NAV.find((n) => slug(n.href).startsWith(q)) ?? NAV.find((n) => n.en.toLowerCase().includes(q) || n.ar.includes(q));
          if (!hit) return io.fail(`No module matches "${a.module}". Run: modules`);
          ctx.navigate(hit.href);
          io.print(`→ ${L(ctx, hit.en, hit.ar)}`, "muted");
        },
      })

      .group("company", "Companies in the workspace", (g) =>
        g
          .command({
            path: ["list"],
            summary: "List companies",
            run: (_a, ctx, io) => {
              if (!ctx.ws.companies.length) return io.print(L(ctx, "No companies yet. Run: company sample", "لا توجد شركات"), "muted");
              io.table(["", "Name", "Period", "Status", "Accounts"], ctx.ws.companies.map((c) => [c.id === ctx.ws.activeCompanyId ? "*" : "", nameOf(ctx, c), c.period.currentLabel, c.period.status, c.rows.length]));
            },
          })
          .command({
            path: ["select"],
            aliases: ["use"],
            summary: "Make a company active",
            args: [{ name: "name", type: "string", positional: true, required: true, rest: true, complete: (ctx: CfoContext) => ctx.ws.companies.map((c) => c.settings.tradeNameEn) }],
            run: (a, ctx, io) => {
              const q = String(a.name).toLowerCase();
              const matches = ctx.ws.companies.filter((c) => c.id === a.name || [c.settings.tradeNameEn, c.settings.tradeNameAr].some((n) => n && n.toLowerCase().includes(q)));
              if (matches.length !== 1) return io.fail(matches.length ? `"${a.name}" matches ${matches.length} companies; be more specific.` : `No company matches "${a.name}".`);
              ctx.dispatch({ type: "selectCompany", id: matches[0].id });
              io.print(`${L(ctx, "Active company", "الشركة النشطة")}: ${nameOf(ctx, matches[0])}`, "ok");
            },
          })
          .command({
            path: ["sample"],
            summary: "Load the fictional sample company",
            tags: ["mutates"],
            run: (_a, ctx, io) => {
              const c = sampleCompany();
              ctx.dispatch({ type: "addCompany", company: c });
              io.print(`${L(ctx, "Loaded sample company", "تم تحميل الشركة النموذجية")}: ${c.settings.tradeNameEn}`, "ok");
            },
          }),
      )

      .command({
        path: ["status"],
        aliases: ["st"],
        summary: "Period status and close checklist",
        tags: ["needs:company"],
        run: (_a, ctx, io) => {
          const c = ctx.company!;
          io.kv([["Company", nameOf(ctx, c)], ["Period", `${c.period.currentLabel} (${c.period.start} → ${c.period.end})`], ["Framework", c.settings.framework], ["Status", c.period.status], ["Accounts", c.rows.length]]);
          const checks = ctx.computed?.analysis ? ctx.computed.checks : [];
          if (checks.length) io.table(["Check", "Needed for", "Result"], checks.map((ch) => [L(ctx, ...(CHECK_LABELS[ch.key] ?? [ch.key, ch.key])), ch.requiredFor, ch.ok ? "✓" : "✗"]));
        },
      })

      .command({
        path: ["kpi"],
        summary: "Headline figures for the current period",
        tags: ["needs:company", "needs:data"],
        run: (_a, ctx, io) => {
          const cur = ctx.computed!.analysis!.current;
          const ccy = ctx.company!.settings.presentationCurrency;
          io.kv([
            [`Revenue (${ccy})`, num(cur.revenue)],
            ["Gross profit", num(cur.grossProfit)],
            ["EBITDA", num(cur.ebitda)],
            ["Net profit", num(cur.netProfit)],
            ["Cash", num(cur.cash)],
            ["Total assets", num(cur.totalAssets)],
            ["Total equity", num(cur.totalEquity)],
            ["Balance check", num(cur.balanceCheck)],
          ]);
        },
      })

      .command({
        path: ["tb"],
        summary: "Trial balance rows (after adjustments)",
        tags: ["needs:company", "needs:data"],
        args: [
          { name: "search", alias: "s", type: "string", description: "Filter by code or name" },
          { name: "unmapped", type: "boolean", description: "Only unmapped rows" },
          { name: "limit", alias: "n", type: "number", default: 25 },
        ],
        examples: ["tb --search cash", "tb --unmapped", 'tb -s "النقدية"'],
        run: (a, ctx, io) => {
          const q = String(a.search ?? "").toLowerCase();
          const rows = ctx.computed!.rows.filter((r) => (!q || r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)) && (!a.unmapped || r.category === ""));
          const limit = Math.max(1, Number(a.limit));
          io.table(["Code", "Account", "Category", "Dr", "Cr"], rows.slice(0, limit).map((r) => [r.code, r.name, r.category || "—", num(r.currentDebit), num(r.currentCredit)]));
          io.print(`${Math.min(limit, rows.length)} / ${rows.length} rows`, "muted");
        },
      })

      .command({
        path: ["fs"],
        summary: "Financial statement lines with prior period",
        tags: ["needs:company", "needs:data"],
        args: [{ name: "statement", type: "enum", choices: ["pl", "bs"], positional: true, default: "pl" }],
        examples: ["fs bs"],
        run: (a, ctx, io) => {
          const { current, prior } = ctx.computed!.analysis!;
          const st = a.statement === "bs" ? "BS" : "PL";
          io.table(["Line", ctx.company!.period.currentLabel, ctx.company!.period.priorLabel], STATEMENT_LINES.filter((l) => l.statement === st).map((l) => [`${l.total ? "■ " : "  "}${humanize(l.key)}`, num(current[l.key]), prior ? num(prior[l.key]) : "—"]));
        },
      })

      .command({
        path: ["ratios"],
        summary: "Financial ratios",
        tags: ["needs:company", "needs:data"],
        args: [{ name: "group", alias: "g", type: "enum", choices: ["liquidity", "profitability", "efficiency", "leverage"] }],
        run: (a, ctx, io) => {
          const fmt = (v: number | null, unit: string) => (v === null ? "—" : unit === "%" ? `${v.toFixed(1)}%` : unit === "days" ? `${v.toFixed(0)} d` : `${v.toFixed(2)}×`);
          const ratios = ctx.computed!.analysis!.ratios.filter((r) => !a.group || r.group === a.group);
          io.table(["Ratio", "Group", "Current", "Prior"], ratios.map((r) => [humanize(r.key), r.group, fmt(r.current, r.unit), fmt(r.prior, r.unit)]));
        },
      })

      .command({
        path: ["cf"],
        summary: "Cash flow statement (indirect method)",
        tags: ["needs:company", "needs:data"],
        run: (_a, ctx, io) => {
          const cf = ctx.computed!.cashFlow;
          if (!cf) return io.fail("Cash flow needs a prior period in the trial balance.");
          io.table(["Line", "Section", "Amount"], cf.lines.map((l) => [humanize(l.key), l.section, num(l.amount)]));
          io.kv([["Operating", num(cf.operating)], ["Investing", num(cf.investing)], ["Financing", num(cf.financing)], ["Net change", num(cf.netChange)], ["Free cash flow", num(cf.freeCashFlow)], ["Tie-out difference", num(cf.tieOutDifference)]]);
          if (Math.abs(cf.tieOutDifference) >= 0.01) io.print("Cash flow does not tie to the balance sheet.", "warn");
        },
      })

      .command({
        path: ["tax"],
        summary: "Egyptian tax computation summary",
        tags: ["needs:company", "needs:data"],
        args: [{ name: "lines", alias: "l", type: "boolean", description: "Show every schedule line" }],
        run: (a, ctx, io) => {
          const t = ctx.computed!.tax!;
          if (a.lines) io.table(["Line", "Amount"], t.lines.map((l: { key?: string; label?: string; amount: number }) => [humanize(String(l.key ?? l.label ?? "")), num(l.amount)]));
          io.kv([
            ["Taxable profit", num(t.taxableProfit)],
            ["Tax", num(t.tax)],
            ["Payable", num(t.payable)],
            ["Effective rate", t.effectiveRate === null ? "—" : `${t.effectiveRate}%`],
            ["Booked tax", num(t.bookedTax)],
            ["Loss carried forward", num(t.lossCarriedForward)],
            ["Thin-cap D/E", t.thinCap.ratio ?? "—"],
            ["Deferred tax", `${num(t.deferredTax.net)} (${t.deferredTax.position})`],
          ]);
        },
      })

      .command({
        path: ["scenarios"],
        aliases: ["sc"],
        summary: "Base / bull / bear model outcomes and covenant breaches",
        tags: ["needs:company", "needs:data"],
        run: (_a, ctx, io) => {
          const s = ctx.computed!.scenarios!;
          io.table(
            ["Scenario", "Periods", "Final revenue", "Final net profit", "Final cash", "Covenant breaches"],
            (["base", "bull", "bear"] as const).map((k) => {
              const last = s[k].periods.at(-1);
              const breaches = s[k].covenants.filter((c) => c.leverageBreach || c.coverageBreach).length;
              return [k, s[k].periods.length, num(last?.revenue), num(last?.netProfit), num(last?.cash), breaches];
            }),
          );
        },
      })

      .command({
        path: ["valuation"],
        aliases: ["dcf"],
        summary: "WACC and DCF enterprise / equity value",
        tags: ["needs:company", "needs:data"],
        run: (_a, ctx, io) => {
          const v = ctx.computed!.valuation!;
          if (!v.wacc.available) return io.fail(`WACC needs market inputs: ${v.wacc.missing.join(", ")}. Run: go valuation`);
          const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
          io.kv([["Cost of equity", pct(v.wacc.costOfEquity)], ["After-tax cost of debt", pct(v.wacc.afterTaxCostOfDebt)], ["WACC", pct(v.wacc.wacc)], ["Net debt", num(v.netDebt)]]);
          const d = v.dcf;
          if (!d) return;
          const row = (name: string, m: typeof d.gordon) => [name, num(m?.enterpriseValue), num(m?.equityValue), m?.tvShare === null || m?.tvShare === undefined ? "—" : `${m.tvShare}%`];
          io.table(["Terminal method", "Enterprise value", "Equity value", "TV share"], [row("Gordon growth", d.gordon), row("Exit multiple", d.exit)]);
          if (d.gordonInvalid) io.print("Gordon growth is invalid: WACC ≤ terminal growth.", "warn");
        },
      })

      .command({
        path: ["stress"],
        summary: "FX and rate stress test: base vs stressed",
        tags: ["needs:company", "needs:data"],
        run: (_a, ctx, io) => {
          const s = ctx.computed!.stress!;
          if (!s.fxReady) io.print("FX rates not entered; FX impacts are zero. Run: go stress", "warn");
          io.table(
            ["Metric", "Base", "Stressed"],
            (["netProfit", "ebitda", "debtToEbitda", "interestCoverage", "equity"] as const).map((k) => [humanize(k), num(s.base[k]), num(s.stressed[k])]),
          );
          io.kv([["FX move", `${s.move}%`], ["Cash runway (months)", s.stressed.cashRunwayMonths ?? "—"]]);
        },
      })

      .command({
        path: ["notes"],
        summary: "Disclosure notes triggered by the balances",
        tags: ["needs:company", "needs:data"],
        run: (_a, ctx, io) => {
          const notes = ctx.computed!.notes!;
          if (!notes.length) return io.print("No notes triggered.", "muted");
          io.table(["Note", "Standard", "Status"], notes.map((n) => [L(ctx, ...n.title), n.standard, ctx.company!.disclosures[n.id]?.status ?? "DRAFT"]));
        },
      })

      .command({
        path: ["echo"],
        summary: "Print text (useful in chains)",
        args: [{ name: "text", type: "string", positional: true, rest: true }],
        run: (a, _c, io) => io.print(String(a.text ?? "")),
      })

      .group("period", "Period state machine", (g) =>
        g.command({
          path: ["advance"],
          summary: "Move the period to the next status (gated by checks)",
          tags: ["needs:company", "needs:data", "role:REVIEWER|CFO"],
          args: [{ name: "to", type: "enum", choices: ["MAPPED", "RECONCILED", "LOCKED"], positional: true }],
          examples: ["period advance", "period advance LOCKED"],
          run: (a, ctx, io) => {
            const cur = ctx.company!.period.status;
            const to = (a.to as PeriodStatus | undefined) ?? ORDER[ORDER.indexOf(cur) + 1];
            if (!to || ORDER.indexOf(to) <= ORDER.indexOf(cur)) return io.fail(`Period is already ${cur}.`);
            if (to === "LOCKED" && ctx.ws.profile.role !== "CFO") return io.fail("Only the CFO can lock a period.");
            const checks = ctx.computed?.checks ?? [];
            if (!canAdvance(checks, to)) {
              const failing = checks.filter((c) => !c.ok && ORDER.indexOf(c.requiredFor) <= ORDER.indexOf(to));
              return io.fail(`Cannot move to ${to}. Failing: ${failing.map((c) => c.key).join(", ")}`);
            }
            ctx.setPeriodStatus(to);
            io.print(`${cur} → ${to}`, "ok");
          },
        }),
      )

      .group("audit", "Hash-chained audit trail", (g) =>
        g
          .command({
            path: ["verify"],
            summary: "Verify the audit chain",
            run: (_a, ctx, io) => {
              const r = verifyAudit(ctx.ws.audit);
              if (r.valid) io.print(`Audit chain valid (${ctx.ws.audit.length} entries)`, "ok");
              else io.fail(`Audit chain broken at entry #${r.brokenAt}`);
            },
          })
          .command({
            path: ["tail"],
            summary: "Most recent audit entries",
            args: [{ name: "n", type: "number", positional: true, default: 10 }],
            run: (a, ctx, io) => {
              const rows = ctx.ws.audit.slice(-Math.max(1, Number(a.n))).reverse();
              if (!rows.length) return io.print("No audit entries yet.", "muted");
              io.table(["#", "Time", "User", "Action", "Entity"], rows.map((e) => [e.seq, e.timestamp.slice(0, 19).replace("T", " "), `${e.userId} (${e.role})`, e.action, e.entity]));
            },
          }),
      )
      .build()
  );
}
