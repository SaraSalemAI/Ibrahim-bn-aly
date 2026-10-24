import ExcelJS from "exceljs";

export const runtime = "nodejs";

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return cellText(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    return "";
  }
  return String(v);
}

const csvCell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Converts the first worksheet of an uploaded .xlsx to CSV so every parser works on one format. */
export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 25 * 1024 * 1024) return Response.json({ error: "tooLarge", message: "File is larger than 25 MB." }, { status: 413 });
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await req.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) return Response.json({ error: "badRequest", message: "Workbook has no sheets." }, { status: 400 });
    const lines: string[] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      for (let i = 1; i <= ws.columnCount; i++) cells.push(csvCell(cellText(row.getCell(i).value)));
      lines.push(cells.join(","));
    });
    return new Response(lines.join("\n") + "\n", { headers: { "Content-Type": "text/csv; charset=utf-8", "X-Sheet-Name": encodeURIComponent(ws.name) } });
  } catch (e) {
    return Response.json({ error: "badRequest", message: `Could not read the workbook: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 });
  }
}
