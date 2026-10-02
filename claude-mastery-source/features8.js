// ---------- Round 8: interactive diagrams, Arabic writing coach, Claude Finance Department ----------
const UX16={diag:T('Interactive diagrams','رسومات تفاعلية'),coach:T('Arabic writing coach','مدرّب الكتابة العربي'),fd:T('Claude Finance Department','الإدارة المالية بـ Claude')};
const FD=[];

// ---------- 17. Interactive diagrams ----------
// node: [id,x,y,w,h,label,kind] — kind 'box' (default) | 'frame' (outline only) | 'seg' (bar segment)
const DIAG=[
{k:'context',icon:'🪟',t:T('The context window','نافذة السياق (Context window)'),d:T('Everything Claude can "see" in one conversation shares one budget of tokens.','كل اللي Claude شايفه في المحادثة الواحدة بيتشارك في ميزانية واحدة من التوكنز.'),
nodes:[['win',30,70,580,90,T('Context window','نافذة السياق'),'frame'],['sys',40,80,90,70,T('Instructions','التعليمات'),'seg'],['kn',135,80,120,70,T('Files & knowledge','الملفات والمعرفة'),'seg'],['chat',260,80,140,70,T('Conversation','المحادثة'),'seg'],['tool',405,80,95,70,T('Tool results','نتايج الأدوات'),'seg'],['ans',505,80,95,70,T('Answer','الرد'),'seg'],['full',170,205,300,60,T('Full? Summarise or start fresh','اتملت؟ لخّص أو ابدأ جديد'),'box']],
edges:[['win','full']],
steps:[{on:['win'],c:T('Think of the context window as one desk. Everything must fit on it at the same time.','اعتبر نافذة السياق مكتب واحد. كل حاجة لازم تتحط عليه في نفس الوقت.')},
{on:['win','sys'],c:T('First come the instructions: the system prompt, project instructions and any Skill that was loaded.','الأول التعليمات: الـ system prompt وتعليمات المشروع وأي Skill اتحمّلت.')},
{on:['win','sys','kn'],c:T('Then the files and knowledge you attach. Big PDFs and spreadsheets take a large share.','بعدين الملفات والمعرفة اللي بترفعها. ملفات الـ PDF والإكسل الكبيرة بتاخد مساحة كبيرة.')},
{on:['win','sys','kn','chat'],c:T('Every message — yours and Claude’s — stays on the desk while the conversation continues.','كل رسالة — بتاعتك وبتاعة Claude — بتفضل على المكتب طول ما المحادثة مستمرة.')},
{on:['win','sys','kn','chat','tool'],c:T('Tool results (web search, files read, code output) are added too.','نتايج الأدوات (بحث الويب، الملفات اللي اتقرت، ناتج الكود) بتتضاف كمان.')},
{on:['win','sys','kn','chat','tool','ans'],c:T('Claude’s answer needs space as well. Long outputs need room left on the desk.','رد Claude نفسه محتاج مساحة. الردود الطويلة محتاجة مكان فاضي على المكتب.')},
{on:['win','full','w>full'],c:T('When it gets full, older parts may be summarised or you should start a new chat. Keep key facts in a Project so they come back every time.','لما يتملي، الأجزاء القديمة ممكن تتلخص أو تبدأ محادثة جديدة. حط الحقائق المهمة في Project علشان ترجع كل مرة.')}]},
{k:'tools',icon:'🛠',t:T('How tool use works','إزاي Claude بيستخدم الأدوات'),d:T('Claude decides when a tool is needed, calls it, reads the result, then answers.','Claude بيقرر إمتى يحتاج أداة، يستدعيها، يقرا النتيجة، وبعدين يرد.'),
nodes:[['u',30,120,120,60,T('You','إنت')],['c',250,120,140,60,T('Claude','Claude')],['t',480,30,130,60,T('Tool: search, code, connector','أداة: بحث، كود، موصّل')],['a',480,210,130,60,T('Answer + sources','الرد + المصادر')]],
edges:[['u','c',T('question','سؤال')],['c','t',T('tool call','استدعاء')],['t','c',T('result','نتيجة')],['c','a',T('answer','رد')]],
steps:[{on:['u','u>c'],c:T('You ask a question, for example: «What is the current EGP/USD rate trend this month?»','بتسأل سؤال، مثلاً: «إيه اتجاه سعر الجنيه قصاد الدولار الشهر ده؟»')},
{on:['c'],c:T('Claude checks whether it can answer from what it already has, or needs fresh data.','Claude بيشوف هل يقدر يرد من اللي عنده، ولا محتاج بيانات جديدة.')},
{on:['c','c>t','t'],c:T('It calls a tool — web search, code execution or a connector such as Google Drive — with specific inputs.','بيستدعي أداة — بحث ويب، تشغيل كود، أو موصّل زي Google Drive — بمدخلات محددة.')},
{on:['t','t>c','c'],c:T('The tool returns a result. Claude reads it like new context and may call another tool.','الأداة بترجع نتيجة. Claude بيقراها كسياق جديد، وممكن يستدعي أداة تانية.')},
{on:['c','c>a','a'],c:T('Claude writes the answer and cites where the facts came from. You still verify important numbers.','Claude بيكتب الرد ويقول المعلومات جت منين. وإنت لسه بتراجع الأرقام المهمة.')}]},
{k:'agent',icon:'🔄',t:T('The agentic loop','الحلقة الوكيلية'),d:T('An agent repeats plan → act → check until the goal is met, with a human gate before risky actions.','الوكيل بيكرر خطط ← نفّذ ← راجع لحد ما الهدف يتحقق، مع موافقة بشرية قبل أي خطوة فيها مخاطرة.'),
nodes:[['g',20,125,100,50,T('Goal','الهدف')],['p',160,40,110,50,T('Plan','خطة')],['x',330,40,110,50,T('Act with tools','نفّذ بالأدوات')],['o',330,210,110,50,T('Observe','لاحظ النتيجة')],['r',160,210,110,50,T('Review','راجع')],['h',480,125,130,50,T('Human approval','موافقة بشرية')],['d',480,230,130,50,T('Deliver','سلّم')]],
edges:[['g','p'],['p','x'],['x','o'],['o','r'],['r','p',T('repeat','كرر')],['r','h',T('done?','خلص؟')],['h','d']],
steps:[{on:['g'],c:T('Start with ONE clear goal and a stop condition, e.g. «Month-end pack ready, totals reconcile».','ابدأ بهدف واحد واضح وشرط توقف، مثلاً: «حزمة نهاية الشهر جاهزة والإجماليات متطابقة».')},
{on:['g','g>p','p'],c:T('The agent breaks the goal into steps.','الوكيل بيقسّم الهدف لخطوات.')},
{on:['p','p>x','x'],c:T('It acts: reads files, runs code, queries a connector.','بينفّذ: يقرا ملفات، يشغّل كود، يسأل موصّل.')},
{on:['x','x>o','o'],c:T('It observes what happened — including errors.','بيلاحظ اللي حصل — حتى الأخطاء.')},
{on:['o','o>r','r','r>p','p'],c:T('It reviews against the goal. Not done? Back to planning — this loop is what makes it an agent.','بيراجع قصاد الهدف. لسه؟ يرجع يخطط — الحلقة دي هي اللي بتخليه وكيل.')},
{on:['r','r>h','h'],c:T('Before anything risky — posting, paying, sending — a person approves.','قبل أي حاجة فيها مخاطرة — ترحيل، دفع، إرسال — إنسان بيوافق.')},
{on:['h','h>d','d'],c:T('Then it delivers, with a log of what it did.','وبعدين يسلّم، ومعاه سجل باللي عمله.')}]},
{k:'mcp',icon:'🔌',t:T('How MCP connects Claude to your systems','إزاي MCP بيوصّل Claude بأنظمتك'),d:T('MCP is a standard plug: each server exposes tools that Claude can call with your permission.','MCP فيشة موحّدة: كل سيرفر بيعرض أدوات Claude يقدر يستدعيها بإذنك.'),
nodes:[['c',30,120,130,60,T('Claude app','تطبيق Claude')],['s1',260,30,130,50,T('MCP server: Drive','سيرفر MCP: Drive')],['s2',260,125,130,50,T('MCP server: CRM','سيرفر MCP: CRM')],['s3',260,220,130,50,T('MCP server: database','سيرفر MCP: قاعدة بيانات')],['y',480,125,130,50,T('Your systems','أنظمتك')]],
edges:[['c','s1'],['c','s2'],['c','s3'],['s1','y'],['s2','y'],['s3','y']],
steps:[{on:['c'],c:T('You add a connector in Claude. Under the hood, many connectors use MCP.','بتضيف موصّل في Claude. كتير من الموصّلات بتشتغل بـ MCP من جوه.')},
{on:['c','c>s1','c>s2','c>s3','s1','s2','s3'],c:T('Each MCP server tells Claude which tools it offers, e.g. «search files», «get deal».','كل سيرفر MCP بيقول لـ Claude الأدوات اللي عنده، زي «دوّر في الملفات» أو «هات الصفقة».')},
{on:['c','c>s2','s2'],c:T('When your request needs it, Claude calls one tool with specific inputs.','لما طلبك يحتاج، Claude بيستدعي أداة واحدة بمدخلات محددة.')},
{on:['s2','s2>y','y'],c:T('The server talks to your system using the access you granted — nothing more.','السيرفر بيكلم نظامك بالصلاحية اللي إنت اديتها — مش أكتر.')},
{on:['c','s2','y'],c:T('Results come back to Claude. Keep write actions behind approval and give the least access needed.','النتايج بترجع لـ Claude. خلّي أي كتابة أو تعديل بموافقة، واِدّي أقل صلاحية لازمة.')}]},
{k:'skills',icon:'🧩',t:T('How Skills load','إزاي الـ Skills بتتحمّل'),d:T('Skills load in layers, so many Skills can be installed without filling the context window.','الـ Skills بتتحمّل على طبقات، فممكن يبقى عندك Skills كتير من غير ما تملا نافذة السياق.'),
nodes:[['m',20,40,170,60,T('All Skills: name + description','كل الـ Skills: الاسم + الوصف')],['q',20,200,170,60,T('Your request','طلبك')],['k',250,120,140,60,T('Match','مطابقة')],['b',450,40,160,60,T('SKILL.md instructions','تعليمات SKILL.md')],['f',450,200,160,60,T('Extra files & scripts','ملفات وسكربتات إضافية')]],
edges:[['m','k'],['q','k'],['k','b'],['b','f',T('only if needed','لو محتاج بس')]],
steps:[{on:['m'],c:T('Claude always sees a short line for each Skill: its name and description. That is why the description matters.','Claude دايمًا شايف سطر قصير لكل Skill: الاسم والوصف. علشان كده الوصف مهم.')},
{on:['q'],c:T('Your request arrives, e.g. «Build the 13-week cash forecast».','طلبك بيوصل، مثلاً: «اعمل توقع الكاش لـ 13 أسبوع».')},
{on:['m','q','m>k','q>k','k'],c:T('Claude matches the request to the most relevant Skill description.','Claude بيطابق الطلب مع وصف الـ Skill الأنسب.')},
{on:['k','k>b','b'],c:T('Only then does it read that Skill’s full SKILL.md instructions.','ساعتها بس بيقرا تعليمات SKILL.md كاملة للـ Skill دي.')},
{on:['b','b>f','f'],c:T('Templates, examples or scripts in the Skill folder are opened only when the task needs them.','القوالب أو الأمثلة أو السكربتات اللي في فولدر الـ Skill بتتفتح بس لما المهمة تحتاجها.')}]},
{k:'prompt',icon:'🧱',t:T('Anatomy of a master prompt','تشريح البرومبت الماستر'),d:T('Six blocks, each closing one gap Claude would otherwise guess.','ست بلوكات، كل واحدة بتقفل فجوة Claude كان هيخمّنها.'),
nodes:[['r',20,20,170,50,T('Role','الدور')],['t',20,85,170,50,T('Task','المهمة')],['x',20,150,170,50,T('Context','السياق')],['e',20,215,170,50,T('Reasoning','طريقة التفكير')],['s',230,215,170,50,T('Stop when','اقف لما')],['f',230,150,170,50,T('Output format','شكل المخرج')],['c',450,110,160,70,T('Decision-ready answer','رد جاهز للقرار')]],
edges:[['r','c'],['t','c'],['x','c'],['e','c'],['s','c'],['f','c']],
steps:[{on:['r','r>c'],c:T('Role: who Claude should be — expertise, market and audience. Sets vocabulary and depth.','الدور: Claude يبقى مين — الخبرة والسوق والجمهور. بيحدد المصطلحات والعمق.')},
{on:['t','t>c'],c:T('Task: one clear verb and deliverable. Vague tasks get vague answers.','المهمة: فعل واحد واضح ومخرج محدد. المهمة المبهمة بتجيب رد مبهم.')},
{on:['x','x>c'],c:T('Context: the facts, data and constraints — and «use only the attached data».','السياق: الحقائق والبيانات والقيود — و«استخدم البيانات المرفقة بس».')},
{on:['e','e>c'],c:T('Reasoning: how to think — steps, checks, assumptions labelled.','طريقة التفكير: يفكر إزاي — خطوات ومراجعات وافتراضات متعلّمة.')},
{on:['s','s>c'],c:T('Stop when: limits and the point where the answer is complete. Prevents rambling.','اقف لما: الحدود واللحظة اللي الرد فيها يبقى كامل. بيمنع اللف والدوران.')},
{on:['f','f>c'],c:T('Output format: table, memo, JSON, language and length.','شكل المخرج: جدول، مذكرة، JSON، اللغة والطول.')},
{on:['r','t','x','e','s','f','c','r>c','t>c','x>c','e>c','s>c','f>c'],c:T('Together they produce an answer you can act on — and that you can check.','مع بعض بيطلّعوا رد تقدر تاخد بيه قرار — وتقدر تراجعه.')}]},
{k:'hitl',icon:'✅',t:T('A finance agent with human approval','وكيل مالي بموافقة بشرية'),d:T('How a Claude finance agent fits inside your controls.','إزاي وكيل Claude المالي يدخل جوه الضوابط بتاعتك.'),
nodes:[['d',20,120,110,60,T('Source data','البيانات')],['a',170,120,120,60,T('Agent drafts','الوكيل يكتب مسودة')],['k',330,120,110,60,T('Checks','مراجعات')],['h',480,40,130,60,T('Reviewer approves','المراجع يوافق')],['p',480,200,130,60,T('Post / pay / send','ترحيل / دفع / إرسال')]],
edges:[['d','a'],['a','k'],['k','h'],['h','p'],['k','a',T('fix','صلّح')]],
steps:[{on:['d','d>a','a'],c:T('The agent reads only the data you give it — ledger extracts, bank files, invoices.','الوكيل بيقرا البيانات اللي إنت بتديهاله بس — مستخرجات الدفاتر، ملفات البنك، الفواتير.')},
{on:['a','a>k','k'],c:T('Its Skill runs the checks: totals reconcile, every assumption labelled, gaps marked [MISSING].','الـ Skill بتاعته بتعمل المراجعات: الإجماليات متطابقة، كل افتراض متعلّم، والناقص مكتوب [MISSING].')},
{on:['k','k>a','a'],c:T('If a check fails, it fixes the draft before showing you.','لو مراجعة فشلت، بيصلّح المسودة قبل ما يوريهالك.')},
{on:['k','k>h','h'],c:T('A named reviewer approves. The agent never posts journals, releases payments or emails customers on its own.','مراجع باسمه بيوافق. الوكيل عمره ما يرحّل قيود أو يصرف فلوس أو يبعت إيميل لعميل لوحده.')},
{on:['h','h>p','p'],c:T('Only then is the action taken — in your system, by your people.','ساعتها بس الإجراء بيتعمل — في نظامك، وبإيد فريقك.')}]}];
let DG={k:'context',s:0,play:false};
function dgSVG(D,s){const st=D.steps[s]||D.steps[0];const on=new Set(st.on);const N={};D.nodes.forEach(n=>N[n[0]]=n);const ar=LANG==='ar';
const ctr=n=>[n[1]+n[3]/2,n[2]+n[4]/2];
const edge=e=>{const a=N[e[0]],b=N[e[1]];if(!a||!b)return '';const [x1,y1]=ctr(a),[x2,y2]=ctr(b);const clip=(n,x,y,dx,dy)=>{const hw=n[3]/2+4,hh=n[4]/2+4;const t=Math.min(dx?hw/Math.abs(dx):1e9,dy?hh/Math.abs(dy):1e9);return [x+dx*t,y+dy*t]};
const dx=x2-x1,dy=y2-y1;const back=D.edges.some(f=>f[0]===e[1]&&f[1]===e[0]);const off=back?(e[0]<e[1]?8:-8):0;const nx=-dy/Math.hypot(dx,dy)*off,ny=dx/Math.hypot(dx,dy)*off;
const [sx,sy]=clip(a,x1,y1,dx,dy),[ex,ey]=clip(b,x2,y2,-dx,-dy);const id=e[0]+'>'+e[1];const act=on.has(id)||(e[0]==='win'&&on.has('w>'+e[1]));
const lab=e[2]?`<text x="${(sx+ex)/2+nx+(dy?8:0)}" y="${(sy+ey)/2+ny-6}" class="dgel" text-anchor="middle">${esc(L(e[2]))}</text>`:'';
return `<line x1="${sx+nx}" y1="${sy+ny}" x2="${ex+nx}" y2="${ey+ny}" class="dge ${act?'on':''}" marker-end="url(#dgarr${act?'on':''})"/>${lab}`};
const node=n=>{const act=on.has(n[0]);const kind=n[6]||'box';const lbl=L(n[5]);const words=lbl.split(' ');const lines=[];let cur='';const max=Math.max(8,Math.floor(n[3]/7.2));words.forEach(w=>{if((cur+' '+w).trim().length>max&&cur){lines.push(cur);cur=w}else cur=(cur+' '+w).trim()});if(cur)lines.push(cur);
const ty=n[2]+n[4]/2-(lines.length-1)*8+4;
return `<g class="dgn ${kind} ${act?'on':''}"><rect x="${n[1]}" y="${n[2]}" width="${n[3]}" height="${n[4]}" rx="${kind==='seg'?6:12}"/>${kind==='frame'?`<text x="${n[1]+10}" y="${n[2]-8}" class="dgft" text-anchor="start">${esc(lbl)}</text>`:lines.map((l,i)=>`<text x="${n[1]+n[3]/2}" y="${ty+i*16}" text-anchor="middle">${esc(l)}</text>`).join('')}</g>`};
return `<svg class="dgsvg" viewBox="0 0 640 290" role="img" aria-label="${esc(L(D.t))}" ${ar?'direction="rtl"':''}><defs><marker id="dgarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" class="dgah"/></marker><marker id="dgarron" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" class="dgah on"/></marker></defs>${D.edges.map(edge).join('')}${D.nodes.map(node).join('')}</svg>`}
function vDiagrams(){const seg=location.hash.slice(1).split('/');if(seg[1]&&DIAG.find(d=>d.k===seg[1])&&seg[1]!==DG.k){DG.k=seg[1];DG.s=0}
crumb(L(UX16.diag));const ar=LANG==='ar';const D=DIAG.find(d=>d.k===DG.k)||DIAG[0];const s=Math.min(DG.s,D.steps.length-1);
return `<h1>🎞 ${L(UX16.diag)}</h1><p class="lede">${ar?'شوف المفاهيم الصعبة بتتحرك خطوة بخطوة. دوس «التالي» أو «شغّل».':'Watch the hard ideas move step by step. Press «Next» or «Play».'}</p>
<div class="chips">${DIAG.map(d=>`<button class="chip ${d.k===D.k?'on':''}" data-dgk="${d.k}">${d.icon} ${L(d.t)}</button>`).join('')}</div>
<section class="dgbox card"><h2 style="margin-top:0">${D.icon} ${L(D.t)}</h2><p class="k">${L(D.d)}</p><div id="dgstage">${dgSVG(D,s)}</div>
<div class="dgcap" aria-live="polite"><b>${s+1}/${D.steps.length}</b> ${L(D.steps[s].c)}</div>
<div class="dgdots">${D.steps.map((_,i)=>`<button class="dgdot ${i===s?'on':''} ${i<s?'done':''}" data-dgs="${i}" aria-label="${i+1}"></button>`).join('')}</div>
<div class="row-btns"><button class="tbtn" data-dg="prev" ${s===0?'disabled':''}>${ar?'→ السابق':'← Previous'}</button><button class="btn-gold" data-dg="play">${DG.play?(ar?'⏸ وقّف':'⏸ Pause'):(ar?'▶ شغّل':'▶ Play')}</button><button class="tbtn" data-dg="next" ${s===D.steps.length-1?'disabled':''}>${ar?'التالي ←':'Next →'}</button></div></section>
<p class="note">${ar?'الرسومات تبسيط للتعليم. التفاصيل بتختلف حسب المنتج والخطة — كما في سبتمبر 2026.':'Diagrams are simplified for learning. Details vary by product and plan — as of Sept 2026.'}</p>`}
let DGT=null;
function dgTick(){const D=DIAG.find(d=>d.k===DG.k);if(!DG.play||!document.querySelector('.dgbox')||!D){DG.play=false;clearInterval(DGT);DGT=null;if(document.querySelector('.dgbox'))render();return}
if(DG.s>=D.steps.length-1){DG.play=false;clearInterval(DGT);DGT=null;render();return}DG.s++;dgPaint()}
function dgPaint(){const D=DIAG.find(d=>d.k===DG.k);const box=document.querySelector('.dgbox');if(!box||!D){render();return}const s=DG.s;
document.getElementById('dgstage').innerHTML=dgSVG(D,s);box.querySelector('.dgcap').innerHTML=`<b>${s+1}/${D.steps.length}</b> ${L(D.steps[s].c)}`;box.querySelectorAll('.dgdot').forEach((b,i)=>{b.classList.toggle('on',i===s);b.classList.toggle('done',i<s)});
const [p,pl,n]=box.querySelectorAll('[data-dg]');p.disabled=s===0;n.disabled=s===D.steps.length-1;const ar=LANG==='ar';pl.textContent=DG.play?(ar?'⏸ وقّف':'⏸ Pause'):(ar?'▶ شغّل':'▶ Play');
if(s===D.steps.length-1&&!ST.dgDone?.[D.k]){ST.dgDone=Object.assign({},ST.dgDone,{[D.k]:1});addXP(3);saveST()}}

