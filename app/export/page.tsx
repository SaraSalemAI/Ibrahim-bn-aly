"use client";

import Link from "next/link";
import { useState } from "react";
import { AiPanel } from "@/components/AiPanel";
import { exportExcel } from "@/components/exportExcel";
import { Banner, Card, NeedsData, Page } from "@/components/ui";
import { useL, useWorkspace } from "@/lib/workspace/store";

export default function ExportPage() {
  const { company } = useWorkspace();
  const L = useL();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <Page title={L("16 · Board pack & export engine", "١٦ · حزمة مجلس الإدارة والتصدير")} subtitle={L("Formula-intact Excel workbook and a printable bilingual board pack.", "ملف Excel بمعادلات حية وحزمة ثنائية اللغة قابلة للطباعة لمجلس الإدارة.")}>
      <NeedsData>
        {err && <Banner kind="error">{err}</Banner>}
        <div className="two-col">
          <Card title={L("Excel workbook (.xlsx)", "ملف Excel")}>
            <ul className="small">
              <li>{L("Cover sheet with the source TB hash", "صفحة غلاف مع بصمة ملف الميزان")}</li>
              <li>{L("Trial balance with =SUM totals and a zero check", "ميزان المراجعة بإجماليات =SUM واختبار الصفر")}</li>
              <li>{L("Income statement and balance sheet as SUMIFS formulas over the TB", "قائمة الدخل والمركز المالي كمعادلات SUMIFS على الميزان")}</li>
              <li>{L("Cash flow built from balance-sheet cell differences, with a tie-out check", "التدفقات النقدية من فروق خلايا المركز المالي مع اختبار المطابقة")}</li>
              <li>{L("Ratios as live formulas", "النسب كمعادلات حية")}</li>
              <li>{L("Fixed asset accounting-vs-tax schedule and Form 41 summary (when loaded)", "جدول الإهلاك المحاسبي مقابل الضريبي وملخص نموذج ٤١ (عند التحميل)")}</li>
            </ul>
            <button
              disabled={busy}
              onClick={async () => {
                if (!company) return;
                setBusy(true);
                setErr((await exportExcel(company)) ?? "");
                setBusy(false);
              }}
            >
              {busy ? L("Building…", "جارٍ الإعداد…") : L("Download workbook", "تنزيل الملف")}
            </button>
          </Card>
          <Card title={L("Board pack (PDF)", "حزمة مجلس الإدارة (PDF)")}>
            <p className="small">
              {L(
                "Opens a print-ready pack: cover, executive summary, KPIs, statements, cash-flow bridge, ratios and DuPont, scenarios, valuation football field, tax summary and notes. Use your browser's “Save as PDF”.",
                "تفتح حزمة جاهزة للطباعة: الغلاف، الملخص التنفيذي، المؤشرات، القوائم، جسر التدفقات، النسب ودوبونت، السيناريوهات، نطاقات التقييم، ملخص الضريبة، والإيضاحات. استخدم “حفظ كـ PDF” في المتصفح.",
              )}
            </p>
            <div className="actions">
              <Link className="button" href="/board-pack?lang=en" target="_blank">
                {L("Open English pack", "فتح النسخة الإنجليزية")}
              </Link>
              <Link className="button ghost" href="/board-pack?lang=ar" target="_blank">
                {L("Open Arabic pack", "فتح النسخة العربية")}
              </Link>
            </div>
          </Card>
        </div>
        <AiPanel module="export" />
      </NeedsData>
    </Page>
  );
}
