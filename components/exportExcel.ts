import { saveFile } from "./ui";
import type { Company } from "@/lib/workspace/types";

export async function exportExcel(company: Company): Promise<string | null> {
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company: { ...company, subledgers: { ...company.subledgers, gl: [], bank: [] } } }),
  });
  if (!res.ok) return (await res.json().catch(() => ({}))).message ?? `HTTP ${res.status}`;
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "export.xlsx";
  await saveFile(name, blob);
  return null;
}
