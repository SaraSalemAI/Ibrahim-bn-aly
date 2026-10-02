const T=(en,ar)=>({en,ar});
const DAYS=[
{n:1,icon:"◆",t:T("Foundations: models, plans & prompting","الأساسيات: الموديلات والخطط وفن البرومبت"),
 sub:T("Know which Claude to use, and how to talk to it.","اعرف تستخدم أنهي Claude، وإزاي تكلّمه صح."),
 units:[
 {id:"1.1",tag:"core",dur:"40",t:T("What Claude is in 2026 — the whole map","يعني إيه Claude في 2026 — الخريطة كاملة"),
  body:T(`<p>Claude is no longer one chatbot. It is a family of connected surfaces that share your account, your Skills, your Plugins and your Connectors.</p>
<ul><li><b>Claude app</b> (web, desktop, mobile) — chat and agentic work (Cowork) are now one experience since 16 Sep 2026. Claude decides whether a request needs a quick answer or a multi-step task.</li>
<li><b>Deliverables</b> — Artifacts, Claude Docs, Claude Slides (beta), Claude Design, and real files (xlsx, docx, pptx, pdf).</li>
<li><b>Where you already work</b> — Claude for Excel, PowerPoint, Word (GA on paid plans), Outlook (beta), Claude in Chrome (GA since 26 Aug 2026), Claude Tag in Slack (Team/Enterprise, beta).</li>
<li><b>Extend it</b> — Projects, Memory, Styles, Skills, Plugins, Connectors (MCP).</li>
<li><b>Build with it</b> — Claude Code, the Claude Platform API, Agent SDK, Managed Agents.</li></ul>
<p class="note">Status verified end of September 2026. Many features are in beta and change fast — re-check claude.com/pricing and the release notes before each cohort.</p>`,
`<p>Claude مبقاش شات بوت واحد. بقى عيلة كاملة من الأدوات المتوصلة ببعض، وكلها شايفة حسابك والـ Skills والـ Plugins والـ Connectors بتوعك.</p>
<ul><li><b>تطبيق Claude</b> (ويب وديسكتوب وموبايل) — الشات والـ Cowork بقوا تجربة واحدة من 16 سبتمبر 2026، وClaude بنفسه بيقرر الطلب محتاج رد سريع ولا مهمة متعددة الخطوات.</li>
<li><b>المخرجات</b> — Artifacts و Claude Docs و Claude Slides (بيتا) و Claude Design، وملفات حقيقية (xlsx و docx و pptx و pdf).</li>
<li><b>جوه الأدوات اللي بتشتغل عليها</b> — Claude for Excel و PowerPoint و Word (متاحين على الخطط المدفوعة)، Outlook (بيتا)، Claude in Chrome (متاح من 26 أغسطس 2026)، Claude Tag في Slack (Team/Enterprise بيتا).</li>
<li><b>توسّعه</b> — Projects و Memory و Styles و Skills و Plugins و Connectors (MCP).</li>
<li><b>تبني بيه</b> — Claude Code و Claude Platform API و Agent SDK و Managed Agents.</li></ul>
<p class="note">المعلومات متراجعة آخر سبتمبر 2026. حاجات كتير لسه بيتا وبتتغير بسرعة — راجع claude.com/pricing قبل كل دفعة تدريب.</p>`),
  steps:T(["Open claude.ai and sign in","Check your plan under Settings → Billing","Open Settings → Capabilities and note what is on (code execution, web search, memory)","Open Customize and look at Skills, Plugins and Connectors","Install the desktop app for full Cowork (folders, computer use)"],
  ["افتح claude.ai وسجّل دخول","شوف خطتك من Settings ← Billing","افتح Settings ← Capabilities واعرف إيه المتفعّل (تنفيذ الكود، البحث، الذاكرة)","افتح Customize وبص على Skills و Plugins و Connectors","نزّل تطبيق الديسكتوب علشان Cowork الكامل (الفولدرات واستخدام الكمبيوتر)"]),
  tips:T(["Treat Claude as a team member with tools, not a search box.","Turn on code execution — it unlocks real Excel, Word and PowerPoint files."],["اتعامل مع Claude كزميل عنده أدوات، مش محرك بحث.","فعّل تنفيذ الكود — ده اللي بيطلّعلك ملفات Excel و Word و PowerPoint حقيقية."]),
  cases:[{t:T("Finance team onboarding","تجهيز فريق مالي"),d:T("A CFO maps each team member to the right surface: analysts in Claude for Excel, controllers in Cowork for month-end, the CFO in Slides for board packs.","المدير المالي بيوزّع كل فرد على الأداة الصح: المحللين في Claude for Excel، الكنترولرز في Cowork لإقفال الشهر، والـ CFO في Slides لعروض المجلس.")}],
  prompts:[{t:T("Personal capability audit","مراجعة القدرات حسب شغلي"),p:T(`I work as [role] in [industry] in [Egypt/KSA/UAE]. List my 10 most repetitive weekly tasks (ask me if unsure), then map each one to the best Claude surface (chat, Projects, Skills, Cowork, Claude for Excel, PowerPoint, Chrome, Slack, Claude Code). Return a table: Task | Surface | Why | First prompt to try | Time saved per week.`,`أنا شغال [الوظيفة] في [المجال] في [مصر/السعودية/الإمارات]. اكتبلي أكتر 10 مهام بتتكرر معايا كل أسبوع (اسألني لو مش متأكد)، وبعدين وزّع كل مهمة على أنسب أداة في Claude (الشات، Projects، Skills، Cowork، Claude for Excel، PowerPoint، Chrome، Slack، Claude Code). الناتج جدول: المهمة | الأداة | ليه | أول برومبت أجربه | الوقت الموفّر في الأسبوع.`)}],
  doc:"https://claude.com/blog/cowork-is-now-claude"},
 {id:"1.2",tag:"core",dur:"35",t:T("Models: Haiku, Sonnet, Opus, Fable","الموديلات: Haiku و Sonnet و Opus و Fable"),
  body:T(`<table><tr><th>Model</th><th>Context</th><th>API $ in/out per M tokens</th><th>Use it for</th></tr>
<tr><td>Haiku 4.5</td><td>200K</td><td>1 / 5</td><td>High-volume, low-risk: classify, tag, short drafts</td></tr>
<tr><td>Sonnet 5.5</td><td>1M</td><td>2 / 10</td><td>Your everyday default: analysis, reports, dashboards</td></tr>
<tr><td>Opus 5.5</td><td>1M</td><td>4 / 20</td><td>Complex models, long agentic tasks, multi-file reviews</td></tr>
<tr><td>Fable 5.1</td><td>1M</td><td>10 / 50</td><td>The hardest reasoning when Opus falls short</td></tr></table>
<p><b>Adaptive thinking:</b> newer models decide how much to reason. You tune it with an <i>effort</i> setting (low → high). Thinking is always on for Opus 5.5 and Fable 5.1.</p>
<p><b>Decision rule:</b> start with Sonnet → move to Opus when Sonnet misses nuance or the task spans many files → use Fable only when Opus fails → use Haiku for bulk work.</p>
<p class="note">Mythos 5.1 exists but is invitation-only. Opus 5, Sonnet 5 and Opus 4.x are legacy.</p>`,
`<table><tr><th>الموديل</th><th>السياق</th><th>سعر API لكل مليون توكن دخول/خروج</th><th>استخدمه في</th></tr>
<tr><td>Haiku 4.5</td><td>200K</td><td>1 / 5</td><td>الشغل الكتير البسيط: تصنيف، وسوم، مسودات قصيرة</td></tr>
<tr><td>Sonnet 5.5</td><td>1M</td><td>2 / 10</td><td>الاختيار اليومي: تحليل، تقارير، داشبوردات</td></tr>
<tr><td>Opus 5.5</td><td>1M</td><td>4 / 20</td><td>النماذج المعقدة والمهام الطويلة ومراجعة ملفات كتير</td></tr>
<tr><td>Fable 5.1</td><td>1M</td><td>10 / 50</td><td>أصعب تفكير لما Opus ميكفيش</td></tr></table>
<p><b>التفكير التكيّفي:</b> الموديلات الجديدة بتقرر هتفكر قد إيه، وإنت بتظبط ده بإعداد <i>Effort</i> (من منخفض لعالي). التفكير دايماً شغال في Opus 5.5 و Fable 5.1.</p>
<p><b>القاعدة:</b> ابدأ بـ Sonnet ← انقل لـ Opus لو Sonnet فاته تفاصيل أو المهمة فيها ملفات كتير ← Fable بس لو Opus فشل ← Haiku للشغل الكمّي.</p>
<p class="note">Mythos 5.1 موجود بس بدعوة. Opus 5 و Sonnet 5 و Opus 4.x بقوا Legacy.</p>`),
  steps:T(["Click the model name under the chat box","Pick Sonnet 5.5 for a normal task","For a big model review, switch to Opus 5.5 and raise effort","Compare the two answers on the same prompt once — you'll calibrate fast"],["دوس على اسم الموديل تحت مربع الكتابة","اختار Sonnet 5.5 للمهام العادية","لمراجعة نموذج مالي كبير، حوّل لـ Opus 5.5 وارفع الـ Effort","جرّب نفس البرومبت على الاتنين مرة — هتفهم الفرق بسرعة"]),
  tips:T(["Higher effort = more tokens and time. Use it only where the answer is worth it.","Knowledge cutoff is around mid-2026 for newer models — use web search for current rates and news."],["Effort أعلى = توكنز ووقت أكتر. استخدمه بس لما الإجابة تستاهل.","معلومات الموديلات الجديدة لحد تقريباً منتصف 2026 — استخدم البحث للأسعار والأخبار الحالية."]),
  cases:[{t:T("Banking ops triage","فرز عمليات البنك"),d:T("Haiku classifies thousands of SWIFT free-text exceptions overnight; Opus reviews only the ambiguous 3%.","Haiku بيصنّف آلاف استثناءات SWIFT بالليل، و Opus بيراجع الـ 3% الغامضين بس.")},{t:T("Doctoral literature review","مراجعة أدبيات دكتوراه"),d:T("Opus or Fable synthesizes 40 papers into a matrix of variables, methods and gaps.","Opus أو Fable بيجمّع 40 بحث في مصفوفة متغيرات ومناهج وفجوات بحثية.")}],
  prompts:[{t:T("Model reviewer at high effort","مراجع نماذج بجهد عالي"),p:T(`You are a senior FP&A reviewer. Using high effort, check the attached budget model for circular references, hard-coded plugs and inconsistent FX assumptions (EGP/USD, SAR peg). Return: Sheet | Cell | Issue | Severity | Fix.`,`إنت مراجع FP&A أول. بجهد عالي، راجع نموذج الموازنة المرفق ودوّر على المراجع الدائرية والأرقام المكتوبة يدوي وافتراضات سعر الصرف غير المتسقة (جنيه/دولار، ربط الريال). الناتج: الشيت | الخلية | المشكلة | الخطورة | الحل.`)}],
  doc:"https://platform.claude.com/docs/en/models/opus-5-5/overview"},
 {id:"1.3",tag:"core",dur:"60",t:T("The 6-element prompt (Sara's framework)","البرومبت ذو العناصر الست (منهج سارة)"),
  body:T(`<p>Every strong prompt answers six questions. This is the anchor of the whole course.</p>
<ol><li><b>Role</b> — who should Claude be? "You are a CFO of an Egyptian retailer."</li>
<li><b>Task</b> — the one deliverable. "Build a quarterly cash-flow report."</li>
<li><b>Context</b> — the facts it can't guess: branches, currency, period, constraints, audience.</li>
<li><b>Reasoning</b> — why you need it, so Claude can make good trade-offs.</li>
<li><b>Stop conditions</b> — what "done" looks like.</li>
<li><b>Output format</b> — table, memo, xlsx, slides, language, length.</li></ol>
<p>Anthropic's own guide adds: be clear and direct, explain the why, give 3–5 examples in &lt;example&gt; tags, structure long prompts with XML tags, put long documents first and the question last, and chain big jobs into steps.</p>`,
`<p>أي برومبت قوي بيجاوب على 6 أسئلة. ده محور الكورس كله.</p>
<ol><li><b>الدور (Role)</b> — Claude يبقى مين؟ "إنت مدير مالي لشركة تجزئة مصرية."</li>
<li><b>المهمة (Task)</b> — مخرج واحد واضح. "اعمل تقرير تدفق نقدي ربع سنوي."</li>
<li><b>السياق (Context)</b> — المعلومات اللي مش هيعرف يخمّنها: الفروع، العملة، الفترة، القيود، الجمهور.</li>
<li><b>المنطق (Reasoning)</b> — محتاجه ليه، علشان يوازن صح.</li>
<li><b>شروط التوقف</b> — شكل "خلصت" إيه.</li>
<li><b>شكل المخرج</b> — جدول، مذكرة، xlsx، شرائح، اللغة، الطول.</li></ol>
<p>دليل Anthropic بيضيف: كن واضح ومباشر، اشرح السبب، ادي 3–5 أمثلة جوه &lt;example&gt;، نظّم البرومبت الطويل بوسوم XML، حط المستندات الطويلة الأول والسؤال في الآخر، وقسّم الشغل الكبير لخطوات.</p>`),
  steps:T(["Write the six headings first, then fill them","Attach the files before the question","Ask Claude to restate the task and ask clarifying questions before starting","Review the first output against your stop conditions","Save the prompt to your library with [VARIABLES]"],["اكتب العناوين الستة الأول وبعدين املاهم","ارفع الملفات قبل السؤال","اطلب من Claude يعيد صياغة المهمة ويسألك أسئلة توضيحية قبل ما يبدأ","راجع أول ناتج على شروط التوقف","احفظ البرومبت في مكتبتك بـ [متغيرات]"]),
  tips:T(["Missing context is the #1 cause of weak output, not the model.","Say what you want, not only what you don't want."],["نقص السياق هو السبب رقم 1 للنتيجة الضعيفة، مش الموديل.","قول عايز إيه، مش بس مش عايز إيه."]),
  cases:[{t:T("Monthly CFO pack","تقرير المدير المالي الشهري"),d:T("A 6-element prompt plus last month's pack turns 2 days of drafting into 40 minutes of reviewing.","برومبت بالعناصر الستة + تقرير الشهر اللي فات بيحوّل يومين كتابة لـ 40 دقيقة مراجعة.")}],
  prompts:[{t:T("6-element template","قالب العناصر الستة"),p:T(`<role>You are [role] at [company type] in [country].</role>
<task>[one clear deliverable]</task>
<context>[facts, numbers, period, currency, audience, constraints]</context>
<reasoning>I need this because [decision it supports].</reasoning>
<stop_when>[the checklist that means done]</stop_when>
<output_format>[table/memo/xlsx/slides], [language], [length]</output_format>
Before you start, restate my ask in one line and ask up to 3 clarifying questions.`,`<role>إنت [الدور] في [نوع الشركة] في [الدولة].</role>
<task>[مخرج واحد واضح]</task>
<context>[الحقائق، الأرقام، الفترة، العملة، الجمهور، القيود]</context>
<reasoning>محتاج ده علشان [القرار اللي هيدعمه].</reasoning>
<stop_when>[القائمة اللي معناها إنك خلصت]</stop_when>
<output_format>[جدول/مذكرة/xlsx/شرائح]، [اللغة]، [الطول]</output_format>
قبل ما تبدأ، اعد صياغة طلبي في سطر واحد واسألني لحد 3 أسئلة توضيحية.`)}],
  doc:"https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview"},
 {id:"1.4",tag:"practical",dur:"30",t:T("Plans: what each one unlocks","الخطط: كل خطة بتفتح إيه"),
  body:T(`<table><tr><th>Plan</th><th>Price (USD, Sep 2026)</th><th>Key unlocks</th></tr>
<tr><td>Free</td><td>0</td><td>Chat, web search, files, memory, 1 custom connector, incognito</td></tr>
<tr><td>Pro</td><td>20/mo</td><td>Claude Code, Cowork, Research, Microsoft 365 add-ins, Chrome, Design, Skills, Plugins</td></tr>
<tr><td>Max 5x / 20x</td><td>100 / 200</td><td>5× or 20× Pro usage</td></tr>
<tr><td>Team</td><td>25 or 125 per seat</td><td>SSO, admin controls, shared projects, Claude Tag in Slack</td></tr>
<tr><td>Enterprise</td><td>20/seat + usage</td><td>SCIM, audit logs, Compliance API, retention, IP allowlisting</td></tr></table>
<p class="note">Subscription prices come from public summaries — verify on claude.com/pricing before teaching.</p>`,
`<table><tr><th>الخطة</th><th>السعر (دولار، سبتمبر 2026)</th><th>أهم المميزات</th></tr>
<tr><td>Free</td><td>0</td><td>شات، بحث، ملفات، ذاكرة، Connector مخصص واحد، محادثات متخفية</td></tr>
<tr><td>Pro</td><td>20 شهرياً</td><td>Claude Code و Cowork و Research وإضافات Microsoft 365 و Chrome و Design و Skills و Plugins</td></tr>
<tr><td>Max 5x / 20x</td><td>100 / 200</td><td>استخدام 5 أو 20 ضعف Pro</td></tr>
<tr><td>Team</td><td>25 أو 125 للمقعد</td><td>SSO، تحكم إداري، مشاريع مشتركة، Claude Tag في Slack</td></tr>
<tr><td>Enterprise</td><td>20 للمقعد + الاستخدام</td><td>SCIM، سجلات تدقيق، Compliance API، سياسة احتفاظ، تقييد IP</td></tr></table>
<p class="note">الأسعار من ملخصات عامة — اتأكد من claude.com/pricing قبل الشرح.</p>`),
  steps:T(["Start learners on Pro — almost every module needs it","Teams handling client data: Team or Enterprise","Heavy Cowork or Claude Code users: Max"],["ابدأ المتدربين على Pro — أغلب الوحدات محتاجاه","الفرق اللي بتتعامل مع بيانات عملاء: Team أو Enterprise","اللي بيستخدم Cowork أو Claude Code بكثافة: Max"]),
  tips:T(["Agentic work (Cowork, Code) burns usage faster than chat."],["الشغل الوكيلي (Cowork و Code) بيستهلك الاستخدام أسرع من الشات."]),
  cases:[],prompts:[],doc:"https://claude.com/pricing"}
 ]},
{n:2,icon:"◇",t:T("Workspace: chat, Projects, Memory & context","مساحة العمل: الشات و Projects والذاكرة والسياق"),
 sub:T("Give Claude the right background once — reuse it forever.","ادّي Claude الخلفية الصح مرة واحدة واستخدمها على طول."),
 units:[
 {id:"2.1",tag:"core",dur:"40",t:T("Chat core: files, vision, web search, Research","أساسيات الشات: الملفات والصور والبحث و Research"),
  body:T(`<p>Upload PDF, Word, Excel/CSV and images; Claude reads tables, charts and scans. <b>Web search</b> gives current facts with links. <b>Research</b> (paid plans, type <code>/deep-research</code> or + → Research) runs a multi-step investigation and returns a cited report.</p>`,`<p>ارفع PDF و Word و Excel/CSV وصور؛ Claude بيقرا الجداول والرسوم والمستندات المصورة. <b>البحث على الويب</b> بيجيب معلومات حالية بروابط. <b>Research</b> (خطط مدفوعة، اكتب <code>/deep-research</code> أو + ← Research) بيعمل بحث متعدد الخطوات ويطلّع تقرير بمصادر.</p>`),
  steps:T(["Attach files","Choose model","Toggle web search or start Research","Write a 6-element prompt","Ask for a table, file or artifact as output"],["ارفع الملفات","اختار الموديل","فعّل البحث أو ابدأ Research","اكتب برومبت بالعناصر الستة","اطلب الناتج جدول أو ملف أو Artifact"]),
  tips:T(["For scanned Arabic PDFs, ask Claude to transcribe first, then analyze.","Ask for citations whenever facts matter."],["في الـ PDF العربي المصوّر، اطلب يكتب النص الأول وبعدين يحلل.","اطلب مصادر في أي حاجة الحقايق فيها مهمة."]),
  cases:[{t:T("Credit spreading","تحليل ائتماني"),d:T("Three years of borrower statements → DSCR, leverage and covenant headroom in one table.","قوائم 3 سنين للعميل ← DSCR والرافعة وهامش الالتزام بالتعهدات في جدول واحد.")},{t:T("Market scan","مسح السوق"),d:T("Research on Saudi fintech wallets with a cited source list for a strategy memo.","Research عن المحافظ الرقمية في السعودية بمصادر لمذكرة استراتيجية.")}],
  prompts:[{t:T("Bilingual statement extraction","استخراج القوائم ثنائي اللغة"),p:T(`Read the attached audited statements (Arabic and English). Extract the income statement and balance sheet into two tables in EGP thousands. Keep the Arabic line names and add an English translation column. Flag any line you could not read clearly.`,`اقرا القوائم المالية المراجعة المرفقة (عربي وإنجليزي). طلّع قائمة الدخل والميزانية في جدولين بالألف جنيه. سيب أسماء البنود بالعربي وضيف عمود ترجمة إنجليزي. علّم على أي بند مش واضح.`)}],
  doc:"https://support.claude.com"},
 {id:"2.2",tag:"core",dur:"45",t:T("Projects: your permanent workspaces","Projects: مساحات عمل دايمة"),
  body:T(`<p>A <b>Project</b> holds three things: a <b>knowledge base</b> (files Claude can always see), <b>instructions</b> (how to behave in this project) and its own <b>chats and memory</b>. Team/Enterprise can share projects; Cowork projects can be tied to a local folder on desktop.</p>
<p><b>When to create one:</b> any work you return to more than twice — a client, a monthly report, a course, a thesis.</p>
<p><b>What goes in knowledge:</b> reference material that rarely changes — chart of accounts, policies, templates, last year's pack, style guide. Not raw data that changes every month (upload that in the chat).</p>`,
`<p>الـ <b>Project</b> فيه 3 حاجات: <b>قاعدة معرفة</b> (ملفات Claude شايفها دايماً)، <b>تعليمات</b> (يتصرف إزاي جوه المشروع) و<b>محادثات وذاكرة</b> خاصة بيه. في Team/Enterprise تقدر تشارك المشروع، ومشاريع Cowork ممكن تتربط بفولدر على جهازك.</p>
<p><b>إمتى تعمله:</b> أي شغل بترجعله أكتر من مرتين — عميل، تقرير شهري، كورس، رسالة دكتوراه.</p>
<p><b>إيه اللي يتحط في المعرفة:</b> مرجع نادراً ما بيتغير — دليل الحسابات، السياسات، القوالب، تقرير السنة اللي فاتت، دليل الأسلوب. مش البيانات اللي بتتغير كل شهر (دي ارفعها في الشات).</p>`),
  steps:T(["Projects → New project, give it a clear name","Upload 3–10 reference files (keep them lean)","Write instructions: role, currency, fiscal year, format, language rule","Start every related chat inside the project","Review and trim the knowledge files every quarter"],["Projects ← New project، وسمّيه اسم واضح","ارفع من 3 لـ 10 ملفات مرجعية (خليها خفيفة)","اكتب التعليمات: الدور، العملة، السنة المالية، الشكل، قاعدة اللغة","ابدأ أي محادثة متعلقة جوه المشروع","راجع ونضّف ملفات المعرفة كل ربع سنة"]),
  tips:T(["Every file in knowledge costs context in every chat — less is more.","Put rules in instructions, not repeated in every message."],["كل ملف في المعرفة بياخد من السياق في كل محادثة — الأقل أحسن.","حط القواعد في التعليمات، مش تكررها في كل رسالة."]),
  cases:[{t:T("LC desk project","مشروع مكتب الاعتمادات"),d:T("UCP 600 / ISBP summaries + the bank's checklist + discrepancy notice template. Every LC review starts with full context.","ملخصات UCP 600 و ISBP + قائمة مراجعة البنك + قالب إخطار المخالفات. كل مراجعة اعتماد بتبدأ بالسياق كامل.")},{t:T("Course build project","مشروع بناء الكورس"),d:T("Curriculum outline, brand colors and prompt library — every new module stays consistent.","مخطط المنهج وألوان البراند ومكتبة البرومبتات — كل وحدة جديدة بتطلع متسقة.")},{t:T("Doctoral research","البحث الدكتوراه"),d:T("Proposal, literature matrix and supervisor notes; Claude drafts chapters in the agreed structure.","الخطة البحثية ومصفوفة الأدبيات وملاحظات المشرف؛ Claude بيكتب الفصول بالهيكل المتفق عليه.")}],
  prompts:[{t:T("Project instructions — FP&A","تعليمات مشروع FP&A"),p:T(`You are the FP&A analyst for [Company]. Fiscal year Jan–Dec. Reporting currency EGP, group currency USD. Show thousands, negatives in parentheses. Always compare Actual vs Budget and vs Last Year; flag variances above 10%. State assumptions explicitly. Answer in the language of the question. If data is missing, ask — never invent numbers.`,`إنت محلل FP&A لشركة [الاسم]. السنة المالية من يناير لديسمبر. عملة التقرير جنيه مصري وعملة المجموعة دولار. اعرض بالألف، والسالب بين قوسين. دايماً قارن الفعلي بالموازنة وبالسنة اللي فاتت، وعلّم على أي انحراف فوق 10%. اكتب الافتراضات بوضوح. رد بلغة السؤال. لو في بيانات ناقصة اسأل — ومتألّفش أرقام أبداً.`)}],
  doc:"https://support.claude.com"},
 {id:"2.3",tag:"core",dur:"35",t:T("Memory, past-chat search & incognito","الذاكرة والبحث في المحادثات القديمة والمحادثة المتخفية"),
  body:T(`<p><b>Memory</b> summarizes what matters from your chats and brings it into new ones (your role, conventions, ongoing work). <b>Search past chats</b> (paid plans) finds earlier conversations with citations — "find the covenant analysis from June". <b>Incognito</b> chats are not saved to history or memory.</p>
<p><b>Controls:</b> Settings → Memory. You can view, edit and delete what Claude remembers, or switch memory off. Projects can keep their memory separate from your general memory.</p>
<p class="note">Incognito chats are still retained for 30 days by default, and on Team/Enterprise they are included in organizational exports and the Compliance API. Incognito is not a way around company policy.</p>`,
`<p><b>الذاكرة</b> بتلخّص المهم من محادثاتك وتجيبه في المحادثات الجديدة (دورك، طريقتك، الشغل الجاري). <b>البحث في المحادثات القديمة</b> (الخطط المدفوعة) بيلاقي محادثات سابقة بمصادر — "هاتلي تحليل التعهدات بتاع يونيو". <b>المحادثة المتخفية</b> مبتتحفظش في السجل ولا الذاكرة.</p>
<p><b>التحكم:</b> Settings ← Memory. تقدر تشوف وتعدّل وتمسح اللي Claude فاكره، أو تقفل الذاكرة. والـ Projects ممكن ذاكرتها تبقى منفصلة عن ذاكرتك العامة.</p>
<p class="note">المحادثة المتخفية بتتحفظ 30 يوم افتراضياً، وفي Team/Enterprise بتدخل في تصدير بيانات المؤسسة و Compliance API. مش طريقة للالتفاف على سياسة الشركة.</p>`),
  steps:T(["Open Settings → Memory and read what is stored","Delete anything outdated or sensitive","Tell Claude standing facts once: 'Remember that our fiscal year ends in June.'","Use a separate project memory for each client","Use incognito for one-off personal questions"],["افتح Settings ← Memory واقرا المتخزن","امسح أي حاجة قديمة أو حساسة","قول لـ Claude الحقايق الثابتة مرة: 'افتكر إن سنتنا المالية بتخلص في يونيو.'","استخدم ذاكرة مشروع منفصلة لكل عميل","استخدم المتخفي للأسئلة الشخصية العابرة"]),
  tips:T(["Memory is context, not a database — keep exact numbers in files.","Review memory monthly, like you review your CV."],["الذاكرة سياق مش قاعدة بيانات — الأرقام الدقيقة خليها في ملفات.","راجع الذاكرة كل شهر زي ما بتراجع الـ CV."]),
  cases:[{t:T("Consistent reporting style","أسلوب تقارير ثابت"),d:T("Claude remembers 'thousands, parentheses for negatives, Arabic summary first' across every chat.","Claude فاكر 'بالألف، السالب بين قوسين، الملخص العربي الأول' في كل محادثة.")}],
  prompts:[{t:T("Memory setup","تجهيز الذاكرة"),p:T(`Please remember for future chats: I am [name], [role] at [company/independent]. I report in [currency], fiscal year [period]. I prefer [Arabic/English], [tables first], [short executive summary]. My recurring work: [3 items]. Confirm what you saved in a short list.`,`افتكر للمحادثات الجاية: أنا [الاسم]، [الدور] في [الشركة/مستقل]. بشتغل بـ [العملة]، والسنة المالية [الفترة]. بفضّل [عربي/إنجليزي]، [الجداول الأول]، [ملخص تنفيذي قصير]. شغلي المتكرر: [3 حاجات]. أكّدلي اللي حفظته في قائمة قصيرة.`)}],
  doc:"https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context"},
 {id:"2.4",tag:"core",dur:"45",t:T("Context: what Claude can 'see' at once","السياق: اللي Claude شايفه في نفس الوقت"),
  body:T(`<p>The <b>context window</b> is everything Claude holds in mind for one reply: your instructions, project knowledge, memory, attached files, the conversation so far, tool definitions from connectors, and its own previous answers. It is measured in <b>tokens</b> (≈ ¾ of an English word; Arabic often uses more tokens per word).</p>
<p>Sonnet 5.5, Opus 5.5 and Fable 5.1 hold up to 1M tokens; Haiku 4.5 holds 200K. Bigger isn't free: every turn re-reads the whole conversation, so long chats get slower, cost more usage and can blur early details.</p>
<p><b>Compaction</b> summarizes older parts of a long conversation to free space (automatic in long sessions; <code>/compact</code> in Claude Code).</p>`,
`<p><b>نافذة السياق</b> هي كل اللي Claude ماسكه في دماغه وهو بيرد: تعليماتك، معرفة المشروع، الذاكرة، الملفات، المحادثة لحد دلوقتي، تعريفات الأدوات بتاعة الـ Connectors، وردوده هو. بتتقاس بالـ <b>توكنز</b> (حوالي ¾ كلمة إنجليزي؛ والعربي غالباً بياخد توكنز أكتر للكلمة).</p>
<p>Sonnet 5.5 و Opus 5.5 و Fable 5.1 بيشيلوا لحد مليون توكن؛ Haiku 4.5 بيشيل 200 ألف. الكبير مش ببلاش: كل رد بيعيد قراية المحادثة كلها، فالمحادثات الطويلة بتبطّأ وتستهلك أكتر وممكن تتوه التفاصيل الأولى.</p>
<p><b>الضغط (Compaction)</b> بيلخّص الأجزاء القديمة علشان يفضّي مساحة (تلقائي في الجلسات الطويلة؛ و <code>/compact</code> في Claude Code).</p>`),
  steps:T(["One task = one chat","Move reusable files into a Project","When a chat gets long, ask for a hand-off summary and start fresh","Disconnect connectors you don't need for this task"],["مهمة واحدة = محادثة واحدة","انقل الملفات المتكررة لـ Project","لما المحادثة تطول، اطلب ملخص تسليم وابدأ محادثة جديدة","افصل الـ Connectors اللي مش محتاجها في المهمة دي"]),
  tips:T(["See the full guide under Deep dives → Tokens & context."],["الدليل الكامل في التعمق ← التوكنز والسياق."]),
  cases:[],
  prompts:[{t:T("Hand-off summary","ملخص التسليم"),p:T(`We are moving to a new chat. Write a hand-off summary under 250 words: goal, decisions made, current numbers/assumptions, open questions, files used, and the exact next step. Format it so I can paste it as the first message of the new chat.`,`هنكمّل في محادثة جديدة. اكتب ملخص تسليم أقل من 250 كلمة: الهدف، القرارات اللي اتاخدت، الأرقام والافتراضات الحالية، الأسئلة المفتوحة، الملفات المستخدمة، والخطوة الجاية بالظبط. نسّقه بحيث ألصقه كأول رسالة في المحادثة الجديدة.`)}],
  doc:"https://code.claude.com/docs/en/context-window"},
 {id:"2.5",tag:"practical",dur:"20",t:T("Styles & instructions for Claude","الأساليب والتعليمات الدائمة"),
  body:T(`<p><b>Styles</b> set the writing voice — presets (Concise, Explanatory, Formal) or a custom style learned from samples you upload. <b>Instructions for Claude</b> (Settings → General) apply to every chat.</p>`,`<p><b>Styles</b> بتحدد نبرة الكتابة — جاهزة (مختصر، شارح، رسمي) أو أسلوب مخصص بيتعلمه من عينات بترفعها. <b>تعليمات Claude</b> (Settings ← General) بتتطبق على كل المحادثات.</p>`),
  steps:T(["Upload 3 samples of your best writing","Create a style and name it clearly","Switch style per task from the chat box"],["ارفع 3 عينات من أحسن كتابتك","اعمل Style وسمّيه اسم واضح","غيّر الأسلوب حسب المهمة من مربع الكتابة"]),
  tips:T([],[]),
  cases:[{t:T("Three voices","3 أصوات"),d:T("'Bank Formal' for credit memos, 'Egyptian friendly' for social posts, 'Academic APA' for research.","'رسمي بنكي' لمذكرات الائتمان، 'مصري ودود' للسوشيال، 'أكاديمي APA' للبحث.")}],
  prompts:[],doc:""}
 ]}
];
