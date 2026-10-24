"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { appendAudit, summarise } from "../finance/audit";
import { computeCompany, type Computed } from "./compute";
import { migrateCompany, newCompany, newWorkspace } from "./defaults";
import type { Company, Role, Workspace } from "./types";

const DB = "ai-cfo";
const STORE = "workspace";
const KEY = "current";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadWorkspace(): Promise<Workspace | null> {
  try {
    const db = await idb();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as Workspace) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveWorkspace(ws: Workspace): Promise<void> {
  try {
    const db = await idb();
    db.transaction(STORE, "readwrite").objectStore(STORE).put(ws, KEY);
  } catch {
    /* private mode or blocked storage: the workspace stays in memory only */
  }
}

export interface AuditInfo {
  action: string;
  entity: string;
  recordId?: string;
  reason?: string;
}

type Action =
  | { type: "load"; ws: Workspace }
  | { type: "setLang"; lang: "en" | "ar" }
  | { type: "setProfile"; name: string; role: Role }
  | { type: "addCompany"; company: Company }
  | { type: "selectCompany"; id: string }
  | { type: "deleteCompany"; id: string }
  | { type: "setBenchmarks"; benchmarks: Record<string, number | null> }
  | { type: "update"; companyId: string; audit: AuditInfo; recipe: (c: Company) => Company; allowWhenLocked?: boolean }
  | { type: "clearError" };

interface State {
  ws: Workspace;
  loaded: boolean;
  error: string | null;
}

function audit(ws: Workspace, companyId: string, a: AuditInfo, before?: unknown, after?: unknown): Workspace {
  return { ...ws, audit: appendAudit(ws.audit, { userId: ws.profile.name, role: ws.profile.role, companyId, ...a, before: summarise(before), after: summarise(after) }) };
}

function changedKeys(a: Company, b: Company): (keyof Company)[] {
  return (Object.keys(b) as (keyof Company)[]).filter((k) => a[k] !== b[k]);
}

function reducer(state: State, action: Action): State {
  const { ws } = state;
  switch (action.type) {
    case "load":
      return { ...state, loaded: true, ws: { ...newWorkspace(), ...action.ws, companies: action.ws.companies.map(migrateCompany) } };
    case "setLang":
      return { ...state, ws: { ...ws, lang: action.lang } };
    case "setProfile":
      return { ...state, ws: audit({ ...ws, profile: { name: action.name, role: action.role } }, "-", { action: "profile.update", entity: "profile" }, ws.profile, { name: action.name, role: action.role }) };
    case "addCompany":
      return { ...state, ws: audit({ ...ws, companies: [...ws.companies, action.company], activeCompanyId: action.company.id }, action.company.id, { action: "company.create", entity: "companies", recordId: action.company.id }) };
    case "selectCompany":
      return { ...state, ws: { ...ws, activeCompanyId: action.id } };
    case "deleteCompany": {
      const companies = ws.companies.filter((c) => c.id !== action.id);
      return { ...state, ws: audit({ ...ws, companies, activeCompanyId: companies[0]?.id ?? null }, action.id, { action: "company.delete", entity: "companies", recordId: action.id }) };
    }
    case "setBenchmarks":
      return { ...state, ws: audit({ ...ws, benchmarks: action.benchmarks }, "-", { action: "benchmarks.update", entity: "benchmarks" }) };
    case "clearError":
      return { ...state, error: null };
    case "update": {
      const c = ws.companies.find((x) => x.id === action.companyId);
      if (!c) return state;
      if (c.period.status === "LOCKED" && !action.allowWhenLocked) {
        return { ...state, error: "periodLocked" };
      }
      const next = action.recipe(c);
      if (next === c) return state;
      const keys = changedKeys(c, next);
      const pick = (o: Company) => Object.fromEntries(keys.map((k) => [k, o[k]]));
      const companies = ws.companies.map((x) => (x.id === c.id ? next : x));
      return { ...state, error: null, ws: audit({ ...ws, companies }, c.id, action.audit, pick(c), pick(next)) };
    }
  }
}

interface Ctx {
  ws: Workspace;
  loaded: boolean;
  error: string | null;
  company: Company | null;
  computed: Computed | null;
  dispatch: (a: Action) => void;
  update: (audit: AuditInfo, recipe: (c: Company) => Company, opts?: { allowWhenLocked?: boolean }) => void;
  locked: boolean;
}

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { ws: newWorkspace(), loaded: false, error: null });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadWorkspace().then((ws) => dispatch({ type: "load", ws: ws ?? newWorkspace() }));
  }, []);

  useEffect(() => {
    if (!state.loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveWorkspace(state.ws), 300);
  }, [state.ws, state.loaded]);

  useEffect(() => {
    document.documentElement.lang = state.ws.lang;
    document.documentElement.dir = state.ws.lang === "ar" ? "rtl" : "ltr";
  }, [state.ws.lang]);

  const company = state.ws.companies.find((c) => c.id === state.ws.activeCompanyId) ?? null;
  const computed = useMemo(() => (company ? computeCompany(company) : null), [company]);
  const update = useCallback(
    (audit: AuditInfo, recipe: (c: Company) => Company, opts?: { allowWhenLocked?: boolean }) => {
      if (company) dispatch({ type: "update", companyId: company.id, audit, recipe, allowWhenLocked: opts?.allowWhenLocked });
    },
    [company],
  );

  const value: Ctx = { ...state, company, computed, dispatch, update, locked: company?.period.status === "LOCKED" };
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside WorkspaceProvider");
  return ctx;
}

/** Inline bilingual strings: L("Revenue", "الإيرادات"). */
export function useL() {
  const { ws } = useWorkspace();
  return useCallback((en: string, ar: string) => (ws.lang === "ar" ? ar : en), [ws.lang]);
}

export function useFormat() {
  const { ws, company } = useWorkspace();
  const locale = ws.lang === "ar" ? "ar-EG-u-nu-latn" : "en-EG";
  const ccy = company?.settings.presentationCurrency ?? "EGP";
  return useMemo(() => {
    const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const n = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : nf.format(v));
    return {
      n,
      money: (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${n(v)} ${ccy}`),
      pct: (v: number | null | undefined, dp = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v.toFixed(dp)}%`),
      x: (v: number | null | undefined, dp = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v.toFixed(dp)}×`),
      ccy,
      locale,
    };
  }, [locale, ccy]);
}

export { newCompany };