// ---------- 28. Arabic writing coach (Studio tab) ----------
let AC=Object.assign({txt:'',purpose:'email',reg:'msa',aud:'',res:null,busy:false},ST.ac||{});
const AC_P=[['email',T('Work email','إيميل شغل')],['report',T('Report / memo','تقرير / مذكرة')],['post',T('LinkedIn post','بوست LinkedIn')],['board',T('Board or management note','مذكرة لمجلس الإدارة أو الإدارة')],['customer',T('Customer message','رسالة لعميل')],['policy',T('Policy / procedure','سياسة / إجراء')]];
const AC_R=[['msa',T('Simple formal Arabic (MSA)','فصحى مبسطة رسمية')],['egy',T('Egyptian, professional','مصري مهني')],['gulf',T('Gulf-friendly formal','رسمي مناسب للخليج')]];
function acLocal(t){const out=[];if(!t.trim())return out;const push=(en,ar,ex)=>out.push([T(en,ar),ex||'']);
const sents=t.split(/[.!؟?\n]+/).map(s=>s.trim()).filter(Boolean);const longS=sents.filter(s=>s.split(/\s+/).length>35);if(longS.length)push(`${longS.length} very long sentence(s) (35+ words) — split them.`,`${longS.length} جملة طويلة جدًا (أكتر من 35 كلمة) — قسّمها.`,longS[0].slice(0,90)+'…');
if(/[؀-ۿ]\s*[,;?]/.test(t)||/[,;?]\s*[؀-ۿ]/.test(t))push('Latin punctuation inside Arabic — use ، ؛ ؟','علامات ترقيم إنجليزي جوه الكلام العربي — استخدم ، ؛ ؟',(t.match(/.{0,20}[؀-ۿ]\s*[,;?].{0,10}/)||[''])[0]);
if(/[0-9]/.test(t)&&/[٠-٩]/.test(t))push('Mixed digit styles (123 and ١٢٣) — pick one.','أرقام بشكلين (123 و١٢٣) — اختار شكل واحد.');
const rep=t.match(/(^|\s)([؀-ۿ]{2,})\s+\2(?=\s|$)/);if(rep)push('Repeated word.','كلمة متكررة ورا بعض.',rep[0].trim());
if(/ـ{2,}|([؀-ۿ])\1{2,}/.test(t))push('Stretched letters or tatweel (ـــ) look informal.','الحروف الممطوطة أو التطويل (ـــ) شكلها غير رسمي.');
if(/[،؛؟.!][؀-ۿ]/.test(t))push('Missing space after punctuation.','مفيش مسافة بعد علامة الترقيم.');
const words=t.split(/\s+/).filter(Boolean);const lat=words.filter(w=>/[A-Za-z]{3,}/.test(w)).length;if(words.length>15&&lat/words.length>.18)push(`${Math.round(lat*100/words.length)}% English words — keep only the terms your reader uses, and explain them once.`,`${Math.round(lat*100/words.length)}% كلمات إنجليزي — سيب بس المصطلحات اللي القارئ بيستخدمها، واشرحها مرة واحدة.`);
const paras=t.split(/\n\s*\n/).filter(p=>p.split(/\s+/).length>120);if(paras.length)push('A paragraph is over 120 words — break it up or use bullets.','فيه فقرة أكتر من 120 كلمة — قسّمها أو استخدم نقاط.');
if(/(?:^|\s)(جدا|جداً|جدًا)(?:\s|$)/.test(t)&&(t.match(/جد(?:ا|اً|ًا)/g)||[]).length>2)push('«جدًا» used many times — use precise words or numbers instead.','«جدًا» متكررة كتير — استخدم كلمات أدق أو أرقام.');
return out}
function vCoach(){const ar=LANG==='ar';const loc=acLocal(AC.txt);const wc=AC.txt.trim()?AC.txt.trim().split(/\s+/).length:0;
let h=`<p class="lede">${ar?'الصق نص عربي من شغلك — إيميل، تقرير، بوست. هتاخد فحص فوري، وبعدين Claude يراجع الوضوح والنبرة ويعيد الصياغة.':'Paste Arabic text from your work — an email, report or post. You get an instant check, then Claude reviews clarity and tone and rewrites it.'}</p>
<div class="twocol"><div class="abpane"><label class="pbf"><b>${ar?'النص العربي':'Your Arabic text'}</b><textarea class="search" id="acTxt" rows="11" dir="rtl" lang="ar">${esc(AC.txt)}</textarea></label><p class="k" style="font-size:12px">${wc} ${ar?'كلمة':'words'}</p>
<label class="pbf"><b>${ar?'نوع النص':'Purpose'}</b><select class="search" data-acf="purpose">${AC_P.map(p=>`<option value="${p[0]}" ${AC.purpose===p[0]?'selected':''}>${L(p[1])}</option>`).join('')}</select></label>
<label class="pbf"><b>${ar?'المستوى':'Register'}</b><select class="search" data-acf="reg">${AC_R.map(p=>`<option value="${p[0]}" ${AC.reg===p[0]?'selected':''}>${L(p[1])}</option>`).join('')}</select></label>
<label class="pbf"><b>${ar?'القارئ (اختياري)':'Reader (optional)'}</b><input class="search" data-acf="aud" value="${esc(AC.aud)}" placeholder="${ar?'مثلاً: المدير المالي، عميل سعودي':'e.g. the CFO, a Saudi customer'}"></label>
<div class="row-btns"><button class="btn-gold" data-ac="run" ${AC.busy?'disabled':''}>${AC.busy?(ar?'Claude بيراجع…':'Claude is reviewing…'):'✍ '+(ar?'راجع وأعد الصياغة مع Claude':'Review & rewrite with Claude')}</button><button class="tbtn" data-ac="clear">${ar?'امسح':'Clear'}</button></div><p class="note" id="acnote"></p></div>
<div class="abpane"><h3>${ar?'فحص فوري':'Instant check'}</h3>${AC.txt.trim()?(loc.length?`<ul class="lint">${loc.map(f=>`<li class="no">✗ ${L(f[0])}${f[1]?`<div class="k" dir="auto" style="font-size:12px">«${esc(f[1])}»</div>`:''}</li>`).join('')}</ul>`:`<p class="k">✓ ${ar?'مفيش مشاكل شكلية واضحة. Claude هيراجع الوضوح والنبرة.':'No obvious surface issues. Claude will review clarity and tone.'}</p>`):`<p class="k">${ar?'الصق نص علشان تشوف الفحص.':'Paste text to see the check.'}</p>`}
<h3 style="margin-top:14px">${ar?'قواعد سريعة':'Quick rules'}</h3><ul class="k" style="font-size:13px"><li>${ar?'جملة واحدة = فكرة واحدة.':'One sentence = one idea.'}</li><li>${ar?'ابدأ بالمطلوب أو الخلاصة.':'Lead with the ask or the conclusion.'}</li><li>${ar?'الأرقام بشكل واحد، والعملة جنب الرقم (5,000 ج.م).':'One digit style; currency next to the number (EGP 5,000).'}</li><li>${ar?'المصطلح الإنجليزي مرة واحدة بين قوسين، وبعد كده العربي.':'Give the English term once in brackets, then use the Arabic.'}</li></ul></div></div>`;
if(AC.res){const r=AC.res;const i=PSTORE.push(r.rewrite||'')-1;h+=`<h2>${ar?'مراجعة Claude':'Claude’s review'} ${typeof r.score==='number'?`<span class="pkscore ${r.score>=80?'hi':r.score>=55?'mid':'lo'}">${r.score}/100</span>`:''}</h2>${r.summary?`<p dir="auto">${esc(r.summary)}</p>`:''}
${(r.issues||[]).length?`<div class="tablewrap"><table><tr><th>${ar?'النوع':'Type'}</th><th>${ar?'من نصك':'From your text'}</th><th>${ar?'الأفضل':'Better'}</th></tr>${r.issues.map(f=>`<tr><td><b dir="auto">${esc(f.type)}</b></td><td dir="rtl">${esc(f.quote)}</td><td dir="rtl">${esc(f.fix)}</td></tr>`).join('')}</table></div>`:''}
<div class="twocol"><div class="abpane"><h3>${ar?'قبل':'Before'}</h3><div class="acbox" dir="rtl">${esc(AC.txt)}</div></div><div class="abpane"><h3>${ar?'بعد':'After'}</h3><div class="acbox" dir="rtl">${esc(r.rewrite||'')}</div><div class="row-btns"><button class="copy" data-i="${i}">${L(UI.copy)}</button><button class="tbtn" data-ac="use">${ar?'استخدمه كنص جديد':'Use as new text'}</button></div></div></div>
${r.tone?`<p class="note" dir="auto">🎯 ${esc(r.tone)}</p>`:''}`}
return h}
async function acRun(){const ar=LANG==='ar';const n=t=>{const e=document.getElementById('acnote');if(e)e.textContent=t};if(!AC.txt.trim()){n(ar?'الصق النص الأول.':'Paste your text first.');return}
if(!/[؀-ۿ]/.test(AC.txt)){n(ar?'المدرّب ده للنصوص العربي.':'This coach is for Arabic text.');return}
const sample=await tutorSample();if(!sample){n(ar?'المراجعة مع Claude بتشتغل لما المنصة تتفتح جوه Claude (claude.ai).':'Review with Claude works when the platform is opened inside Claude (claude.ai).');return}
AC.busy=true;render();const P=(AC_P.find(p=>p[0]===AC.purpose)||AC_P[0])[1].en,R=(AC_R.find(p=>p[0]===AC.reg)||AC_R[0])[1].en;
const ask=`You are an Arabic business-writing editor for professionals in Egypt and the Gulf. Review the Arabic text below. Purpose: ${P}. Target register: ${R}. Reader: ${AC.aud||'not specified'}.
Check: clarity (one idea per sentence, lead with the ask), tone for the reader, grammar and spelling, Arabic punctuation (، ؛ ؟), consistent numbers and currency, unnecessary English, wordiness and repetition. Keep every fact, number and name exactly; do not add new facts. Quote the exact words for each issue.
Write "type", "summary" and "tone" in ${ar?'Egyptian Arabic':'English'}; write "quote", "fix" and "rewrite" in Arabic in the target register.
Reply with JSON only: {"score":0,"summary":"","issues":[{"type":"","quote":"","fix":""}],"rewrite":"","tone":""}
score = 0-100 for how ready the ORIGINAL text is to send.

TEXT:
${AC.txt.slice(0,6000)}`;
try{const j=await sample.json(ask,{modelTier:'default'});if(!j||typeof j.rewrite!=='string')throw new Error('shape');AC.res={score:typeof j.score==='number'?Math.max(0,Math.min(100,Math.round(j.score))):null,summary:String(j.summary||''),tone:String(j.tone||''),rewrite:j.rewrite,issues:(j.issues||[]).slice(0,12).map(f=>({type:String(f.type||''),quote:String(f.quote||''),fix:String(f.fix||'')}))};
if(!ST.acXP){ST.acXP=1;addXP(5)}}
catch(e){AC.res=null;n(e&&e.code==='rate_limited'?(ar?'طلبات كتير — جرّب بعد شوية.':'Too many requests — try again in a moment.'):(ar?'مقدرتش أراجع دلوقتي. جرّب تاني.':'Could not review right now. Try again.'))}
AC.busy=false;saveAC();render()}
function saveAC(){const {busy,...r}=AC;ST.ac=r;saveST()}
{const _tabs=vStudioTabs;vStudioTabs=function(){return _tabs().replace(/<\/div>$/,`<button class="tab ${stuTab==='coach'?'on':''}" data-stutab="coach">✍ ${L(UX16.coach)}</button></div>`)}}
{const _vs=vStudio;vStudio=function(){if(stuTab!=='coach')return _vs();crumb(L(UX3.studio)+' › '+L(UX16.coach));return `<h1>🎛 ${L(UX3.studio)}</h1>`+vStudioTabs()+vCoach()}}

