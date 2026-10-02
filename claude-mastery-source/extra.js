// Foundations: definitions + advanced prompt engineering
DAYS[0].units.splice(1,0,
{id:"1.2",tag:"core",dur:"60",t:T("Core concepts A–Z: the vocabulary of AI","المفاهيم الأساسية من A لـ Z: لغة الذكاء الاصطناعي"),
 body:T(`<table><tr><th>Concept</th><th>Plain meaning</th><th>Why it matters at work</th></tr>
<tr><td><b>LLM</b> (large language model)</td><td>A model trained on huge text to predict the next token; Claude is one.</td><td>It generates, reasons and summarises — but it is not a database of facts.</td></tr>
<tr><td><b>Token</b></td><td>A chunk of text (≈¾ English word; Arabic often more per word).</td><td>Usage, limits and API price are counted in tokens.</td></tr>
<tr><td><b>Context window</b></td><td>Everything the model sees at once.</td><td>Too much context = slower, costlier, details blur.</td></tr>
<tr><td><b>Prompt / system prompt</b></td><td>Your instruction / standing instructions set before the chat.</td><td>Quality of output follows quality of instruction.</td></tr>
<tr><td><b>Hallucination</b></td><td>Confident but wrong output.</td><td>Always verify numbers, citations and legal statements.</td></tr>
<tr><td><b>Grounding</b></td><td>Forcing answers to come from given sources.</td><td>Use files, Projects, citations, "answer only from…".</td></tr>
<tr><td><b>Reasoning / extended thinking</b></td><td>The model works through steps before answering.</td><td>Better for models, analysis, multi-step problems.</td></tr>
<tr><td><b>Multimodal / vision</b></td><td>Reads images, charts, scans.</td><td>Receipts, screenshots, scanned statements.</td></tr>
<tr><td><b>Zero-shot / few-shot</b></td><td>No examples / a few examples in the prompt.</td><td>Examples are the fastest way to get your format.</td></tr>
<tr><td><b>Chain of thought</b></td><td>Asking for step-by-step reasoning.</td><td>Transparent logic you can audit.</td></tr>
<tr><td><b>Prompt chaining</b></td><td>Splitting a job into sequential prompts.</td><td>Higher accuracy on big tasks.</td></tr>
<tr><td><b>RAG</b> (retrieval-augmented generation)</td><td>Retrieve relevant passages, then generate from them.</td><td>Answers from your policies and reports, not memory.</td></tr>
<tr><td><b>Embedding / vector database</b></td><td>Numbers that represent meaning, stored for similarity search.</td><td>The engine behind custom RAG apps.</td></tr>
<tr><td><b>Fine-tuning</b></td><td>Further training a model on your data.</td><td>Rarely needed — prompts, Skills and RAG usually suffice.</td></tr>
<tr><td><b>Tool use / function calling</b></td><td>The model calls functions you define.</td><td>How Claude queries an ERP, calculator or API.</td></tr>
<tr><td><b>Agent</b></td><td>A model that plans, uses tools and loops until done.</td><td>Cowork, Claude Code, Managed Agents.</td></tr>
<tr><td><b>MCP</b></td><td>Open standard for connecting models to tools and data.</td><td>One connector works across Claude surfaces.</td></tr>
<tr><td><b>Skill / Plugin</b></td><td>Packaged method / bundle of skills, connectors, commands.</td><td>Repeatable quality across a team.</td></tr>
<tr><td><b>Artifact</b></td><td>Standalone output: app, doc, dashboard.</td><td>Turns answers into usable products.</td></tr>
<tr><td><b>Knowledge cutoff</b></td><td>Date after which the model has no training data.</td><td>Use web search for anything recent.</td></tr>
<tr><td><b>Temperature</b></td><td>Randomness setting (API).</td><td>Lower for finance consistency, higher for brainstorming.</td></tr>
<tr><td><b>Prompt injection</b></td><td>Hidden instructions inside content.</td><td>Agents reading email/web must be supervised.</td></tr>
<tr><td><b>Human in the loop</b></td><td>A person approves key steps.</td><td>Mandatory for payments, postings, people decisions.</td></tr></table>`,
`<table><tr><th>المفهوم</th><th>المعنى ببساطة</th><th>أهميته في الشغل</th></tr>
<tr><td><b>LLM</b> (نموذج لغوي كبير)</td><td>نموذج اتدرب على نصوص ضخمة علشان يتوقع التوكن الجاي؛ Claude واحد منهم.</td><td>بيكتب ويفكر ويلخّص — بس مش قاعدة بيانات حقايق.</td></tr>
<tr><td><b>التوكن</b></td><td>جزء من النص (حوالي ¾ كلمة إنجليزي؛ والعربي غالباً أكتر).</td><td>الاستهلاك والحدود وسعر الـ API بيتحسبوا بالتوكن.</td></tr>
<tr><td><b>نافذة السياق</b></td><td>كل اللي الموديل شايفه مرة واحدة.</td><td>سياق كتير = أبطأ وأغلى والتفاصيل بتتوه.</td></tr>
<tr><td><b>البرومبت / System prompt</b></td><td>تعليمتك / التعليمات الدائمة قبل المحادثة.</td><td>جودة الناتج من جودة التعليمات.</td></tr>
<tr><td><b>الهلوسة</b></td><td>ناتج واثق بس غلط.</td><td>راجع دايماً الأرقام والمراجع والكلام القانوني.</td></tr>
<tr><td><b>الاستناد للمصدر (Grounding)</b></td><td>إجبار الإجابة تيجي من مصادر محددة.</td><td>استخدم الملفات والـ Projects والاستشهادات و"جاوب من … بس".</td></tr>
<tr><td><b>التفكير الممتد</b></td><td>الموديل بيمشي في خطوات قبل الرد.</td><td>أحسن في النماذج والتحليل والمسائل متعددة الخطوات.</td></tr>
<tr><td><b>متعدد الوسائط / الرؤية</b></td><td>بيقرا الصور والرسوم والمستندات المصورة.</td><td>إيصالات، لقطات شاشة، قوائم مصورة.</td></tr>
<tr><td><b>Zero-shot / Few-shot</b></td><td>من غير أمثلة / بأمثلة قليلة.</td><td>الأمثلة أسرع طريقة توصل للشكل اللي عايزه.</td></tr>
<tr><td><b>سلسلة التفكير</b></td><td>طلب تفكير خطوة بخطوة.</td><td>منطق واضح تقدر تراجعه.</td></tr>
<tr><td><b>تسلسل البرومبتات</b></td><td>تقسيم الشغل لبرومبتات متتالية.</td><td>دقة أعلى في المهام الكبيرة.</td></tr>
<tr><td><b>RAG</b></td><td>استرجاع المقاطع المناسبة وبعدين الكتابة منها.</td><td>إجابات من سياساتك وتقاريرك مش من الذاكرة.</td></tr>
<tr><td><b>Embedding / قاعدة متجهات</b></td><td>أرقام بتمثل المعنى ومتخزنة للبحث بالتشابه.</td><td>محرك تطبيقات RAG المخصصة.</td></tr>
<tr><td><b>Fine-tuning</b></td><td>تدريب إضافي للموديل على بياناتك.</td><td>نادراً ما بتحتاجه — البرومبت والـ Skills والـ RAG بيكفوا.</td></tr>
<tr><td><b>استخدام الأدوات</b></td><td>الموديل بينادي دوال إنت معرّفها.</td><td>كده Claude بيسأل الـ ERP أو حاسبة أو API.</td></tr>
<tr><td><b>الوكيل</b></td><td>موديل بيخطط ويستخدم أدوات ويكرر لحد ما يخلص.</td><td>Cowork و Claude Code و Managed Agents.</td></tr>
<tr><td><b>MCP</b></td><td>معيار مفتوح لربط الموديلات بالأدوات والبيانات.</td><td>Connector واحد بيشتغل في كل أدوات Claude.</td></tr>
<tr><td><b>Skill / Plugin</b></td><td>طريقة متغلّفة / حزمة Skills و Connectors وأوامر.</td><td>جودة متكررة على مستوى الفريق.</td></tr>
<tr><td><b>Artifact</b></td><td>مخرج مستقل: تطبيق، مستند، داشبورد.</td><td>بيحوّل الإجابات لمنتجات.</td></tr>
<tr><td><b>تاريخ قطع المعرفة</b></td><td>التاريخ اللي بعده الموديل معندوش بيانات تدريب.</td><td>استخدم البحث لأي حاجة حديثة.</td></tr>
<tr><td><b>Temperature</b></td><td>إعداد العشوائية (API).</td><td>أقل للاتساق المالي، أعلى للعصف الذهني.</td></tr>
<tr><td><b>حقن الأوامر</b></td><td>تعليمات مستخبية جوه المحتوى.</td><td>الوكلاء اللي بيقروا إيميل/ويب لازم يتراقبوا.</td></tr>
<tr><td><b>إنسان في الحلقة</b></td><td>شخص بيوافق على الخطوات المهمة.</td><td>إلزامي في المدفوعات والترحيل وقرارات الأفراد.</td></tr></table>`),
 steps:T(["Read the table once","Pick 5 terms you'll use this week","Explain each to a colleague in one sentence"],["اقرا الجدول مرة","اختار 5 مصطلحات هتستخدمهم الأسبوع ده","اشرح كل واحد لزميل في جملة"]),
 tips:T(["Most AI failures at work are grounding failures — give sources and ask for citations."],["أغلب أخطاء الـ AI في الشغل سببها غياب المصدر — ادّي مصادر واطلب استشهادات."]),
 cases:[{t:T("Hallucination caught","هلوسة اتمسكت"),d:T("An analyst asks for 'EGX market cap last quarter' without search — Claude gives a plausible number. With web search and citations on, the figure comes with a source to verify.","محلل سأل عن 'رأس مال البورصة المصرية الربع اللي فات' من غير بحث — Claude إدّى رقم منطقي. ومع البحث والاستشهادات، الرقم جه بمصدر يتراجع.")}],
 prompts:[{t:T("Teach me a concept","علّمني مفهوم"),p:T(`Explain [concept, e.g. RAG] to a finance professional with no tech background: a one-line definition, an everyday analogy, a finance example, when to use it, one common mistake, and 3 quiz questions with answers.`,`اشرح [المفهوم، مثلاً RAG] لمتخصص مالي ملوش خلفية تقنية: تعريف في سطر، تشبيه من الحياة، مثال مالي، إمتى أستخدمه، غلطة شائعة، و 3 أسئلة اختبار بالإجابات.`)}],doc:""});
