import { createRoot } from "react-dom/client";
import type { ComponentType } from "react";
import { Providers } from "../app/providers";
import { useRoute } from "./router";
import Overview from "../app/page";
import Agent from "../app/agent/page";
import Company from "../app/company/page";
import Ingest from "../app/ingest/page";
import Mapping from "../app/mapping/page";
import TrialBalance from "../app/trial-balance/page";
import Statements from "../app/statements/page";
import CashFlow from "../app/cash-flow/page";
import Budget from "../app/budget/page";
import Model from "../app/model/page";
import Analysis from "../app/analysis/page";
import Scenarios from "../app/scenarios/page";
import Tax from "../app/tax/page";
import Disclosures from "../app/disclosures/page";
import Benchmarking from "../app/benchmarking/page";
import Valuation from "../app/valuation/page";
import Stress from "../app/stress/page";
import Export from "../app/export/page";
import Audit from "../app/audit/page";
import BoardPack from "../app/board-pack/page";
import CloseReview from "../app/close-review/page";
import Trends from "../app/trends/page";
import Consolidation from "../app/consolidation/page";
import Team from "../app/team/page";

const ROUTES: Record<string, ComponentType> = {
  "/": Overview,
  "/agent": Agent,
  "/company": Company,
  "/ingest": Ingest,
  "/mapping": Mapping,
  "/trial-balance": TrialBalance,
  "/statements": Statements,
  "/cash-flow": CashFlow,
  "/budget": Budget,
  "/model": Model,
  "/analysis": Analysis,
  "/scenarios": Scenarios,
  "/tax": Tax,
  "/disclosures": Disclosures,
  "/benchmarking": Benchmarking,
  "/valuation": Valuation,
  "/stress": Stress,
  "/export": Export,
  "/audit": Audit,
  "/board-pack": BoardPack,
  "/close-review": CloseReview,
  "/trends": Trends,
  "/consolidation": Consolidation,
  "/team": Team,
};

function App() {
  const { path } = useRoute();
  const Page = ROUTES[path] ?? Overview;
  return (
    <Providers>
      <Page />
    </Providers>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
