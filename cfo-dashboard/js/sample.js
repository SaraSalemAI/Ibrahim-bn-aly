/* Example statements shown before the user drops their own files.
 * Fictional company, EGP thousands. Balance sheet balances; cash flow reconciles to cash. */
(function (CFO) {
  const H = ['Line item', '2022', '2023', '2024'];
  const SAMPLE = {
    'income-statement.csv': [H,
      ['Revenue', 50000, 58000, 61000],
      ['Cost of sales', -30000, -35960, -39650],
      ['Gross profit', 20000, 22040, 21350],
      ['Selling, general and administrative expenses', -11000, -12760, -14030],
      ['Depreciation and amortization', -2000, -2300, -2600],
      ['Operating income', 7000, 6980, 4720],
      ['Finance costs', -1200, -1900, -2800],
      ['Profit before tax', 5800, 5080, 1920],
      ['Income tax expense', -1305, -1143, -432],
      ['Net income', 4495, 3937, 1488]],
    'balance-sheet.csv': [H,
      ['Cash and cash equivalents', 6000, 4200, 2100],
      ['Trade receivables', 8000, 11500, 15800],
      ['Inventories', 7000, 8900, 11200],
      ['Prepayments and other current assets', 1000, 1100, 1200],
      ['Total current assets', 22000, 25700, 30300],
      ['Property, plant and equipment', 28000, 31000, 33500],
      ['Intangible assets', 2000, 2000, 2000],
      ['Total assets', 52000, 58700, 65800],
      ['Trade payables', 5000, 6200, 8900],
      ['Short-term borrowings', 4000, 6500, 10000],
      ['Accruals and other current liabilities', 2000, 2300, 2600],
      ['Total current liabilities', 11000, 15000, 21500],
      ['Long-term borrowings', 12000, 14500, 16500],
      ['Total liabilities', 23000, 29500, 38000],
      ['Share capital', 15000, 15000, 15000],
      ['Retained earnings', 14000, 14200, 12800],
      ["Total shareholders' equity", 29000, 29200, 27800],
      ['Total liabilities and equity', 52000, 58700, 65800]],
    'cash-flow.csv': [H,
      ['Net cash from operating activities', 5500, 2237, 388],
      ['Purchase of property, plant and equipment', -4000, -5300, -5100],
      ['Net cash used in investing activities', -4000, -5300, -5100],
      ['Proceeds from borrowings', 1500, 5000, 5500],
      ['Dividends paid', -2500, -3737, -2888],
      ['Net cash from financing activities', -1000, 1263, 2612],
      ['Net change in cash', 500, -1800, -2100]],
  };

  CFO.SAMPLE = SAMPLE;
  CFO.sampleTables = () => Object.entries(SAMPLE).map(([source, rows]) => ({ source, ...CFO.rowsToLines(rows) }));
})(globalThis.CFO = globalThis.CFO || {});
