import { describe, expect, it } from "vitest";
import { buildAgentTools, type AgentTools } from "@/lib/agent/tools";
import { routeQuestion } from "@/lib/agent/offline";
import { cashForecast } from "@/lib/finance/cashforecast";
import { SAMPLE_TB_CSV } from "@/lib/finance/sample";
import { autoAdvance, autoEligible, autoMap, fileKey, runPipeline } from "@/lib/ingest/auto";
import { detectFile } from "@/lib/ingest/detect";
import { stageUnit, type Unit } from "@/lib/ingest/stage";
import { compareRuns, summarise, toRun, validateCompany } from "@/lib/ingest/validate";
import { computeCompany } from "@/lib/workspace/compute";
import { newCompany } from "@/lib/workspace/defaults";
import { sampleCompany } from "@/lib/workspace/sampleCompany";

const enc = (s: string) => new TextEncoder().encode(s);
const unit = (fileName: string, text: string): Unit => ({ id: fileName, fileName, text, bytes: enc(text), sha256: fileName, encoding: "utf-8", detection: detectFile(fileName, text), month: null });
const byId = (checks: ReturnType<typeof validateCompany>, id: string) => checks.find((c) => c.id === id);

describe("validation rules", () => {
  it("passes the core trial balance rules on the sample company", () => {
    const c = sampleCompany();
    const checks = validateCompany(c, computeCompany(c), "2026-01-15");
    expect(byId(checks, "tb.balanced")?.ok).toBe(true);
    expect(byId(checks, "tb.duplicateCodes")?.ok).toBe(true);
    expect(checks.length).toBeGreaterThan(30);
    const s = summarise(checks);
    expect(s.total).toBe(checks.length);
    expect(s.passed + s.errors + s.warnings + s.info).toBe(s.total);
  });

  it("catches an unbalanced trial balance, duplicate codes and AR problems", () => {
    const c = sampleCompany();
    c.rows = [...c.rows, { ...c.rows[0], currentDebit: c.rows[0].currentDebit + 10 }];
    c.subledgers.ar = [...c.subledgers.ar, { ...c.subledgers.ar[0], outstanding: c.subledgers.ar[0].amount + 50 }, { ...c.subledgers.ar[0], dueDate: "2000-01-01" }];
    const checks = validateCompany(c, computeCompany(c), "2026-01-15");
    expect(byId(checks, "tb.balanced")?.ok).toBe(false);
    expect(byId(checks, "tb.duplicateCodes")?.ok).toBe(false);
    expect(byId(checks, "ar.outstandingWithinAmount")?.ok).toBe(false);
    expect(byId(checks, "ar.uniqueInvoices")?.ok).toBe(false);
  });

  it("respects the rounding tolerance", () => {
    const c = sampleCompany();
    c.rows = c.rows.map((r, i) => (i === 0 ? { ...r, currentDebit: r.currentDebit + 0.4 } : r));
    c.tolerance = 0.01;
    expect(byId(validateCompany(c, computeCompany(c)), "tb.balanced")?.ok).toBe(false);
    c.tolerance = 1;
    expect(byId(validateCompany(c, computeCompany(c)), "tb.balanced")?.ok).toBe(true);
  });

  it("compares runs: new failures and fixes", () => {
    const prev = { id: "a", at: "", trigger: "x", tolerance: 0.01, results: { one: { level: "error" as const, ok: true, count: 0 }, two: { level: "error" as const, ok: false, count: 3 }, three: { level: "warning" as const, ok: false, count: 2 } } };
    const cur = { ...prev, id: "b", results: { one: { level: "error" as const, ok: false, count: 1 }, two: { level: "error" as const, ok: true, count: 0 }, three: { level: "warning" as const, ok: false, count: 5 } } };
    expect(compareRuns(prev, cur)).toEqual({ newFailures: ["one"], resolved: ["two"], changed: [{ id: "three", from: 2, to: 5 }] });
    expect(compareRuns(undefined, cur).newFailures).toEqual([]);
    expect(toRun([], "t", 0.01, "r", "2026-01-01").results).toEqual({});
  });
});

