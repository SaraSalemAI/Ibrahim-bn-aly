import type { ComponentType } from 'react';
import type { Page } from '../state';
import { Upload, Requirements, Quality } from './Data';
import { Overview, CfoDashboard, CommitteeDashboard, QualityCheck } from './Dashboards';
import { FindingsPage } from './Findings';
import { Tests, Sites, Recon, FinancialStatements, Fraud } from './Analytics';
import { Risks, Controls, Universe } from './RiskControl';
import { Recommendations, Actions, ChangeMonitor } from './FollowUp';
import { Copilot } from './Copilot';
import { Reports } from './Reports';
import { Trail, SettingsPage } from './Admin';

export const pages: Record<Page, ComponentType> = {
  upload: Upload, requirements: Requirements, quality: Quality,
  overview: Overview, cfo: CfoDashboard, committee: CommitteeDashboard, qc: QualityCheck,
  findings: FindingsPage, tests: Tests, sites: Sites, recon: Recon, fs: FinancialStatements, fraud: Fraud,
  risks: Risks, controls: Controls, universe: Universe,
  recommendations: Recommendations, actions: Actions, change: ChangeMonitor,
  copilot: Copilot, reports: Reports, trail: Trail, settings: SettingsPage,
};