DAYS[0].units.splice(4,0,
{id:"1.5",tag:"advanced",dur:"75",t:T("Prompt engineering techniques — advanced","تقنيات هندسة البرومبت — متقدم"),
 body:T(`<ol><li><b>Few-shot examples:</b> show 2–5 input→output pairs in &lt;example&gt; tags; vary them so Claude learns the pattern, not one case.</li>
<li><b>XML structure:</b> separate instructions, data and examples: &lt;instructions&gt;, &lt;data&gt;, &lt;example&gt;, &lt;output_format&gt;.</li>
<li><b>Step-by-step reasoning:</b> "Think through the calculation step by step, then give the answer in &lt;answer&gt; tags." Raise effort on hard tasks.</li>
<li><b>Prompt chaining:</b> 1) extract → 2) analyse → 3) draft → 4) critique → 5) final. Paste only the needed output into each next step.</li>
<li><b>Self-critique:</b> "Review your answer against the stop conditions; list gaps, then fix them."</li>
<li><b>Ask-first:</b> "Ask me up to 3 questions before you start." Prevents confident wrong work.</li>
<li><b>Constraints and negatives with reasons:</b> "Don't round — the auditor reconciles to the unit."</li>
<li><b>Output contracts:</b> exact columns, units, language, length; for systems, JSON schema (structured outputs on the API).</li>
<li><b>Meta-prompting:</b> "Improve this prompt for clarity and completeness; return the improved prompt only." The Console also has a prompt generator and improver.</li>
<li><b>Templates with variables:</b> keep reusable prompts with [VARIABLES] in your library or as Skills.</li>
<li><b>Evaluation:</b> test a prompt on 5–10 real cases, score outputs against a rubric, change one thing at a time.</li></ol>`,
`<ol><li><b>أمثلة Few-shot:</b> اعرض 2–5 أزواج مدخل←مخرج جوه &lt;example&gt;؛ ونوّعهم علشان يتعلم النمط مش حالة واحدة.</li>
<li><b>هيكلة XML:</b> افصل التعليمات والبيانات والأمثلة: &lt;instructions&gt; و &lt;data&gt; و &lt;example&gt; و &lt;output_format&gt;.</li>
<li><b>التفكير خطوة بخطوة:</b> "فكّر في الحساب خطوة بخطوة، وبعدين اكتب الإجابة جوه &lt;answer&gt;." وارفع الـ Effort في الصعب.</li>
<li><b>تسلسل البرومبتات:</b> 1) استخراج ← 2) تحليل ← 3) كتابة ← 4) نقد ← 5) نهائي. والصق المطلوب بس في الخطوة اللي بعدها.</li>
<li><b>النقد الذاتي:</b> "راجع إجابتك على شروط التوقف؛ اكتب الفجوات وصلّحها."</li>
<li><b>اسأل الأول:</b> "اسألني لحد 3 أسئلة قبل ما تبدأ." بيمنع الشغل الغلط الواثق.</li>
<li><b>القيود بالسبب:</b> "متقرّبش — المراجع بيطابق للوحدة."</li>
<li><b>عقد المخرجات:</b> الأعمدة والوحدات واللغة والطول بالظبط؛ وللأنظمة JSON schema (مخرجات مهيكلة في الـ API).</li>
<li><b>البرومبت عن البرومبت:</b> "حسّن البرومبت ده للوضوح والاكتمال؛ ورجّع البرومبت المحسّن بس." والكونسول فيه مولّد ومحسّن.</li>
<li><b>قوالب بمتغيرات:</b> احفظ البرومبتات بـ [متغيرات] في مكتبتك أو كـ Skills.</li>
<li><b>التقييم:</b> جرّب البرومبت على 5–10 حالات حقيقية، وقيّم بمعايير، وغيّر حاجة واحدة في كل مرة.</li></ol>`),
 steps:T(["Take one prompt you use weekly","Add XML structure and 2 examples","Add stop conditions and an output contract","Test on 5 real cases and score","Save the winner as a template or Skill"],["خد برومبت بتستخدمه كل أسبوع","ضيف هيكلة XML ومثالين","ضيف شروط توقف وعقد مخرجات","جرّبه على 5 حالات حقيقية وقيّم","احفظ الأحسن كقالب أو Skill"]),
 tips:T(["Examples beat adjectives: one sample of 'concise' is clearer than the word.","Change one thing per test so you know what worked."],["الأمثلة أقوى من الصفات: عينة 'مختصر' أوضح من الكلمة.","غيّر حاجة واحدة في كل تجربة علشان تعرف إيه اللي نفع."]),
 cases:[{t:T("Commentary in house style","تعليق بأسلوب الشركة"),d:T("Three past CFO commentaries as examples → every new month's commentary matches tone and length with no editing.","3 تعليقات سابقة كأمثلة ← تعليق كل شهر جديد بنفس النبرة والطول من غير تعديل.")}],
 prompts:[{t:T("Few-shot + chain template","قالب أمثلة + تسلسل"),p:T(`<instructions>Write the monthly variance commentary in the same style as the examples.</instructions>
<example>Revenue EGP 142.8M, +3.5% vs budget, driven by price (+5.1%) offset by volume (−1.6%)…</example>
<example>Opex EGP 48.5M, +10.2% vs budget, mainly marketing timing (EGP 2.1M) brought forward from Q4…</example>
<data>[paste variance table]</data>
<steps>1) List the 3 largest variances with drivers. 2) Draft the commentary. 3) Check every number against the data and fix mismatches.</steps>
<output_format>Max 150 words, EGP millions, one paragraph per line item.</output_format>`,`<instructions>اكتب تعليق الانحرافات الشهري بنفس أسلوب الأمثلة.</instructions>
<example>الإيرادات 142.8 مليون جنيه، +3.5% عن الموازنة، بسبب السعر (+5.1%) قابله انخفاض الكمية (−1.6%)…</example>
<example>المصروفات 48.5 مليون جنيه، +10.2% عن الموازنة، أساساً تقديم توقيت التسويق (2.1 مليون) من الربع الرابع…</example>
<data>[الصق جدول الانحرافات]</data>
<steps>1) اكتب أكبر 3 انحرافات بأسبابها. 2) اكتب التعليق. 3) راجع كل رقم على البيانات وصلّح أي اختلاف.</steps>
<output_format>أقصى 150 كلمة، بالمليون جنيه، فقرة لكل بند.</output_format>`)},{t:T("Prompt improver","محسّن البرومبت"),p:T(`Act as a prompt engineer. Improve the prompt below using: role, task, context, reasoning, stop conditions, output format, XML tags, and one example. Point out what was missing. Return the improved prompt in a code block.
<prompt>[paste]</prompt>`,`اتصرف كمهندس برومبت. حسّن البرومبت اللي تحت باستخدام: الدور، المهمة، السياق، المنطق، شروط التوقف، شكل المخرج، وسوم XML، ومثال واحد. وضّح كان ناقصه إيه. ورجّع البرومبت المحسّن في بلوك.
<prompt>[الصق]</prompt>`)}],doc:"https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview"});
DAYS[0].units.forEach((u,i)=>u.id="1."+(i+1));
// Builder: RAG, games, websites, apps, mini-ERP
DAYS[6].units.push({id:"7.3",tag:"advanced",dur:"90",t:T("Build anything: RAG, games, websites, apps, mini-ERP","ابني أي حاجة: RAG وألعاب ومواقع وتطبيقات و Mini-ERP"),
 body:T(`<table><tr><th>Build</th><th>Fastest path</th><th>Production path</th></tr>
<tr><td>Knowledge assistant (RAG)</td><td>Project with your files + grounding instructions</td><td>API + embeddings provider + vector DB + citations (Claude Code)</td></tr>
<tr><td>Game / gamified learning</td><td>Artifact (single HTML)</td><td>Claude Code web app with backend and scores</td></tr>
<tr><td>Website / landing page</td><td>Artifact with frontend-design skill; publish link</td><td>Claude Code static site, deploy to a host</td></tr>
<tr><td>Business app</td><td>Artifact with storage</td><td>Claude Code full-stack app, auth, tests</td></tr>
<tr><td>Mini-ERP</td><td>Artifact: inventory, invoices, auto-journals, TB</td><td>Claude Code + database + MCP server so Claude can query it</td></tr></table>
<p><b>Method for every build:</b> 1) write a one-page spec (users, data, screens, rules), 2) ask for a plan (/plan), 3) build the smallest working version, 4) test with real data, 5) add features one at a time, 6) document (README / CLAUDE.md). See the use-case library → RAG, Games, Apps and Mini-ERP for full master prompts.</p>`,
`<table><tr><th>المنتج</th><th>أسرع طريق</th><th>طريق الإنتاج</th></tr>
<tr><td>مساعد معرفة (RAG)</td><td>Project بملفاتك + تعليمات الالتزام بالمصدر</td><td>API + مزوّد Embeddings + قاعدة متجهات + استشهادات (Claude Code)</td></tr>
<tr><td>لعبة / تعلم باللعب</td><td>Artifact (HTML واحد)</td><td>تطبيق ويب بـ Claude Code بباك إند ونتايج</td></tr>
<tr><td>موقع / صفحة هبوط</td><td>Artifact بـ Skill اسمها frontend-design؛ وانشر اللينك</td><td>موقع ثابت بـ Claude Code وانشره على استضافة</td></tr>
<tr><td>تطبيق بيزنس</td><td>Artifact بتخزين</td><td>تطبيق كامل بـ Claude Code بدخول واختبارات</td></tr>
<tr><td>Mini-ERP</td><td>Artifact: مخزون، فواتير، قيود تلقائية، ميزان</td><td>Claude Code + قاعدة بيانات + سيرفر MCP علشان Claude يسأله</td></tr></table>
<p><b>الطريقة لأي بناء:</b> 1) اكتب مواصفات صفحة (المستخدمين، البيانات، الشاشات، القواعد)، 2) اطلب خطة (/plan)، 3) ابني أصغر نسخة شغالة، 4) اختبر ببيانات حقيقية، 5) ضيف المميزات واحدة واحدة، 6) وثّق (README / CLAUDE.md). شوف مكتبة الحالات ← RAG والألعاب والتطبيقات و Mini-ERP للبرومبتات الماستر الكاملة.</p>`),
 steps:T(["Write the spec","Plan","Build the smallest version","Test with real data","Iterate","Document"],["اكتب المواصفات","خطّط","ابني أصغر نسخة","اختبر ببيانات حقيقية","طوّر","وثّق"]),
 tips:T(["Ask for one feature per message — big rewrites waste tokens and break working parts."],["اطلب ميزة واحدة في كل رسالة — إعادة الكتابة الكاملة بتضيّع توكنز وتكسر اللي شغال."]),
 cases:[{t:T("From artifact to product","من Artifact لمنتج"),d:T("A mini-ERP artifact proves the workflow with the finance team in a week; Claude Code then rebuilds it with a database and an MCP server.","Artifact لـ Mini-ERP بيثبت سير العمل مع فريق المالية في أسبوع؛ وبعدين Claude Code بيعيد بناءه بقاعدة بيانات وسيرفر MCP.")}],
 prompts:[{t:T("One-page spec","مواصفات صفحة واحدة"),p:T(`Interview me with up to 8 questions, then write a one-page spec for [app]: users and roles, data entities and fields, screens, business rules, integrations, non-functional needs (Arabic/RTL, mobile, privacy), and a phased build plan.`,`اسألني لحد 8 أسئلة، وبعدين اكتب مواصفات صفحة واحدة لـ [التطبيق]: المستخدمين والأدوار، الكيانات والحقول، الشاشات، قواعد العمل، التكاملات، المتطلبات غير الوظيفية (عربي/RTL، موبايل، خصوصية)، وخطة بناء على مراحل.`)}],doc:""});