describe("13-week cash forecast", () => {
  const base = { startDate: "2026-01-01", openingCash: 1000, weeks: 13, overdueCollectionRate: 0.5, overdueWeeks: 2, collectionLagDays: 0, overduePayableWeeks: 1, includePayroll: false, minimumCash: 500, items: [], ap: [], payroll: [], payrollPeriodsPerYear: 12 };
  const ar = (dueDate: string, outstanding: number) => ({ invoice: dueDate, customer: "C", invoiceDate: "2025-12-01", dueDate, amount: outstanding, outstanding }) as never;
  const ap = (dueDate: string, netPayable: number, status = "open") => ({ invoice: dueDate, supplier: "S", invoiceDate: "2025-12-01", dueDate, gross: netPayable, wht: 0, netPayable, status }) as never;

  it("puts receipts and payments in their due weeks and spreads overdue amounts", () => {
    const f = cashForecast({ ...base, ar: [ar("2026-01-09", 300), ar("2025-12-01", 400), ar("2026-12-01", 99)], ap: [ap("2026-01-02", 1200), ap("2026-01-20", 50, "Paid")] });
    expect(f.weeks).toHaveLength(13);
    expect(f.weeks[1].collections).toBe(300);
    expect(f.weeks[0].overdueCollections).toBe(100);
    expect(f.weeks[1].overdueCollections).toBe(100);
    expect(f.weeks[0].supplierPayments).toBe(-1200);
    expect(f.weeks[0].closing).toBe(1000 + 100 - 1200);
    expect(f.weeksBelowMinimum).toContain(1);
    expect(f.beyondHorizon.receivables).toBe(99);
    expect(f.lowest.week).toBe(1);
    expect(f.weeks.at(-1)!.closing).toBe(f.totals.closing);
  });

  it("adds weekly and monthly items and carries the balance forward", () => {
    const f = cashForecast({ ...base, ar: [], items: [{ id: "r", name: "Rent", amount: -100, every: "month", week: 1 }, { id: "s", name: "Sales", amount: 50, every: "week", week: 3 }] });
    // Rent in weeks 1, 5 and 10 (every 52/12 weeks); sales every week from week 3.
    expect(f.weeks.map((w) => w.other)).toEqual([-100, 0, 50, 50, -50, 50, 50, 50, 50, -50, 50, 50, 50]);
    for (let i = 1; i < f.weeks.length; i++) expect(f.weeks[i].opening).toBe(f.weeks[i - 1].closing);
  });

  it("is part of the computed company and the agent tools", async () => {
    const c = sampleCompany();
    const k = computeCompany(c);
    expect(k.analysis && k.cashForecast.weeks.length).toBe(13);
    const tools = buildAgentTools(c) as AgentTools;
    const out = (await (tools.get_cash_forecast.execute as unknown as (i: unknown, o: unknown) => Promise<{ weeks: unknown[] }>)({}, { toolCallId: "t", messages: [] }));
    expect(out.weeks).toHaveLength(13);
    expect(routeQuestion("show the 13-week cash forecast", "2025-12-31").map((x) => x.name)).toContain("get_cash_forecast");
    expect(routeQuestion("what failed validation in the files I uploaded?", "2025-12-31").map((x) => x.name)).toEqual(expect.arrayContaining(["get_upload_report", "get_validation_report"]));
  });
});