// ---------- Claude Finance Department: 10 functions · 50 agents · 50 skills ----------
let FDS={f:'fpa',q:'',open:''};
const fdList=s=>String(s||'').split('|').map(x=>x.trim()).filter(Boolean);
const fdSkill=k=>{for(const f of FD){const s=f.skills.find(x=>x.k===k);if(s)return s}return null};
const FDCOMMON={en:['Use only the data provided. If a number is missing, ask or write [MISSING] — never invent figures.','Show calculations and label every assumption and estimate.','You draft and recommend. A named person approves before anything is posted, paid, sent or filed.','Keep personal and confidential data inside approved tools; anonymise where you can.'],
ar:['استخدم البيانات المقدّمة بس. لو رقم ناقص اسأل أو اكتب [MISSING] — ممنوع تأليف أرقام.','وضّح الحسابات وعلّم على كل افتراض وتقدير.','إنت بتكتب مسودة وتوصية. شخص محدد بالاسم بيوافق قبل أي ترحيل أو دفع أو إرسال أو تقديم.','خلّي البيانات الشخصية والسرية جوه الأدوات المعتمدة، وشيل الأسماء لما تقدر.']};
function fdPrompt(a,f,lang){const x=k=>a[k][lang]||a[k].en;const sk=fdSkill(a.sk);const li=s=>fdList(s).map(i=>'- '+i).join('\n');const en=lang==='en';
const steps=sk?fdList(sk.steps[lang]).map((s,i)=>`${i+1}. ${s}`).join('\n'):'';
return `<role>
${en?`You are the ${a.n.en} in a Claude-powered finance department (${f.t.en}). ${x('role')}.`:`إنت «${a.n.ar}» في إدارة مالية شغالة بـ Claude (${f.t.ar}). ${x('role')}.`}
${en?'Market: Egypt and the GCC. Reporting under IFRS unless told otherwise.':'السوق: مصر والخليج. التقارير حسب IFRS ما لم يُذكر غير كده.'}
</role>

<task>
${x('job')}
</task>

<context>
${en?'Inputs you expect:':'المدخلات المتوقعة:'}
${li(x('in'))}
${en?'If an essential input is missing, ask up to 3 short questions before you start.':'لو مدخل أساسي ناقص، اسأل لحد 3 أسئلة قصيرة قبل ما تبدأ.'}

${en?'Your responsibilities:':'مسؤولياتك:'}
${li(x('resp'))}

${en?'Guardrails:':'الضوابط:'}
${li(x('guard'))}
${FDCOMMON[lang].map(i=>'- '+i).join('\n')}
</context>

<reasoning>
${sk?(en?`Follow the «${sk.n.en}» method:`:`اتبع طريقة «${sk.n.ar}»:`)+'\n'+steps:''}
</reasoning>

<stop_when>
${en?'Every output below is delivered, totals reconcile to the source, and open questions are listed. Do not go beyond the job above.':'كل المخرجات اللي تحت اتسلّمت، والإجماليات متطابقة مع المصدر، والأسئلة المفتوحة متسجلة. ما تتعداش المهمة اللي فوق.'}
</stop_when>

<output_format>
${en?'Start with a 3-line summary. Then deliver:':'ابدأ بملخص 3 سطور. وبعدين سلّم:'}
${li(x('out'))}
${en?'Use tables where possible. End with «Assumptions» and «Questions for the reviewer». Language: English. Currency as in the data (EGP by default).':'استخدم جداول على قد ما تقدر. اختم بـ «الافتراضات» و«أسئلة للمراجع». اللغة: العربية. العملة زي ما في البيانات (جنيه مصري افتراضيًا).'}
</output_format>`}
function fdSkillMd(s,lang){const en=lang==='en';const x=k=>s[k][lang]||s[k].en;
return `---
name: ${s.k}
description: ${JSON.stringify((s.when.en+' '+(en?'':s.when.ar)).replace(/\s+/g,' ').slice(0,1000))}
---

# ${s.n.en} — ${s.n.ar}

## ${en?'When to use':'تستخدمها إمتى'}
${x('when')}

## ${en?'Method':'الطريقة'}
${fdList(x('steps')).map((t,i)=>`${i+1}. ${t}`).join('\n')}

## ${en?'Output':'المخرج'}
${x('out')}

## ${en?'Quality checks':'مراجعات الجودة'}
${fdList(x('checks')).map(t=>'- [ ] '+t).join('\n')}

## ${en?'Guardrails':'الضوابط'}
${FDCOMMON[lang].map(t=>'- '+t).join('\n')}

---
Claude Mastery · Claude Finance Department
`}
function fdAll(){const r=[];FD.forEach(f=>f.agents.forEach(a=>r.push([f,a])));return r}
function vFinDept(){const seg=location.hash.slice(1).split('/');if(seg[1]&&FD.find(f=>f.k===seg[1]))FDS.f=seg[1];
crumb(L(UX16.fd));const ar=LANG==='ar';const done=ST.fdRun||{};const nA=fdAll().length,nS=FD.reduce((t,f)=>t+f.skills.length,0);
const F=FD.find(f=>f.k===FDS.f)||FD[0];if(!F)return `<h1>💼 ${L(UX16.fd)}</h1>`;
const q=FDS.q.trim().toLowerCase();const list=q?fdAll().filter(([f,a])=>(a.n.en+' '+a.n.ar+' '+a.role.en+' '+a.role.ar+' '+a.job.en+' '+a.job.ar+' '+(fdSkill(a.sk)||{n:{en:''}}).n.en).toLowerCase().includes(q)):F.agents.map(a=>[F,a]);
let h=`<h1>💼 ${L(UX16.fd)}</h1><p class="lede">${ar?`إدارة مالية كاملة على Claude: ${FD.length} وظائف، ${nA} وكيل، ${nS} Skill. كل وكيل ليه دور واحد، و system prompt جاهز للنسخ، ومدخلات ومخرجات، ومسؤوليات وضوابط، ومهمة عملية تشغّلها فورًا. وكل Skill بتدّي Claude طريقة ثابتة يكرر بيها الشغل.`:`A full finance department on Claude: ${FD.length} functions, ${nA} agents, ${nS} skills. Every agent has one role, a copy-and-paste system prompt, inputs and outputs, responsibilities and guardrails, and a practical task you can run now. Every skill gives Claude a repeatable method.`}</p>
<div class="fdhow">${[['1',T('Copy the system prompt','انسخ الـ system prompt'),T('Paste it into a Claude Project’s instructions, or start a Cowork task with it.','الصقه في تعليمات Project على Claude، أو ابدأ بيه مهمة في Cowork.')],['2',T('Add the skill','ضيف الـ Skill'),T('Download SKILL.md and upload it as a Skill where your plan allows — Claude then repeats the method every time.','نزّل SKILL.md وارفعه كـ Skill لو خطتك بتسمح — وClaude هيكرر الطريقة كل مرة.')],['3',T('Run the practical task','شغّل المهمة العملية'),T('Use the sample data, then your own. A person reviews before anything is posted, paid or sent.','استخدم البيانات التجريبية، وبعدين بياناتك. إنسان بيراجع قبل أي ترحيل أو دفع أو إرسال.')]].map(s=>`<div><b class="fdn">${s[0]}</b><h3>${L(s[1])}</h3><p class="k">${L(s[2])}</p></div>`).join('')}</div>
<div class="fdorg"><div class="fdcfo">🏛 ${ar?'المدير المالي (إنت)':'CFO (you)'}<span class="k">${Object.keys(done).length}/${nA} ${ar?'مهمة اتشغلت':'tasks run'}</span></div><div class="fdfns">${FD.map(f=>{const d=f.agents.filter(a=>done[a.k]).length;return `<button class="fdfn ${f.k===F.k&&!q?'on':''}" data-fdf="${f.k}"><span class="fdi">${f.icon}</span><b>${L(f.t)}</b><span class="k">${f.agents.length} ${ar?'وكلاء':'agents'} · ${d}/${f.agents.length} ✓</span></button>`}).join('')}</div></div>
<div class="row-btns" style="margin:12px 0"><input class="search" id="fdq" value="${esc(FDS.q)}" placeholder="${ar?'دوّر على وكيل أو Skill… (مثلاً: كاش، فواتير، مجلس)':'Search agents or skills… (e.g. cash, invoices, board)'}" style="flex:1;min-width:200px"><button class="tbtn" data-fdzip="${F.k}">⬇ ${ar?'الوظيفة دي (ZIP)':'This function (ZIP)'}</button><button class="btn-gold" data-fdzip="all">⬇ ${ar?'الإدارة كلها (ZIP)':'Whole department (ZIP)'}</button></div>`;
if(!q)h+=`<h2>${F.icon} ${L(F.t)}</h2><p class="k">${L(F.d)}</p>`;else h+=`<h2>${list.length} ${ar?'نتيجة':'results'}</h2>`;
h+=`<div class="fdlist">${list.map(([f,a])=>fdCard(f,a)).join('')||`<p class="k">${ar?'مفيش نتايج.':'No results.'}</p>`}</div>`;
if(!q){h+=`<h2>🧩 ${ar?'الـ Skills في الوظيفة دي':'Skills in this function'}</h2><div class="grid">${F.skills.map(s=>`<div class="card"><h3>🧩 ${L(s.n)}</h3><p class="k" style="font-size:13px">${L(s.when)}</p><ol class="fdsteps">${fdList(L(s.steps)).map(t=>`<li>${esc(t)}</li>`).join('')}</ol><div class="row-btns"><button class="tbtn" data-fdsk="${s.k}">⬇ SKILL.md</button></div></div>`).join('')}</div>`}
h+=`<p class="note">${ar?'المحتوى أصلي من Claude Mastery للتدريب. الوكلاء بيكتبوا مسودات وتوصيات بس — القرار والترحيل والدفع والإرسال لإنسان. قواعد الضرايب والتنظيم بتتغير: راجع مستشارك. كما في سبتمبر 2026.':'Original Claude Mastery training content. Agents draft and recommend only — decisions, postings, payments and messages stay with people. Tax and regulatory rules change: confirm with your adviser. As of Sept 2026.'}</p>`;return h}
function fdCard(f,a){const ar=LANG==='ar';const lang=ar?'ar':'en';const sk=fdSkill(a.sk);const open=FDS.open===a.k;const done=(ST.fdRun||{})[a.k];
const ul=s=>`<ul>${fdList(L(s)).map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`;
let h=`<div class="fdag ${open?'open':''}" id="fd-${a.k}"><button class="fdhead" data-fdo="${a.k}" aria-expanded="${open}"><span class="fdi">${f.icon}</span><span class="fdt"><b>${L(a.n)}</b><span class="k">${esc(L(a.role))}</span></span>${done?'<span class="fdok">✓</span>':''}<span class="fdchev">${open?'▾':'▸'}</span></button>`;
if(open){const pi=PSTORE.push(fdPrompt(a,f,lang))-1,ti=PSTORE.push(L(a.task))-1;
h+=`<div class="fdbody"><p><b>${ar?'المهمة الواحدة:':'One job:'}</b> ${esc(L(a.job))}</p>
<div class="fdcols"><div><h4>📥 ${ar?'المدخلات':'Inputs'}</h4>${ul(a.in)}</div><div><h4>📤 ${ar?'المخرجات':'Outputs'}</h4>${ul(a.out)}</div><div><h4>🎯 ${ar?'المسؤوليات':'Responsibilities'}</h4>${ul(a.resp)}</div><div><h4>🛡 ${ar?'الضوابط':'Guardrails'}</h4>${ul(a.guard)}</div></div>
<div class="fdtask"><h4>▶ ${ar?'مهمة عملية تشغّلها دلوقتي':'Practical task to run now'}</h4><p dir="auto">${esc(L(a.task))}</p><div class="row-btns"><button class="copy" data-i="${ti}">${ar?'انسخ المهمة':'Copy task'}</button>${a.data&&DATA[a.data]?`<button class="dlbtn" data-csv="${a.data}">⬇ ${esc(L(T(DATA[a.data].en,DATA[a.data].ar)))} (.csv)</button>`:''}<label class="fdrun"><input type="checkbox" data-fdrun="${a.k}" ${done?'checked':''}> ${ar?'شغّلتها':'I ran it'}</label></div></div>
<details class="fdsp"><summary>🧠 ${ar?'الـ System prompt (انسخ والصق)':'System prompt (copy and paste)'}</summary><pre dir="auto">${esc(fdPrompt(a,f,lang))}</pre></details>
${sk?`<div class="fdskill"><h4>🧩 ${ar?'الـ Skill:':'Skill:'} ${L(sk.n)} <code>${sk.k}</code></h4><ol class="fdsteps">${fdList(L(sk.steps)).map(t=>`<li>${esc(t)}</li>`).join('')}</ol><p class="k" style="font-size:13px"><b>${ar?'المخرج:':'Output:'}</b> ${esc(L(sk.out))}</p></div>`:''}
<div class="row-btns"><button class="btn-gold copy" data-i="${pi}">${ar?'انسخ الـ system prompt':'Copy system prompt'}</button>${sk?`<button class="tbtn" data-fdsk="${sk.k}">⬇ SKILL.md</button>`:''}<button class="tbtn" data-fdab="${a.k}">🤖 ${ar?'افتحه في باني الوكلاء':'Open in Agent builder'}</button></div></div>`}
return h+`</div>`}
function fdFind(k){for(const f of FD){const a=f.agents.find(x=>x.k===k);if(a)return [f,a]}return []}
async function fdZip(which,btn){const ar=LANG==='ar';const keep=btn.textContent;btn.disabled=true;btn.textContent=ar?'بيتجهّز…':'Preparing…';
try{await ensureZip();const z=new JSZip();const root=z.folder('claude-finance-department');const fns=which==='all'?FD:FD.filter(f=>f.k===which);
let idx=`# Claude Finance Department\n\n${fns.length} functions · ${fns.reduce((t,f)=>t+f.agents.length,0)} agents · ${fns.reduce((t,f)=>t+f.skills.length,0)} skills\n\nHow to use: paste an agent's system prompt into a Claude Project (or a Cowork task), upload the matching skill folder as a Skill where your plan allows, then run the practical task. A person approves before anything is posted, paid, sent or filed.\n\n`;
fns.forEach((f,fi)=>{const fd=root.folder(`${String(fi+1).padStart(2,'0')}-${f.k}`);idx+=`## ${f.t.en} — ${f.t.ar}\n\n${f.d.en}\n\n`;
f.agents.forEach((a,ai)=>{const sk=fdSkill(a.sk);const name=`agents/${String(ai+1).padStart(2,'0')}-${a.k}.md`;
fd.file(name,`# ${a.n.en} — ${a.n.ar}\n\n**Role:** ${a.role.en}\n\n**One job:** ${a.job.en}\n\n## Practical task\n\n${a.task.en}\n\n${a.data&&DATA[a.data]?`Sample data: \`data/${a.data}.csv\`\n\n`:''}## System prompt (English)\n\n\`\`\`\n${fdPrompt(a,f,'en')}\n\`\`\`\n\n## System prompt (العربية)\n\n\`\`\`\n${fdPrompt(a,f,'ar')}\n\`\`\`\n\n## المهمة العملية\n\n${a.task.ar}\n`);
if(a.data&&DATA[a.data])fd.file(`data/${a.data}.csv`,BOM+DATA[a.data].csv);
idx+=`- **${a.n.en}** (${a.n.ar}) — ${a.job.en} → \`${f.k}/${name}\`${sk?` · skill \`${sk.k}\``:''}\n`});
f.skills.forEach(s=>{fd.folder('skills/'+s.k).file('SKILL.md',fdSkillMd(s,'en'));fd.folder('skills/'+s.k).file('SKILL.ar.md',fdSkillMd(s,'ar').replace(/^---[\s\S]*?---\n\n/,''))});idx+='\n'});
root.file('README.md',idx+`---\nOriginal training content from Claude Mastery. Review every prompt before using it with real data.\n`);
const ok=await saveFile(which==='all'?'Claude-Finance-Department.zip':`Claude-Finance-${which}.zip`,await z.generateAsync({type:'blob'}));btn.textContent=ok?'✓':keep}
catch(e){btn.textContent=ar?'تعذّر — جرّب تاني':'Failed — try again'}btn.disabled=false;setTimeout(()=>{if(btn.isConnected)btn.textContent=keep},2500)}
// Agent builder: link to the department
{const _ab=vAgentB;vAgentB=function(){const h=_ab();const ar=LANG==='ar';const n=fdAll().length;return h.replace(/(<\/p>)/,`$1<button class="card fdbanner" data-go="findept"><b>💼 ${L(UX16.fd)}</b><span class="k">${ar?`${n} وكيل مالي جاهز و${n} Skill — افتح أي واحد هنا بضغطة.`:`${n} ready finance agents and ${n} skills — open any of them here in one click.`}</span></button>`)}}
// Search index
{const _bi=buildIdx;buildIdx=function(){_bi();const add=(t,txt,r,k)=>IDX.push({t,txt:(t.en+' '+t.ar+' '+txt).toLowerCase(),r,k,snip:txt});
fdAll().forEach(([f,a])=>add(T(a.n.en+' · '+f.t.en,a.n.ar+' · '+f.t.ar),a.role.en+' '+a.job.en+' '+a.job.ar+' '+(fdSkill(a.sk)||{n:{en:''}}).n.en,'findept/'+f.k,T('Finance department','الإدارة المالية')));
DIAG.forEach(d=>add(d.t,d.d.en+' '+d.d.ar,'diagrams/'+d.k,T('Interactive diagram','رسم تفاعلي')))}}

document.addEventListener('click',e=>{const g=s=>e.target.closest(s);let x;
if(x=g('[data-dgk]')){DG={k:x.dataset.dgk,s:0,play:false};clearInterval(DGT);DGT=null;render();return}
if(x=g('[data-dgs]')){DG.s=+x.dataset.dgs;dgPaint();return}
if(x=g('[data-dg]')){const D=DIAG.find(d=>d.k===DG.k);const a=x.dataset.dg;if(a==='prev'&&DG.s>0){DG.s--;dgPaint()}else if(a==='next'&&DG.s<D.steps.length-1){DG.s++;dgPaint()}else if(a==='play'){DG.play=!DG.play;if(DG.play){if(DG.s>=D.steps.length-1)DG.s=0;dgPaint();clearInterval(DGT);DGT=setInterval(dgTick,2600)}else{clearInterval(DGT);DGT=null;dgPaint()}}return}
if(x=g('[data-ac]')){const a=x.dataset.ac;if(a==='run'&&!AC.busy)acRun();else if(a==='clear'){AC.txt='';AC.res=null;saveAC();render()}else if(a==='use'&&AC.res){AC.txt=AC.res.rewrite;AC.res=null;saveAC();render()}return}
if(x=g('[data-fdf]')){FDS.f=x.dataset.fdf;FDS.q='';FDS.open='';render();return}
if(x=g('[data-fdo]')){FDS.open=FDS.open===x.dataset.fdo?'':x.dataset.fdo;render();const el=document.getElementById('fd-'+x.dataset.fdo);if(el&&FDS.open)el.scrollIntoView({block:'nearest'});return}
if(x=g('[data-fdsk]')){const s=fdSkill(x.dataset.fdsk);if(s)saveFile(s.k+'-SKILL.md',fdSkillMd(s,LANG==='ar'?'ar':'en')).then(ok=>{if(ok)x.textContent='✓'});return}
if(x=g('[data-fdzip]')){fdZip(x.dataset.fdzip,x);return}
if(x=g('[data-fdab]')){const [f,a]=fdFind(x.dataset.fdab);if(!a)return;const lang=LANG==='ar'?'ar':'en';const sk=fdSkill(a.sk);
Object.assign(AGB,{name:a.k,job:a.job[lang],role:a.role[lang],goal:fdList(a.out[lang]).join('; '),rules:fdList(a.resp[lang]).map(t=>'- '+t).join('\n'),constraints:fdList(a.guard[lang]).concat(FDCOMMON[lang]).map(t=>'- '+t).join('\n'),skills:sk?sk.k:'',stopWhen:lang==='ar'?'كل المخرجات اتسلّمت والإجماليات متطابقة':'All outputs delivered and totals reconcile',approvals:['post','send'],knowledge:fdList(a.in[lang]).join('; '),step:1,res:''});saveAB();go('agentb');return}});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset&&t.dataset.fdrun){const k=t.dataset.fdrun;ST.fdRun=Object.assign({},ST.fdRun);if(t.checked){if(!ST.fdRun[k]){ST.fdRun[k]=1;ST.fdXP=ST.fdXP||{};if(!ST.fdXP[k]){ST.fdXP[k]=1;addXP(3)}}}else delete ST.fdRun[k];saveST();render();return}
if(t.dataset&&t.dataset.acf&&t.tagName==='SELECT'){AC[t.dataset.acf]=t.value;saveAC()}});
document.addEventListener('input',e=>{const t=e.target;if(t.id==='acTxt'){AC.txt=t.value;saveAC();clearTimeout(window._acT);window._acT=setTimeout(()=>{if(document.activeElement&&document.activeElement.id==='acTxt'){const pos=t.selectionStart;render();const n=document.getElementById('acTxt');if(n){n.focus();n.setSelectionRange(pos,pos)}}},700);return}
if(t.dataset&&t.dataset.acf&&t.tagName!=='SELECT'){AC[t.dataset.acf]=t.value;saveAC();return}
if(t.id==='fdq'){FDS.q=t.value;FDS.open='';clearTimeout(window._fdT);window._fdT=setTimeout(()=>{const pos=t.selectionStart;render();const n=document.getElementById('fdq');if(n){n.focus();n.setSelectionRange(pos,pos)}},350)}});