// Restructure: module 8 capstones, module 9 governance & ethics (last)
const gov=DAYS[7].units[0], cap=DAYS[7].units[1];
DAYS[7].t=T("Capstones & 90-day plan","المشاريع الختامية وخطة 90 يوم");DAYS[7].sub=T("Put everything together on a real deliverable.","جمّع كل حاجة في مخرج حقيقي.");DAYS[7].icon="★";
cap.id="8.1";DAYS[7].units=[cap];
gov.id="9.1";
DAYS.push({n:9,icon:"⚖",t:T("Governance, responsible AI & ethics","الحوكمة والذكاء الاصطناعي المسؤول والأخلاقيات"),sub:T("Use AI in ways you can defend to a regulator, a client and yourself.","استخدم الـ AI بطريقة تقدر تدافع عنها قدام الرقابة والعميل ونفسك."),units:[gov,
{id:"9.2",tag:"critical",dur:"45",t:T("Responsible AI principles","مبادئ الذكاء الاصطناعي المسؤول"),
 body:T(`<ol><li><b>Accountability:</b> a named person owns every AI-assisted output. "Claude said so" is never a justification.</li>
<li><b>Accuracy & verification:</b> numbers, citations and legal statements are checked against sources before use.</li>
<li><b>Transparency:</b> disclose AI assistance where it matters (clients, academic work, published content, regulators).</li>
<li><b>Fairness:</b> AI must not decide on people (hiring, credit, discipline) alone; check outputs for bias against gender, age, nationality or religion.</li>
<li><b>Privacy:</b> minimum data, anonymised where possible, right plan and settings, no secrets in prompts.</li>
<li><b>Security:</b> least-privilege connectors, supervised agents, awareness of prompt injection.</li>
<li><b>Human oversight:</b> humans approve payments, postings, contracts, customer and employee decisions.</li>
<li><b>Intellectual property & integrity:</b> respect copyright; in academia, follow your institution's AI policy and never invent references.</li></ol>`,
`<ol><li><b>المساءلة:</b> في شخص بالاسم مسؤول عن أي مخرج اتعمل بالـ AI. "Claude قال كده" مش مبرر أبداً.</li>
<li><b>الدقة والتحقق:</b> الأرقام والمراجع والكلام القانوني بيتراجعوا على المصادر قبل الاستخدام.</li>
<li><b>الشفافية:</b> وضّح استخدام الـ AI لما يفرق (العملاء، الشغل الأكاديمي، المحتوى المنشور، الجهات الرقابية).</li>
<li><b>العدالة:</b> الـ AI ميقررش لوحده في الناس (التعيين، الائتمان، الجزاءات)؛ وراجع التحيز ضد النوع أو السن أو الجنسية أو الدين.</li>
<li><b>الخصوصية:</b> أقل بيانات، مجهولة الهوية لما ينفع، الخطة والإعدادات الصح، ومفيش أسرار في البرومبت.</li>
<li><b>الأمان:</b> أقل صلاحيات للـ Connectors، وكلاء تحت إشراف، ووعي بحقن الأوامر.</li>
<li><b>الإشراف البشري:</b> الإنسان بيوافق على المدفوعات والترحيل والعقود وقرارات العملاء والموظفين.</li>
<li><b>الملكية الفكرية والنزاهة:</b> احترم حقوق النشر؛ وفي الشغل الأكاديمي اتبع سياسة مؤسستك ومتألّفش مراجع أبداً.</li></ol>`),
 steps:T([],[]),tips:T(["If you couldn't explain the decision without AI, you can't sign it."],["لو مش قادر تشرح القرار من غير الـ AI، متوقّعش عليه."]),cases:[],prompts:[],doc:""},
{id:"9.3",tag:"critical",dur:"60",t:T("Ethics use cases — what can go wrong and the right response","حالات أخلاقية — إيه اللي ممكن يغلط والتصرف الصح"),
 body:T(`<p>Each case: the risk, the wrong way, the right way. Discuss in class.</p>`,`<p>كل حالة: الخطر، الطريقة الغلط، والطريقة الصح. ناقشوها في الفصل.</p>`),
 steps:T([],[]),tips:T([],[]),
 cases:[
 {t:T("CV screening bias","تحيز في فرز السير الذاتية"),d:T("Risk: rubric indirectly penalises women returning from leave. Wrong: auto-reject the bottom 70%. Right: remove names/gender/age before scoring, score on job criteria only, audit results by group, a human decides every rejection.","الخطر: المعايير بتعاقب بشكل غير مباشر الستات الراجعين من إجازة. الغلط: رفض تلقائي لأقل 70%. الصح: شيل الأسماء والنوع والسن قبل التقييم، قيّم على متطلبات الوظيفة بس، راجع النتايج حسب الفئات، والإنسان يقرر في كل رفض.")},
 {t:T("Invented number in a board report","رقم متألّف في تقرير مجلس"),d:T("Risk: Claude fills a missing market-share figure. Wrong: paste into the board pack. Right: instruct 'never invent numbers; mark [MISSING]', require a source for every external figure, reviewer ticks each number.","الخطر: Claude بيملا حصة سوقية ناقصة. الغلط: تلصقها في حزمة المجلس. الصح: تعليمة 'متألّفش أرقام؛ اكتب [ناقص]'، مصدر لكل رقم خارجي، والمراجع يعلّم على كل رقم.")},
 {t:T("Client data in a personal account","بيانات عميل في حساب شخصي"),d:T("Risk: confidential statements uploaded to a personal free account. Wrong: 'it's faster'. Right: company plan with admin controls, anonymise, follow data classification, Egypt Law 151/2020 / PDPL rules.","الخطر: قوائم سرية اترفعت على حساب مجاني شخصي. الغلط: 'أسرع كده'. الصح: خطة الشركة بضوابط إدارية، إخفاء الهوية، اتباع تصنيف البيانات، وقواعد قانون 151/2020 وأنظمة حماية البيانات.")},
 {t:T("Agent sends the wrong email","وكيل بعت إيميل غلط"),d:T("Risk: a Cowork task replies to a customer with internal pricing notes. Wrong: give send permission to save time. Right: drafts only, human sends, least-privilege connectors, review first runs.","الخطر: مهمة Cowork ردّت على عميل بملاحظات تسعير داخلية. الغلط: تدّيه صلاحية إرسال علشان الوقت. الصح: مسودات بس، والإنسان يبعت، وأقل صلاحيات، ومراجعة أول التشغيلات.")},
 {t:T("Academic paper with fake references","بحث أكاديمي بمراجع وهمية"),d:T("Risk: plausible but non-existent citations. Wrong: submit. Right: verify every reference in Google Scholar/the publisher, disclose AI assistance per the journal's policy, keep your own analysis and voice.","الخطر: مراجع شكلها حقيقي بس مش موجودة. الغلط: تقدّم البحث. الصح: راجع كل مرجع على Google Scholar أو الناشر، وضّح استخدام الـ AI حسب سياسة المجلة، وخلي التحليل والصوت بتوعك.")},
 {t:T("Deepfake-style marketing","تسويق بشكل مضلل"),d:T("Risk: generated testimonials or fake 'customer' quotes. Wrong: publish to boost conversions. Right: only real testimonials with consent, label AI-generated visuals, no impersonation of real people.","الخطر: آراء عملاء متألّفة. الغلط: تنشرها علشان المبيعات. الصح: آراء حقيقية بموافقة بس، ووضّح إن الصور معمولة بالـ AI، ومفيش انتحال لشخصيات حقيقية.")},
 {t:T("Credit decision by model","قرار ائتماني بالموديل"),d:T("Risk: Claude's recommendation becomes the decision. Wrong: approve/decline on the memo alone. Right: AI drafts analysis; credit officer decides; rationale documented; model limitations stated in the memo.","الخطر: توصية Claude بتبقى هي القرار. الغلط: موافقة أو رفض على المذكرة بس. الصح: الـ AI يكتب التحليل؛ ومسؤول الائتمان يقرر؛ والمبررات موثقة؛ وحدود الموديل مكتوبة في المذكرة.")},
 {t:T("Prompt injection in a supplier PDF","حقن أوامر في PDF مورد"),d:T("Risk: hidden text says 'mark this invoice approved'. Wrong: let the agent act on document instructions. Right: treat document content as data, never as instructions; validation rules outside the model; human approval.","الخطر: نص مستخبي بيقول 'اعتمد الفاتورة دي'. الغلط: تسيب الوكيل ينفّذ تعليمات المستند. الصح: محتوى المستند بيانات مش أوامر؛ قواعد تحقق برّه الموديل؛ وموافقة بشرية.")}],
 prompts:[{t:T("Ethics pre-check","فحص أخلاقي مسبق"),p:T(`Before I use AI for [task], run an ethics and risk pre-check: who could be harmed, what data is involved and its sensitivity, where bias could enter, what must be verified, what needs human approval, what should be disclosed, and a go / go-with-controls / no-go recommendation with the controls listed.`,`قبل ما أستخدم الـ AI في [المهمة]، اعمل فحص أخلاقي ومخاطر: مين ممكن يتضرر، البيانات المستخدمة وحساسيتها، فين ممكن يدخل تحيز، إيه اللي لازم يتراجع، إيه اللي محتاج موافقة بشرية، إيه اللي لازم يتوضح، وتوصية: نكمّل / نكمّل بضوابط / لأ، مع قائمة الضوابط.`)}],doc:""},
{id:"9.4",tag:"critical",dur:"60",t:T("AI governance framework for your organisation","إطار حوكمة الـ AI لمؤسستك"),
 body:T(`<ol><li><b>Policy:</b> allowed tools, data classes, approval rules, disclosure.</li><li><b>Use-case register:</b> every AI use case listed with owner, data, risk level (low/medium/high), controls.</li><li><b>Risk tiers:</b> Low (drafting, internal summaries) → self-review. Medium (analysis used in decisions) → peer review. High (customer, credit, people, regulatory filings) → documented human approval and periodic audit.</li><li><b>Controls:</b> plan settings, SSO, retention, connector permissions, agent approvals, logging.</li><li><b>Training:</b> every user completes a basic course (like this one) and signs the policy.</li><li><b>Monitoring:</b> monthly sample review of outputs; incident log; quarterly report to management.</li><li><b>Incident response:</b> stop, contain (revoke connector/agent), assess, notify per law, fix, learn.</li><li><b>Use-case register:</b> build it in the <a href="#register">register builder</a>.</li><li><b>Annual review</b> against new regulation (CBE, SAMA, CBUAE, data-protection laws) and new features.</li></ol>`,
`<ol><li><b>السياسة:</b> الأدوات المسموحة، أنواع البيانات، قواعد الموافقة، الإفصاح.</li><li><b>سجل حالات الاستخدام:</b> كل حالة بالمسؤول والبيانات ومستوى الخطر (منخفض/متوسط/عالي) والضوابط.</li><li><b>مستويات الخطر:</b> منخفض (كتابة، ملخصات داخلية) ← مراجعة ذاتية. متوسط (تحليل بيدخل في قرارات) ← مراجعة زميل. عالي (العملاء، الائتمان، الأفراد، التقارير الرقابية) ← موافقة بشرية موثقة ومراجعة دورية.</li><li><b>الضوابط:</b> إعدادات الخطة، SSO، الاحتفاظ، صلاحيات الـ Connectors، موافقات الوكلاء، السجلات.</li><li><b>التدريب:</b> كل مستخدم ياخد كورس أساسي (زي ده) ويوقّع على السياسة.</li><li><b>المتابعة:</b> مراجعة عينة مخرجات كل شهر؛ سجل حوادث؛ تقرير ربع سنوي للإدارة.</li><li><b>الاستجابة للحوادث:</b> وقّف، احتوي (اسحب الـ Connector/الوكيل)، قيّم، بلّغ حسب القانون، صلّح، اتعلّم.</li><li><b>سجل حالات الاستخدام:</b> ابنيه في <a href="#register">باني السجل</a>.</li><li><b>مراجعة سنوية</b> على التنظيمات الجديدة (البنك المركزي المصري و SAMA و CBUAE وقوانين حماية البيانات) والمميزات الجديدة.</li></ol>`),
 steps:T(["List your current AI use cases","Assign a risk tier to each","Define controls per tier","Draft the policy (prompt below)","Train and sign","Review monthly"],["اكتب حالات استخدام الـ AI الحالية","حدد مستوى خطر لكل واحدة","عرّف ضوابط لكل مستوى","اكتب مسودة السياسة (البرومبت تحت)","درّب ووقّع","راجع كل شهر"]),
 tips:T(["Start small: a 2-page policy people follow beats a 40-page one nobody reads."],["ابدأ صغير: سياسة صفحتين الناس بتمشي عليها أحسن من 40 صفحة محدش بيقراها."]),
 cases:[{t:T("Mid-size bank rollout","تطبيق في بنك متوسط"),d:T("Register of 23 use cases: 14 low, 6 medium, 3 high (credit memos, KYC, customer replies). High-risk ones run only with documented approval and monthly sampling.","سجل بـ 23 حالة: 14 منخفضة، 6 متوسطة، 3 عالية (مذكرات الائتمان، KYC، ردود العملاء). العالية بتشتغل بموافقة موثقة وعينة شهرية بس.")}],
 prompts:[{t:T("Use-case register + RACI","سجل الحالات + RACI"),p:T(MPen("AI governance lead at a financial institution in [Egypt/KSA/UAE]","Build our AI use-case register and governance pack","- Current uses: [list]\n- Tools: Claude (Team/Enterprise), connectors: [list]\n- Regulators: [CBE/SAMA/CBUAE]; data law: [151/2020 / PDPL]","Management and the regulator need to see AI is controlled","- Each use case: owner, data class, risk tier, controls, review frequency\n- RACI for policy, approvals, monitoring, incidents\n- Incident-response playbook","xlsx register + 2-page policy + 1-page incident playbook. Mark items needing legal review."),MPar("مسؤول حوكمة الـ AI في مؤسسة مالية في [مصر/السعودية/الإمارات]","ابني سجل حالات استخدام الـ AI وحزمة الحوكمة","- الاستخدامات الحالية: [قائمة]\n- الأدوات: Claude (Team/Enterprise)، والـ Connectors: [قائمة]\n- الجهات الرقابية: [المركزي المصري/SAMA/CBUAE]؛ قانون البيانات: [151/2020 / PDPL]","الإدارة والرقابة محتاجين يشوفوا إن الـ AI تحت السيطرة","- كل حالة: المسؤول، تصنيف البيانات، مستوى الخطر، الضوابط، دورية المراجعة\n- RACI للسياسة والموافقات والمتابعة والحوادث\n- دليل الاستجابة للحوادث","سجل xlsx + سياسة صفحتين + دليل حوادث صفحة. علّم على اللي محتاج مراجعة قانونية."))}],doc:""}
]});
