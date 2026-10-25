import { tool } from "ai";
import { z } from "zod";
import { applyAjes, ajeBalanced, type Aje } from "../finance/adjustments";
import { commonSize, medianOf } from "../finance/benchmark";
import { analyze } from "../finance/engine";
import { applyScenario, covenantTest, runModel, sensitivityGrid, SENSITIVITY_DRIVERS, SENSITIVITY_METRICS, type ModelInputs } from "../finance/model";
import { stressTest } from "../finance/stress";
import { CATEGORIES, type Category } from "../finance/types";
import { dcf, ufcf, wacc, type ValuationInputs } from "../finance/valuation";
import { computeCompany, type Computed } from "../workspace/compute";
import { consolidateGroup } from "../workspace/group";
import { compareRuns, summarise as summariseChecks, toRun, validateCompany } from "../ingest/validate";
import type { Company, Group } from "../workspace/types";

type Ready = Extract<Computed, { analysis: NonNullable<Computed["analysis"]> }>;

/** Keeps tool outputs small so they fit comfortably in the model's context. */
const round = (v: unknown): unknown => {
  if (typeof v === "number") return Math.round(v * 100) / 100;
  if (Array.isArray(v)) return v.map(round);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)]));
  return v;
};

const pct = z.number().min(-1).max(10).describe("A fraction, e.g. 0.05 for 5%");

/**
 * Tools the AI CFO agent can call. Every number comes from the deterministic engines run on the
 * company snapshot the server received. Proposal tools never change data: they return a draft the
 * user must approve in the app.
 */
