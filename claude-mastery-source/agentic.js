DEEP.agentic={icon:"⚡",t:T("Agentic finance & business A–Z","المالية والبيزنس الوكيلي من الألف للياء"),sub:T("Cowork, Claude Code, automation, APIs and MCP — with full master prompts.","Cowork و Claude Code والأتمتة والـ API و MCP — ببرومبتات ماستر كاملة."),
sections:[
{h:T("Pick the right agentic surface","اختار الأداة الوكيلية الصح"),b:T(`<table><tr><th>You want to…</th><th>Use</th><th>Why</th></tr>
<tr><td>Process a folder of files, produce reports, no code</td><td>Cowork</td><td>Works on local files and connectors with approvals</td></tr>
<tr><td>Run it every week</td><td>Cowork scheduled task</td><td>Repeats without you</td></tr>
<tr><td>Build a reusable tool, script or app</td><td>Claude Code</td><td>Writes, tests and versions code</td></tr>
<tr><td>Embed Claude in your own system at scale</td><td>Claude API / Agent SDK</td><td>Full control, batches, structured outputs</td></tr>
<tr><td>Let Claude read/write your ERP, CRM or database</td><td>MCP connector</td><td>One standard interface for every Claude surface</td></tr>
<tr><td>Act on websites with no API</td><td>Chrome / computer use</td><td>Last resort, with supervision</td></tr></table>`,`<table><tr><th>عايز…</th><th>استخدم</th><th>ليه</th></tr>
<tr><td>تعالج فولدر ملفات وتطلّع تقارير من غير كود</td><td>Cowork</td><td>بيشتغل على ملفاتك و Connectors بموافقات</td></tr>
<tr><td>تشغّلها كل أسبوع</td><td>مهمة Cowork مجدولة</td><td>بتتكرر من غيرك</td></tr>
<tr><td>تبني أداة أو سكريبت أو تطبيق يتعاد استخدامه</td><td>Claude Code</td><td>بيكتب ويختبر ويحفظ نسخ الكود</td></tr>
<tr><td>تدخّل Claude في نظامك على نطاق واسع</td><td>Claude API / Agent SDK</td><td>تحكم كامل، Batches، مخرجات مهيكلة</td></tr>
<tr><td>تخلي Claude يقرا/يكتب في الـ ERP أو CRM أو قاعدة بيانات</td><td>MCP connector</td><td>واجهة واحدة لكل أدوات Claude</td></tr>
<tr><td>تشتغل على مواقع مفيهاش API</td><td>Chrome / استخدام الكمبيوتر</td><td>آخر حل، وتحت إشراف</td></tr></table>`)},
{h:T("Calling the API (Python)","استدعاء الـ API (Python)"),b:T(`<pre dir="ltr" class="codeblk">pip install anthropic
export ANTHROPIC_API_KEY=...   # never in a published page

import anthropic
client = anthropic.Anthropic()
msg = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=2000,
    system="You are an FP&A analyst. Currency EGP thousands.",
    messages=[{"role": "user", "content": "Summarise the variance table below…"}],
)
print(msg.content[0].text)</pre><p>Add <b>structured outputs</b> when another system reads the result, <b>prompt caching</b> for long repeated system prompts, and the <b>Batches API</b> (50% off) for overnight bulk jobs.</p>`,`<pre dir="ltr" class="codeblk">pip install anthropic
export ANTHROPIC_API_KEY=...   # never in a published page

import anthropic
client = anthropic.Anthropic()
msg = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=2000,
    system="You are an FP&A analyst. Currency EGP thousands.",
    messages=[{"role": "user", "content": "Summarise the variance table below…"}],
)
print(msg.content[0].text)</pre><p>ضيف <b>المخرجات المهيكلة</b> لما نظام تاني هيقرا النتيجة، و<b>التخزين المؤقت</b> للبرومبتات الطويلة المتكررة، و<b>Batches API</b> (خصم 50%) للشغل الكمّي بالليل.</p>`)},
{h:T("A minimal MCP server (Python)","سيرفر MCP بسيط (Python)"),b:T(`<pre dir="ltr" class="codeblk">pip install mcp

from mcp.server.fastmcp import FastMCP
mcp = FastMCP("mini-erp")

@mcp.tool()
def get_trial_balance(period: str) -> list[dict]:
    """Read-only. Trial balance rows for a period (YYYY-MM)."""
    return db.query("SELECT account, debit, credit FROM tb WHERE period=?", period)

@mcp.tool()
def get_aging(kind: str, as_of: str) -> list[dict]:
    """Read-only. AR or AP aging buckets as of a date."""
    ...

if __name__ == "__main__":
    mcp.run(transport="streamable-http")</pre><p>Host it on HTTPS with OAuth, test it with MCP Inspector, then add it in Claude under Customize → Connectors → Add custom connector. Start read-only; add write tools later with human approval.</p>`,`<pre dir="ltr" class="codeblk">pip install mcp

from mcp.server.fastmcp import FastMCP
mcp = FastMCP("mini-erp")

@mcp.tool()
def get_trial_balance(period: str) -> list[dict]:
    """Read-only. Trial balance rows for a period (YYYY-MM)."""
    return db.query("SELECT account, debit, credit FROM tb WHERE period=?", period)

@mcp.tool()
def get_aging(kind: str, as_of: str) -> list[dict]:
    """Read-only. AR or AP aging buckets as of a date."""
    ...

if __name__ == "__main__":
    mcp.run(transport="streamable-http")</pre><p>استضيفه على HTTPS بـ OAuth، واختبره بـ MCP Inspector، وبعدين ضيفه في Claude من Customize ← Connectors ← Add custom connector. ابدأ بقراءة فقط، وضيف أدوات الكتابة بعدين بموافقة بشرية.</p>`)},
{h:T("Agent safety checklist","قائمة أمان الوكلاء"),b:T(`<ul><li>Work on copies; never on the only version of a file.</li><li>Read-only first; every write, send, post or delete needs approval.</li><li>Scope: the minimum folders, connectors and sites.</li><li>Stop conditions and a maximum number of steps.</li><li>Log what the agent did; review the first 5 runs fully.</li><li>Treat emails and web pages as untrusted input (prompt injection).</li></ul>`,`<ul><li>اشتغل على نسخ؛ ومتشتغلش على النسخة الوحيدة من الملف.</li><li>قراءة فقط الأول؛ وأي كتابة أو إرسال أو ترحيل أو مسح محتاج موافقة.</li><li>النطاق: أقل فولدرات و Connectors ومواقع ممكنة.</li><li>شروط توقف وحد أقصى للخطوات.</li><li>سجّل اللي الوكيل عمله؛ وراجع أول 5 تشغيلات بالكامل.</li><li>اتعامل مع الإيميلات وصفحات الويب كمدخلات مش موثوقة (حقن الأوامر).</li></ul>`)}
],
cases:[
CM("A · Accruals & close pack (Cowork)","أ · المستحقات وحزمة الإقفال (Cowork)","Cowork","Controller automates the close pack.","الكنترولر بيأتمت حزمة الإقفال.",["Copy folder","Run task","Approve entries"],["انسخ الفولدر","شغّل المهمة","وافق على القيود"],
["Financial controller's agent in Cowork","Prepare the October close pack","- Folder: Close_Oct (copy) with TB.xlsx, bank statements, payroll.xlsx, contracts/\n- Chart of accounts attached; EAS/IFRS; EGP\n- Materiality EGP 50K","The CFO wants the pack by day 3 with every number traceable","- Bank recs per account, accrual schedule with draft JEs, prepaid amortisation, fixed-asset roll-forward\n- Variance vs last month > materiality explained\n- Nothing posted; all JEs marked DRAFT","Files in /Close_Oct/output: Recs.xlsx, Accruals.xlsx, JE_drafts.xlsx, Close_Memo.docx. Show me the plan before step 1; ask before creating anything outside output/."],
["وكيل الكنترولر في Cowork","جهّز حزمة إقفال أكتوبر","- الفولدر: Close_Oct (نسخة) فيه TB.xlsx وكشوف البنوك و payroll.xlsx و contracts/\n- دليل الحسابات مرفق؛ معايير مصرية/IFRS؛ جنيه\n- الأهمية النسبية 50 ألف جنيه","المدير المالي عايز الحزمة يوم 3 وكل رقم ليه مصدر","- مطابقة لكل بنك، جدول مستحقات بقيود مقترحة، إطفاء المدفوع مقدماً، حركة الأصول الثابتة\n- شرح أي انحراف عن الشهر اللي فات أكبر من الأهمية النسبية\n- مفيش ترحيل؛ وكل القيود DRAFT","الملفات في /Close_Oct/output: Recs.xlsx و Accruals.xlsx و JE_drafts.xlsx و Close_Memo.docx. وريني الخطة قبل أول خطوة؛ واسأل قبل أي حاجة برّه output/."]),
CM("B · Budget consolidation (Cowork)","ب · تجميع الموازنات (Cowork)","Cowork","12 department budget files in different formats.","12 ملف موازنة إدارات بأشكال مختلفة.",["Collect files","Standardise","Consolidate + gaps"],["اجمع الملفات","وحّد الشكل","جمّع والفجوات"],
["FP&A agent","Consolidate department budgets into the group template","- Folder Budget_2027 with 12 files (different layouts)\n- Template.xlsx is the target; mapping rules in mapping.md\n- Group guidelines: salary increase 15%, FX 52","The board pack needs one consolidated view and a list of what departments must fix","- All 12 mapped into the template with a source column\n- Checks: totals tie to each source file\n- Breaches of guidelines listed per department","Consolidated.xlsx + Issues_by_department.xlsx + a draft email per department (not sent)."],
["وكيل FP&A","جمّع موازنات الإدارات في قالب المجموعة","- فولدر Budget_2027 فيه 12 ملف (بأشكال مختلفة)\n- Template.xlsx هو الهدف؛ وقواعد الربط في mapping.md\n- إرشادات المجموعة: زيادة مرتبات 15%، صرف 52","حزمة المجلس محتاجة صورة مجمّعة واحدة وقائمة باللي الإدارات لازم تصلحه","- الـ 12 متربطين في القالب بعمود مصدر\n- ضوابط: الإجماليات مطابقة لكل ملف مصدر\n- مخالفات الإرشادات لكل إدارة","Consolidated.xlsx + Issues_by_department.xlsx + مسودة إيميل لكل إدارة (من غير إرسال)."]),
CM("C · Investment screener (Claude Code)","ج · فرز الاستثمارات (Claude Code)","Claude Code","Analyst screens EGX stocks weekly.","محلل بيفرز أسهم البورصة المصرية أسبوعياً.",["Data source","Build screener","Schedule"],["مصدر البيانات","ابني الفرز","جدوله"],
["Quant developer and equity analyst","Build a stock screener for the Egyptian market","- Input: CSV of prices and fundamentals you will provide weekly (no scraping)\n- Metrics: P/E, P/B, ROE, debt/equity, 3-month momentum, liquidity\n- Python, pandas; output an HTML report","The investment committee wants a consistent weekly shortlist","- Configurable filters in config.yaml\n- Unit tests for each metric\n- Report with ranking, charts and a disclaimer that it is not investment advice","/plan first. Then code, tests, README, CLAUDE.md with run commands, and a sample report from test data."],
["مطوّر كمّي ومحلل أسهم","ابني أداة فرز أسهم للسوق المصري","- المدخلات: CSV أسعار وأساسيات هتديهولي كل أسبوع (من غير سحب من مواقع)\n- المؤشرات: مكرر الربحية، القيمة الدفترية، العائد على حقوق الملكية، الدين/حقوق الملكية، زخم 3 شهور، السيولة\n- Python و pandas؛ والناتج تقرير HTML","لجنة الاستثمار عايزة قائمة أسبوعية متسقة","- فلاتر قابلة للتعديل في config.yaml\n- اختبارات لكل مؤشر\n- تقرير بترتيب ورسوم وتنويه إنه مش نصيحة استثمارية","/plan الأول. وبعدين الكود والاختبارات و README و CLAUDE.md بأوامر التشغيل، وتقرير عينة من بيانات اختبار."]),
CM("D · Bank-statement parser (Claude Code)","د · قارئ كشوف البنوك (Claude Code)","Claude Code","Five banks, five formats.","5 بنوك و5 أشكال.",["Sample statements","Parsers + tests","Matching"],["كشوف عينة","المحللات والاختبارات","المطابقة"],
["Senior Python engineer in finance automation","Build parsers for 5 bank statement formats and a matcher to the GL","- Samples in ./samples (PDF, CSV, MT940)\n- Arabic-Indic digits and Hijri/Gregorian dates possible\n- Match rules: amount ±0.01, date ±3 days, reference contains","Reconciliation takes 2 days a month","- Each parser has tests from the samples\n- Unmatched items explained\n- Decimal used for money; logs kept","/plan, code, tests, CLAUDE.md, and a one-command run script."],
["مهندس Python أول في أتمتة المالية","ابني محللات لـ 5 أشكال كشوف بنوك ومطابق مع الأستاذ العام","- العينات في ./samples (PDF و CSV و MT940)\n- ممكن أرقام عربية وتواريخ هجري/ميلادي\n- قواعد المطابقة: المبلغ ±0.01، التاريخ ±3 أيام، المرجع يحتوي","المطابقة بتاخد يومين كل شهر","- كل محلل ليه اختبارات من العينات\n- البنود غير المتطابقة مشروحة\n- Decimal للفلوس والسجلات محفوظة","/plan، الكود، الاختبارات، CLAUDE.md، وسكريبت تشغيل بأمر واحد."]),
CM("E · Weekly cash forecast (automation)","هـ · توقع النقدية الأسبوعي (أتمتة)","Cowork schedule","Treasury needs Monday cash view.","الخزينة محتاجة صورة النقدية يوم الإتنين.",["Sources","Schedule","Review"],["المصادر","الجدولة","المراجعة"],
["Treasury analyst agent (scheduled every Monday 07:00)","Update the 13-week cash forecast","- Inputs: AR_aging.xlsx, AP_aging.xlsx, bank balances export, payroll calendar, loan schedule (folder Treasury)\n- Minimum cash EGP 5M","The CFO decides weekly on payments and drawdowns","- Forecast rolled forward one week; actuals replace last week's forecast\n- Forecast accuracy vs actual shown\n- Weeks below minimum flagged with options","Cash13w_[date].xlsx + a 10-line summary posted as a draft email to the CFO."],
["وكيل محلل خزينة (مجدول كل إتنين 7 الصبح)","حدّث توقع النقدية لـ 13 أسبوع","- المدخلات: AR_aging.xlsx و AP_aging.xlsx وأرصدة البنوك ومواعيد المرتبات وجدول القروض (فولدر Treasury)\n- الحد الأدنى للنقدية 5 مليون جنيه","المدير المالي بيقرر كل أسبوع في المدفوعات والسحوبات","- التوقع اتحرك أسبوع؛ والفعلي مكان توقع الأسبوع اللي فات\n- دقة التوقع مقابل الفعلي\n- الأسابيع اللي تحت الحد متعلّمة ببدائل","Cash13w_[التاريخ].xlsx + ملخص 10 سطور كمسودة إيميل للمدير المالي."]),
CM("F · Invoice extraction at scale (API)","و · استخراج الفواتير بالجملة (API)","API · Batches","20,000 supplier invoices a year.","20 ألف فاتورة مورد في السنة.",["Schema","Batch job","Exceptions"],["الـ Schema","المهمة الدفعية","الاستثناءات"],
["AI engineer building a finance pipeline","Design and code an invoice-extraction pipeline on the Claude API","- PDFs land in cloud storage nightly\n- Use structured outputs with a JSON schema (invoice_no, date, supplier, tax_id, lines[], subtotal, VAT, total, currency)\n- Use the Batches API overnight; validate totals; route failures to a review queue","Cut AP data entry by 80% with auditable results","- Schema and validation rules documented\n- Cost estimate per 1,000 invoices\n- Accuracy measured on 100 labelled invoices","Architecture note, Python code, tests and a runbook."],
["مهندس AI بيبني خط معالجة مالي","صمّم واكتب خط استخراج فواتير على Claude API","- ملفات PDF بتوصل التخزين السحابي كل ليلة\n- مخرجات مهيكلة بـ JSON schema (رقم الفاتورة، التاريخ، المورد، الرقم الضريبي، البنود، قبل الضريبة، الضريبة، الإجمالي، العملة)\n- Batches API بالليل؛ تحقق من الإجماليات؛ والفاشل يروح طابور مراجعة","نقلل إدخال الموردين 80% بنتايج قابلة للمراجعة","- الـ Schema وقواعد التحقق موثقة\n- تقدير التكلفة لكل 1000 فاتورة\n- الدقة متقاسة على 100 فاتورة معلّمة","ملاحظة معمارية، كود Python، اختبارات ودليل تشغيل."]),
CM("G · Financial-report Q&A API","ز · API أسئلة التقارير المالية","API · citations","Investor-relations bot for annual reports.","مساعد علاقات مستثمرين للتقارير السنوية.",["Documents","Citations","Guardrails"],["المستندات","الاستشهادات","الضوابط"],
["Investor-relations engineer","Build an endpoint that answers questions about our annual reports with citations","- Annual reports 2022–2025 (PDF)\n- Use PDF support + citations; prompt caching for the documents\n- Arabic and English questions","Answers must be traceable for disclosure rules","- Every answer has cited passages\n- Refuses forward-looking promises and non-public data\n- Logs question, answer and cited pages","FastAPI endpoint, system prompt, tests with 25 questions, and a cost note."],
["مهندس علاقات مستثمرين","ابني endpoint بيجاوب على أسئلة التقارير السنوية باستشهادات","- التقارير السنوية 2022–2025 (PDF)\n- استخدم دعم PDF والاستشهادات؛ والتخزين المؤقت للمستندات\n- أسئلة عربي وإنجليزي","الإجابات لازم يبقى ليها مصدر بسبب قواعد الإفصاح","- كل إجابة فيها مقاطع مستشهد بيها\n- يرفض الوعود المستقبلية والمعلومات غير المعلنة\n- يسجّل السؤال والإجابة والصفحات","FastAPI endpoint، system prompt، اختبارات بـ 25 سؤال، وملاحظة تكلفة."]),
CM("H · CFO assistant over ERP + CRM (MCP)","ح · مساعد المدير المالي على ERP و CRM (MCP)","MCP · Connectors","Plain-language questions across systems.","أسئلة بلغة عادية عبر الأنظمة.",["Connect","Ask","Act with approval"],["وصّل","اسأل","نفّذ بموافقة"],
["CFO's analyst with ERP (custom MCP) and HubSpot connectors","Answer cross-system questions and propose actions","- ERP tools: trial balance, aging, invoices\n- CRM: deals, pipeline stage, expected close\n- Question: Which customers are >90 days overdue but have open deals > EGP 1M?","Sales and finance must align before quarter-end","- Join results by customer\n- Risk per customer with amounts\n- Proposed action per customer (call, hold delivery, escalate) — no action executed","Table + chart + 5 recommended actions for my approval."],
["محلل المدير المالي بـ Connectors للـ ERP (MCP مخصص) و HubSpot","جاوب أسئلة عابرة للأنظمة واقترح إجراءات","- أدوات الـ ERP: ميزان المراجعة، الأعمار، الفواتير\n- الـ CRM: الصفقات، المرحلة، تاريخ الإغلاق المتوقع\n- السؤال: مين العملاء المتأخرين أكتر من 90 يوم وعندهم صفقات مفتوحة أكبر من مليون جنيه؟","المبيعات والمالية لازم يتفقوا قبل آخر الربع","- ربط النتايج بالعميل\n- المخاطر لكل عميل بالمبالغ\n- إجراء مقترح لكل عميل (اتصال، إيقاف توريد، تصعيد) — من غير تنفيذ","جدول + رسم + 5 إجراءات مقترحة لموافقتي."]),
CM("I · Build a finance MCP server","ط · ابني سيرفر MCP مالي","Claude Code · mcp-builder","Expose your data warehouse safely.","اعرض مستودع بياناتك بأمان.",["Design tools","Build","Register connector"],["صمّم الأدوات","ابني","سجّل الـ Connector"],
["MCP developer using the mcp-builder skill","Build a read-only MCP server over the finance data warehouse","- Postgres views: v_gl, v_ar_aging, v_ap_aging, v_budget\n- Tools: query_kpi(name, period), get_variance(entity, period), list_overdue(days)\n- Auth: OAuth; row-level security per user","Analysts want answers in Claude without SQL","- Tool descriptions precise; all readOnlyHint\n- SQL parameterised; no free-text SQL tool\n- Tested in MCP Inspector and in Claude","/plan, then code, tests, deployment notes and the custom-connector setup steps."],
["مطوّر MCP بيستخدم Skill اسمها mcp-builder","ابني سيرفر MCP للقراءة بس على مستودع البيانات المالية","- Views في Postgres: v_gl و v_ar_aging و v_ap_aging و v_budget\n- الأدوات: query_kpi(name, period)، get_variance(entity, period)، list_overdue(days)\n- الدخول: OAuth؛ وأمان على مستوى الصف لكل مستخدم","المحللين عايزين إجابات في Claude من غير SQL","- أوصاف الأدوات دقيقة؛ وكلها readOnlyHint\n- SQL بمعاملات؛ ومفيش أداة SQL حر\n- متجرب في MCP Inspector وفي Claude","/plan، وبعدين الكود والاختبارات وملاحظات النشر وخطوات إعداد الـ Connector."])
]};