describe("automatic import pipeline", () => {
  it("strips dates and numbers from file names to recognise next month's file", () => {
    expect(fileKey("TB 2025-03.csv")).toBe(fileKey("TB 2025-04.csv"));
    expect(fileKey("AR aging March 2025.xlsx")).toBe(fileKey("AR aging April 2025.xlsx"));
    expect(fileKey("ميزان مارس ٢٠٢٥.csv")).toBe(fileKey("ميزان أبريل ٢٠٢٥.csv"));
  });

  it("imports a recognised trial balance, maps, validates, records the run and remembers the file", async () => {
    const u = unit("TB 2025-12.csv", SAMPLE_TB_CSV);
    const staged = await stageUnit(u, "TRIAL_BALANCE");
    const c0 = newCompany("Auto");
    expect(autoEligible(c0, u, staged).ok).toBe(true);
    const { company, run } = runPipeline(c0, [{ id: u.id, staged, role: "current", month: null, unit: u }], [{ name: "scan.pdf", reason: "scanned" }], { by: "Tester", ids: ["d1"], runId: "run1", at: "2026-01-02T00:00:00Z" });
    expect(company.rows.length).toBeGreaterThan(10);
    expect(company.importRuns).toHaveLength(1);
    expect(run.files[0]).toMatchObject({ name: "TB 2025-12.csv", category: "TRIAL_BALANCE", rows: staged.rowCount });
    expect(run.held).toEqual([{ name: "scan.pdf", reason: "scanned" }]);
    expect(company.validationRuns.at(-1)?.id).toBe("run1-v");
    expect(company.fileMemory[fileKey("TB 2026-01.csv")]).toEqual({ category: "TRIAL_BALANCE", role: "current" });
    expect(company.period.status).not.toBe("LOCKED");
  });

  it("holds files with read errors or low recognition confidence", async () => {
    const bad = unit("x.csv", "Account Code,Account Name,Debit,Credit\n1101,Cash,abc,0\n");
    const st = await stageUnit(bad, "TRIAL_BALANCE");
    const c = newCompany();
    if (st.issues.some((i) => i.level === "error")) expect(autoEligible(c, bad, st).ok).toBe(false);
    const weak = { ...bad, detection: { ...bad.detection, confidence: 10 } };
    const okStaged = { ...st, issues: [] };
    expect(autoEligible({ ...c, automation: { ...c.automation, minConfidence: 60 } }, weak, okStaged)).toMatchObject({ ok: false });
    expect(autoEligible(c, weak, null).ok).toBe(false);
  });

  it("accepts only suggestions at or above the threshold and never locks", () => {
    const c = sampleCompany();
    c.rows = c.rows.map((r, i) => (i === 0 ? { ...r, suggested: true, confidence: 90 } : i === 1 ? { ...r, suggested: true, confidence: 70 } : r));
    const m = autoMap(c, 85);
    expect(m.accepted).toBe(1);
    expect(m.pending).toBe(1);
    expect(m.company.rows[0].mappingRule).toMatch(/auto-accepted ≥85%/);
    expect(autoMap(c, 101).accepted).toBe(0);
    const locked = { ...c, period: { ...c.period, status: "LOCKED" as const } };
    expect(autoAdvance(locked)).toBe(locked);
    expect(["DRAFT", "MAPPED", "RECONCILED"]).toContain(autoAdvance(m.company).period.status);
  });
});

describe("email intake", () => {
  it("reads Postmark and generic inbound JSON, filters attachments and finds the workspace", async () => {
    const { parseInbound, sameSecret, workspaceFromAddress } = await import("@/lib/intake/parse");
    expect(workspaceFromAddress("Finance <tb+acme-2025@in.example.com>")).toBe("acme-2025");
    expect(workspaceFromAddress("acme-ws@in.example.com")).toBe("acme-ws");
    const b64 = btoa("a,b\n1,2\n");
    const pm = parseInbound({ FromFull: { Email: "cfo@acme.eg" }, To: "tb+acme-2025@in.example.com", Subject: "March close", Attachments: [{ Name: "TB March.csv", ContentType: "text/csv", Content: b64 }, { Name: "virus.exe", Content: b64 }, { Name: "empty.pdf", Content: "" }] });
    expect(pm).toMatchObject({ from: "cfo@acme.eg", workspaceKey: "acme-2025", subject: "March close" });
    expect(pm.attachments.map((a) => a.fileName)).toEqual(["TB March.csv"]);
    expect(pm.attachments[0].size).toBe(8);
    expect(pm.skipped.map((s) => s.reason)).toEqual(["file type not accepted", "no readable content"]);
    const generic = parseInbound({ from: "a@b.c", to: "x@y.z", attachments: [{ filename: "ar.xlsx", content: b64 }] }, "Team-Key");
    expect(generic.workspaceKey).toBe("team-key");
    expect(sameSecret("abc", "abc")).toBe(true);
    expect(sameSecret("abc", "abd")).toBe(false);
    expect(sameSecret("", "")).toBe(false);
  });
});