export function buildAgentTools(company: Company, peers: Company[] = [], groups: Group[] = []) {
  const k = computeCompany(company);
  if (!k.analysis) return null;
  const c = k as Ready;
  const a = c.analysis;

  return {
    get_overview: tool({
      description: "Company, period status, framework, validation issues, close checklist and headline figures. Call this first.",
      inputSchema: z.object({}),
      execute: async () =>
        round({
          company: company.settings.tradeNameEn,
          currency: company.settings.presentationCurrency,
          framework: company.settings.framework,
          period: { current: company.period.currentLabel, prior: a.hasPrior ? company.period.priorLabel : "not provided", status: company.period.status, start: company.period.start, end: company.period.end },
          validation: a.issues,
          checks: c.checks,
          figures: { revenue: a.current.revenue, grossProfit: a.current.grossProfit, ebitda: a.current.ebitda, netProfit: a.current.netProfit, cash: a.current.cash, totalAssets: a.current.totalAssets, totalEquity: a.current.totalEquity },
          loadedSources: company.docs.map((d) => d.category),
        }),
    }),

    get_statement: tool({
      description: "A full financial statement for the current period (and prior when available).",
      inputSchema: z.object({ statement: z.enum(["income", "balance", "equity", "cashflow", "cashflow_direct"]) }),
      execute: async ({ statement }) => {
        if (statement === "equity") return round(c.equity);
        if (statement === "cashflow") return c.cashFlow ? round(c.cashFlow) : { error: "Prior period not provided" };
        if (statement === "cashflow_direct") return c.cashFlowDirect ? round(c.cashFlowDirect) : { error: "Prior period not provided" };
        const st = statement === "income" ? "PL" : "BS";
        return round(a.variances.filter((v) => v.statement === st).map(({ key, current, prior }) => ({ line: key, current, prior })));
      },
    }),

    get_variances: tool({
      description: "Current vs prior variances per statement line, with materiality flags (≥1% of revenue/total assets and ≥10%).",
      inputSchema: z.object({ statement: z.enum(["income", "balance", "both"]).default("both"), materialOnly: z.boolean().default(false) }),
      execute: async ({ statement, materialOnly }) => {
        if (!a.hasPrior) return { error: "Prior period not provided" };
        return round(
          a.variances.filter((v) => (statement === "both" || v.statement === (statement === "income" ? "PL" : "BS")) && (!materialOnly || v.material)),
        );
      },
    }),

    get_ratios: tool({
      description: "Liquidity, profitability, efficiency and leverage ratios with formulas, plus DuPont, Altman Z'' and Beneish M.",
      inputSchema: z.object({ group: z.enum(["liquidity", "profitability", "efficiency", "leverage", "all"]).default("all"), includeScores: z.boolean().default(true) }),
      execute: async ({ group, includeScores }) =>
        round({
          ratios: a.ratios.filter((r) => group === "all" || r.group === group),
          ...(includeScores ? { dupont: c.dupont, altmanZDoublePrime: c.altman, beneishM: c.beneish ?? "prior period not provided" } : {}),
        }),
    }),

    find_accounts: tool({
      description: "Search trial balance accounts by code or name (English or Arabic) and/or category. Returns balances, mapping rule and source lineage.",
      inputSchema: z.object({ query: z.string().max(100).default(""), category: z.enum([...CATEGORIES, "UNMAPPED"]).optional(), limit: z.number().int().min(1).max(50).default(15) }),
      execute: async ({ query, category, limit }) => {
        const q = query.trim().toLowerCase();
        return round(
          c.rows
            .filter((r) => (!q || `${r.code} ${r.name}`.toLowerCase().includes(q)) && (!category || (category === "UNMAPPED" ? r.category === "" : r.category === category)))
            .slice(0, limit)
            .map((r) => ({
              code: r.code,
              name: r.name,
              category: r.category || "UNMAPPED",
              closingDrMinusCr: r.currentDebit - r.currentCredit,
              priorDrMinusCr: r.priorDebit - r.priorCredit,
              mappingRule: r.mappingRule,
              confidence: r.confidence,
              suggested: r.suggested,
              source: company.docs.find((d) => d.id === r.sourceDocId)?.fileName ?? r.sourceDocId ?? null,
              sourceRow: r.sourceRow,
              currency: r.currency ?? company.settings.functionalCurrency,
            })),
        );
      },
    }),

    get_subledger: tool({
      description: "Subledger analysis and its tie-out to the trial balance: AR aging & ECL, AP & Form 41, fixed assets & tax pools, inventory & NRV, payroll, bank reconciliation, ETA e-invoices, GL vs TB.",
      inputSchema: z.object({ kind: z.enum(["ar", "ap", "far", "inventory", "payroll", "bank", "eta", "gl"]) }),
      execute: async ({ kind }) => {
        const s = c.subledgers;
        const ties = c.tieOuts as Record<string, unknown>;
        switch (kind) {
          case "ar":
            return s.ar ? round({ ...s.ar, tieOut: ties.ar, note: "ECL rates are the company's provision-matrix inputs" }) : { error: "AR subledger not loaded" };
          case "ap":
            return s.ap ? round({ ...s.ap, tieOut: ties.ap }) : { error: "AP subledger not loaded" };
          case "far":
            return s.far ? round({ rollForward: s.far.rollForward, tax: s.far.tax, deferredTax: s.far.deferredTax, unknownCategories: s.far.unknownCategories, tieOut: { cost: ties.farCost, accumulatedDepreciation: ties.farAccumDep } }) : { error: "Fixed asset register not loaded" };
          case "inventory":
            return s.inventory ? round({ ...s.inventory, valued: s.inventory.valued.slice(0, 30), tieOut: ties.inventory }) : { error: "Inventory subledger not loaded" };
          case "payroll":
            return s.payroll ? round(s.payroll) : { error: "Payroll register not loaded" };
          case "bank":
            return s.bank ? round({ ...s.bank, unmatchedBank: s.bank.unmatchedBank.slice(0, 20), unmatchedBook: s.bank.unmatchedBook.slice(0, 20) }) : { error: "Bank statement not loaded" };
          case "eta":
            return s.eta ? round({ ...s.eta, tieOut: ties.eta }) : { error: "ETA e-invoices not loaded" };
          case "gl":
            return s.gl ? round({ lines: s.gl.lines, exceptions: s.gl.vsTb.exceptions, accountDifferences: s.gl.vsTb.accounts.filter((x) => x.difference !== 0).slice(0, 20), glOnly: s.gl.vsTb.glOnly, unbalancedJournals: s.gl.unbalanced.slice(0, 20) }) : { error: "General ledger not loaded" };
        }
      },
    }),

    get_tax_computation: tool({
      description: "Egyptian corporate tax computation schedule (book-to-tax), thin capitalisation, credits, payable and deferred tax. Rule parameters are the company's inputs.",
      inputSchema: z.object({}),
      execute: async () => round({ inputs: company.tax, ...c.tax }),
    }),

    run_forecast: tool({
      description:
        "Run the integrated 3-statement model as a what-if. Starts from the company's saved model drivers, applies optional scenario and driver overrides, and returns each period's P&L, cash, debt, balance check and covenant tests. Does not save anything.",
      inputSchema: z.object({
        scenario: z.enum(["base", "bull", "bear"]).default("base"),
        overrides: z
          .object({
            revenueGrowth: pct.optional(),
            grossMargin: pct.optional(),
            opexPctRevenue: pct.optional(),
            capexPctRevenue: pct.optional(),
            debtInterestRate: pct.optional(),
            taxRate: pct.optional(),
            dividendPayout: pct.optional(),
            minimumCash: z.number().min(0).optional(),
            termLoanRepayment: z.number().min(0).optional(),
            granularity: z.enum(["annual", "monthly"]).optional(),
          })
          .default({}),
      }),
      execute: async ({ scenario, overrides }) => {
        const base: ModelInputs = { ...c.modelInputs, ...overrides };
        if (overrides.granularity) base.periods = overrides.granularity === "monthly" ? 12 : 3;
        const inputs = applyScenario(base, company.scenarios[scenario]);
        const periods = runModel(a.current, inputs);
        return round({
          assumptions: inputs,
          periods: periods.map((p) => ({ period: p.period, revenue: p.revenue, ebitda: p.ebitda, netProfit: p.netProfit, cash: p.cash, debt: p.revolver + p.termLoan, equity: p.equity, balanceCheck: p.balanceCheck, solverIterations: p.iterations, converged: p.converged })),
          covenants: { thresholds: company.covenants, tests: covenantTest(periods, company.covenants, inputs.granularity === "monthly" ? 12 : 1) },
          note: "Hypothetical: depends on the stated assumptions.",
        });
      },
    }),

    run_sensitivity: tool({
      description: "5×5 sensitivity grid: reruns the model while moving two drivers by −2..+2 steps; returns the metric in the final period.",
      inputSchema: z.object({
        x: z.enum(SENSITIVITY_DRIVERS),
        y: z.enum(SENSITIVITY_DRIVERS),
        metric: z.enum(SENSITIVITY_METRICS).default("ebitda"),
        stepX: z.number().min(0.001).max(0.5).default(0.02),
        stepY: z.number().min(0.001).max(0.5).default(0.01),
      }),
      execute: async ({ x, y, metric, stepX, stepY }) => (x === y ? { error: "Choose two different drivers" } : round(sensitivityGrid(a.current, c.modelInputs, x, y, metric, stepX, stepY))),
    }),

    run_valuation: tool({
      description: "DCF valuation (WACC, UFCF from the model, Gordon and exit-multiple terminal values, equity bridge). Optional overrides for a what-if; missing market inputs are reported, never assumed.",
      inputSchema: z.object({
        overrides: z
          .object({
            riskFreeRate: pct.optional(),
            beta: z.number().min(0).max(5).optional(),
            equityRiskPremium: pct.optional(),
            countryRiskPremium: pct.optional(),
            preTaxCostOfDebt: pct.optional(),
            targetDebtWeight: z.number().min(0).max(1).optional(),
            terminalGrowth: pct.optional(),
            exitMultiple: z.number().min(0).max(100).optional(),
          })
          .default({}),
      }),
      execute: async ({ overrides }) => {
        const v: ValuationInputs = { ...company.valuation, ...overrides };
        const w = wacc(v);
        if (!w.available) return { error: "Market inputs not provided", missing: w.missing };
        const annual = c.modelInputs.granularity === "annual" ? c.model : runModel(a.current, { ...c.modelInputs, granularity: "annual", periods: 5 });
        const flows = ufcf(annual, v.taxRate, a.current);
        const netDebt = a.current.shortTermDebt + a.current.longTermDebt - a.current.cash;
        return round({ wacc: w, flows, dcf: dcf(flows, w.wacc, v.terminalGrowth, v.exitMultiple, v.midYear, netDebt), netDebt, comps: c.valuation.comps });
      },
    }),

    run_stress_test: tool({
      description: "FX devaluation and interest-rate stress on the latest actuals. Exchange rates must come from the user or the saved inputs; never invent them.",
      inputSchema: z.object({
        baseRate: z.number().positive().optional(),
        shockedRate: z.number().positive().optional(),
        importedCogsShare: z.number().min(0).max(1).optional(),
        passThrough: z.number().min(0).max(1).optional(),
        floatingDebtShare: z.number().min(0).max(1).optional(),
        rateShock: z.number().min(-0.5).max(0.5).optional(),
      }),
      execute: async (o) => {
        const s = { ...company.stress, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) };
        const r = stressTest(c.rows, a.current, s);
        return r.fxReady ? round({ inputs: s, ...r }) : round({ inputs: s, ...r, warning: "Base and shocked FX rates not provided; only the interest-rate shock applies" });
      },
    }),

    get_budget_vs_actual: tool({
      description: "Active budget version vs actual, and the price/mix/quantity revenue variance.",
      inputSchema: z.object({}),
      execute: async () => (c.budget ? round({ version: c.budget.version.name, approved: c.budget.version.approved, bva: c.budget.bva, revenueVariance: c.budget.revenueVariance, cash: c.budget.statements.cash }) : { error: "No budget version selected" }),
    }),

    get_disclosures: tool({
      description: "Triggered disclosure notes with their review status and how many management placeholders remain.",
      inputSchema: z.object({}),
      execute: async () =>
        c.notes.map((n) => {
          const body = n.body({ ...c.noteCtx, fmt: (x) => String(Math.round(x)) }, "en");
          return { id: n.id, title: n.title[0], standard: n.standard, status: company.disclosures[n.id]?.status ?? "DRAFT", placeholders: body.split("[Management Disclosure Required]").length - 1 };
        }),
    }),

    compare_peers: tool({
      description: "Compare the company's KPIs and common-size statements with other companies in the workspace.",
      inputSchema: z.object({}),
      execute: async () => {
        const all = [company, ...peers].map((p) => ({ p, k: computeCompany(p) })).filter((x) => x.k.analysis);
        const keys = ["grossMargin", "ebitdaMargin", "netMargin", "roe", "currentRatio", "debtToEquity", "dso", "interestCoverage"];
        if (all.length < 2) return { error: "No other companies with a trial balance in the workspace" };
        const kpi = (x: (typeof all)[number], key: string) => x.k.analysis!.ratios.find((r) => r.key === key)?.current ?? null;
        return round({
          companies: all.map((x) => ({ name: x.p.settings.tradeNameEn, kpis: Object.fromEntries(keys.map((key) => [key, kpi(x, key)])) })),
          median: Object.fromEntries(keys.map((key) => [key, medianOf(all.map((x) => kpi(x, key)))])),
          commonSizePl: all.map((x) => ({ name: x.p.settings.tradeNameEn, lines: commonSize(x.k.analysis!.current).filter((l) => l.statement === "PL").map((l) => ({ line: l.key, pct: l.pct })) })),
        });
      },
    }),

    get_close_review: tool({
      description: "Rule-based close review: anomaly flags (GL journal tests, abnormal and suspense balances, big swings, AR/AP/inventory/payroll/bank exceptions) with example rows, plus readiness gates and missing FX rates.",
      inputSchema: z.object({ severity: z.enum(["all", "high", "medium", "low"]).default("all") }),
      execute: async ({ severity }) =>
        round({
          anomalies: c.anomalies.filter((x) => severity === "all" || x.severity === severity).map((x) => ({ id: x.id, area: x.area, severity: x.severity, finding: x.title[0], why: x.detail[0], count: x.count, examples: x.examples })),
          checks: c.checks,
          tieOuts: c.tieOuts,
          missingFxRates: c.fx.missing,
          glLoaded: company.subledgers.gl.length > 0,
        }),
    }),

    search_gl: tool({
      description: "Search the general ledger lines: by text (account, memo, counterparty, journal), account code prefix, date range and amount range. Returns matching lines (max 50) and totals. Use it to answer questions about specific transactions.",
      inputSchema: z.object({
        text: z.string().max(100).optional(),
        accountPrefix: z.string().max(32).optional(),
        from: z.string().max(10).optional().describe("YYYY-MM-DD"),
        to: z.string().max(10).optional().describe("YYYY-MM-DD"),
        minAmount: z.number().optional(),
        maxAmount: z.number().optional(),
        limit: z.number().int().min(1).max(50).default(25),
      }),
      execute: async ({ text, accountPrefix, from, to, minAmount, maxAmount, limit }) => {
        const gl = company.subledgers.gl;
        if (!gl.length) return { error: "General ledger not loaded. Upload it on the dashboard." };
        const q = text?.toLowerCase();
        const hits = gl.filter((l) => {
          const amt = Math.max(l.debit, l.credit);
          return (
            (!q || `${l.accountCode} ${l.accountName} ${l.memo} ${l.counterparty} ${l.journalId} ${l.voucher}`.toLowerCase().includes(q)) &&
            (!accountPrefix || l.accountCode.startsWith(accountPrefix)) &&
            (!from || l.postingDate >= from) &&
            (!to || l.postingDate <= to) &&
            (minAmount === undefined || amt >= minAmount) &&
            (maxAmount === undefined || amt <= maxAmount)
          );
        });
        return round({
          matches: hits.length,
          totalDebit: hits.reduce((x, l) => x + l.debit, 0),
          totalCredit: hits.reduce((x, l) => x + l.credit, 0),
          lines: hits.slice(0, limit).map((l) => ({ date: l.postingDate, journal: l.journalId, account: `${l.accountCode} ${l.accountName}`, debit: l.debit, credit: l.credit, counterparty: l.counterparty, memo: l.memo })),
          truncated: hits.length > limit,
        });
      },
    }),

    get_top_counterparties: tool({
      description: "Largest customers (open receivables, overdue amount) or suppliers (open payables, withholding tax) from the AR and AP subledgers.",
      inputSchema: z.object({ side: z.enum(["customers", "suppliers"]), limit: z.number().int().min(1).max(25).default(10) }),
      execute: async ({ side, limit }) => {
        const asOf = company.period.end;
        if (side === "customers") {
          if (!company.subledgers.ar.length) return { error: "AR aging not loaded." };
          const m = new Map<string, { customer: string; open: number; overdue: number; invoices: number }>();
          for (const i of company.subledgers.ar) {
            const e = m.get(i.customer) ?? { customer: i.customer, open: 0, overdue: 0, invoices: 0 };
            e.open += i.outstanding;
            if (i.dueDate < asOf) e.overdue += i.outstanding;
            e.invoices++;
            m.set(i.customer, e);
          }
          return round([...m.values()].sort((a, b) => b.open - a.open).slice(0, limit));
        }
        if (!company.subledgers.ap.length) return { error: "AP ledger not loaded." };
        const m = new Map<string, { supplier: string; open: number; whtDeducted: number; invoices: number }>();
        for (const i of company.subledgers.ap) {
          const e = m.get(i.supplier) ?? { supplier: i.supplier, open: 0, whtDeducted: 0, invoices: 0 };
          if (!/^(paid|مدفوع|مسدد)/i.test(i.status)) e.open += i.netPayable;
          e.whtDeducted += i.whtDeducted;
          e.invoices++;
          m.set(i.supplier, e);
        }
        return round([...m.values()].sort((a, b) => b.open - a.open).slice(0, limit));
      },
    }),

    get_trends: tool({
      description: "Month-by-month figures from monthly trial balances (revenue, gross profit, EBITDA, net profit, cash, receivables, inventory, payables, equity, margins, receivable days) and the latest month-on-month change.",
      inputSchema: z.object({}),
      execute: async () => (c.trend.length ? round({ ytdFiles: company.monthlyYtd, months: c.trend, summary: c.trendSummary }) : { error: "No monthly trial balances loaded. Upload one TB per month and choose “One month”." }),
    }),

    get_consolidation: tool({
      description: "Consolidated group figures for a group this company belongs to: eliminations, unreconciled intercompany differences, goodwill, non-controlling interests and consolidated statements.",
      inputSchema: z.object({}),
      execute: async () => {
        const g = groups.find((x) => x.members.some((m) => m.companyId === company.id));
        if (!g) return { error: "This company is not in a group. Set one up on the Group consolidation page." };
        const r = consolidateGroup([company, ...peers], g);
        if (!r.analysis) return { error: "Group members have no trial balances." };
        return round({
          group: g.name,
          members: r.entities.map((e) => ({ name: e.name, ownership: e.ownership, parent: e.isParent })),
          missingMembers: r.missing.length,
          eliminations: r.eliminations,
          unreconciled: r.differences,
          goodwill: r.goodwill,
          nonControllingInterests: r.nci,
          figures: { revenue: r.analysis.current.revenue, netProfit: r.analysis.current.netProfit, totalAssets: r.analysis.current.totalAssets, totalEquity: r.analysis.current.totalEquity, balanceCheck: r.analysis.current.balanceCheck },
        });
      },
    }),

    get_period_history: tool({
      description: "Closed (archived) periods and board packs frozen at period lock, with their headline figures.",
      inputSchema: z.object({}),
      execute: async () =>
        round({
          closedPeriods: company.history.map((h) => {
            const x = analyze(h.rows).current;
            return { period: h.label, start: h.start, end: h.end, lockedBy: h.lockedBy, revenue: x.revenue, netProfit: x.netProfit, cash: x.cash, totalEquity: x.totalEquity };
          }),
          boardPacks: company.boardPacks.map((p) => ({ period: p.periodLabel, createdAt: p.createdAt, createdBy: p.createdBy, sha256: p.hash.slice(0, 16) })),
          sources: company.docs.map((d) => ({ file: d.fileName, type: d.category, role: d.role ?? "current", rows: d.rowCount, erp: d.erp ?? null, format: d.format ?? null })),
        }),
    }),

    get_upload_report: tool({
      description: "What the latest file uploads did: each import run with the files read (type, rows, ERP, how it was read, recognition confidence), files held back for review and why, mappings accepted automatically, AI mapping suggestions, accounts still to map and the period status afterwards. Use it when the user asks about files they uploaded.",
      inputSchema: z.object({ runs: z.number().int().min(1).max(10).default(3) }),
      execute: async ({ runs }) =>
        round({
          automation: company.automation,
          runs: company.importRuns.slice(-runs).reverse(),
          sources: company.docs.slice(-30).map((d) => ({ file: d.fileName, type: d.category, role: d.role ?? "current", rows: d.rowCount, erp: d.erp ?? null })),
        }),
    }),

    get_validation_report: tool({
      description: "Every validation rule run on the loaded data (trial balance, opening balances, GL, AR, AP, fixed assets, inventory, payroll, bank, ETA, tie-outs, FX) with pass/fail, severity, counts and example items, plus what changed since the previous saved validation run.",
      inputSchema: z.object({ failedOnly: z.boolean().default(true) }),
      execute: async ({ failedOnly }) => {
        const checks = validateCompany(company, k);
        const prev = company.validationRuns.at(-1);
        const cur = toRun(checks, "agent", company.tolerance, "agent-check");
        return round({
          tolerance: company.tolerance,
          summary: summariseChecks(checks),
          checks: checks.filter((x) => !failedOnly || !x.ok).map((x) => ({ id: x.id, area: x.area, level: x.level, ok: x.ok, rule: x.title[0], problem: x.ok ? null : (x.detail?.[0] ?? null), count: x.count, examples: x.items.slice(0, 8), fixIn: x.fix ?? null })),
          sinceLastRun: prev ? { lastRunAt: prev.at, ...compareRuns(prev, cur) } : null,
        });
      },
    }),

    get_cash_forecast: tool({
      description: "13-week direct cash forecast built from open customer and supplier invoices by due date, payroll and the analyst's recurring items: weekly opening, collections, payments, payroll, closing cash, the lowest week and weeks below the minimum cash level.",
      inputSchema: z.object({}),
      execute: async () => round({ assumptions: { ...company.cashForecast, items: company.cashForecast.items.length }, ...c.cashForecast }),
    }),

    propose_adjusting_entry: tool({
      description:
        "Draft an adjusting journal entry and preview its effect on profit and the balance sheet. Nothing is posted: the user reviews the draft and clicks Post in the app. Use existing account codes where possible; new accounts need a name and category.",
      inputSchema: z.object({
        reason: z.string().min(3).max(300),
        lines: z
          .array(
            z.object({
              code: z.string().max(64),
              name: z.string().max(200).optional(),
              category: z.enum(CATEGORIES).optional(),
              debit: z.number().min(0),
              credit: z.number().min(0),
            }),
          )
          .min(2)
          .max(20),
      }),
      execute: async ({ reason, lines }) => {
        const resolved = lines.map((l) => {
          const existing = company.rows.find((r) => r.code === l.code);
          return { code: l.code, name: existing?.name ?? l.name ?? "", category: (existing?.category ?? l.category ?? "") as Category | "", debit: l.debit, credit: l.credit, newAccount: !existing };
        });
        const problems: string[] = [];
        const draft: Aje = { id: "DRAFT", date: company.period.end, reason, author: "AI CFO agent (draft)", kind: "AJE", lines: resolved };
        if (!ajeBalanced(draft)) problems.push("Debits do not equal credits");
        for (const l of resolved) if (l.newAccount && (!l.name || !l.category)) problems.push(`New account ${l.code} needs a name and category`);
        if (resolved.some((l) => l.debit > 0 && l.credit > 0)) problems.push("Each line should be either a debit or a credit");
        if (problems.length) return { proposal: null, problems };
        const after = analyze(applyAjes(c.rows, [draft])).current;
        return round({
          proposal: { type: "aje", reason, lines: resolved },
          impact: {
            netProfit: { before: a.current.netProfit, after: after.netProfit },
            totalAssets: { before: a.current.totalAssets, after: after.totalAssets },
            totalEquity: { before: a.current.totalEquity, after: after.totalEquity },
            balanceCheckAfter: after.balanceCheck,
          },
          note: "Draft only. The user must review and post it.",
        });
      },
    }),

    propose_mapping_change: tool({
      description: "Draft a change to an account's category mapping. Nothing changes until the user applies it in the app. Not allowed when the period is locked.",
      inputSchema: z.object({ code: z.string().max(64), category: z.enum(CATEGORIES), rationale: z.string().max(300) }),
      execute: async ({ code, category, rationale }) => {
        if (company.period.status === "LOCKED") return { proposal: null, problems: ["Period is locked; mapping cannot change"] };
        const row = company.rows.find((r) => r.code === code);
        if (!row) return { proposal: null, problems: [`Account ${code} not found`] };
        return { proposal: { type: "mapping", code, name: row.name, from: row.category || "UNMAPPED", to: category, rationale } };
      },
    }),
  };
}

export type AgentTools = NonNullable<ReturnType<typeof buildAgentTools>>;

export const MAX_AGENT_STEPS = 8;

/** Newline-delimited JSON events streamed to the client so it can show tool activity as it happens. */
export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool-call"; id: string; name: string; input: unknown }
  | { type: "tool-result"; id: string; name: string; output: unknown }
  | { type: "tool-error"; id: string; name: string; error: string }
  | { type: "error"; message: string }
  | { type: "done"; steps: number };
