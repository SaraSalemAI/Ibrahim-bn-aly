const QR_SVG=document.getElementById('qrsrc').innerHTML;const QR_PLATFORM=document.getElementById('qrplat').innerHTML;
let LANG='ar',THEME='',PRINT=false;let DONE=[];try{DONE=JSON.parse(localStorage.getItem('cm_done')||'[]')}catch(e){}
const saveDone=()=>{try{localStorage.setItem('cm_done',JSON.stringify(DONE))}catch(e){}};
const TOTAL_LESSONS=()=>DAYS.reduce((s,d)=>s+d.units.length,0);
const pct=()=>Math.round(100*DONE.length/TOTAL_LESSONS());
try{LANG=localStorage.getItem('cm_lang')||'ar';THEME=localStorage.getItem('cm_theme')||''}catch(e){}
const L=o=>o?(o[LANG]??o.en??''):'';
const UI={
home:T("Home","الرئيسية"),course:T("Modules","الموديولات"),deep:T("Deep dives","التعمق"),lib:T("Libraries","المكتبات"),
skills:T("Skills library","مكتبة الـ Skills"),cases:T("Use-case library","مكتبة الحالات العملية"),prompts:T("Prompt library","مكتبة البرومبتات"),
work:T("My work","أعمالي"),gallery:T("References","المراجع"),gloss:T("Glossary","القاموس"),about:T("Creator & instructor","المُنشئة والمدرّبة"),curr:T("Curriculum map","خريطة المنهج"),exp:T("Export everything","تصدير كل حاجة"),done:T("Mark as done","علّم إنه خلص"),isdone:T("Done ✓","خلص ✓"),progress:T("Your progress","تقدّمك"),words:T("My power words","كلماتي القوية"),lab:T("Master prompt lab","معمل البرومبت الماستر"),map:T("Claude mastery map","خريطة إتقان Claude"),testdata:T("Test with dummy data","اختبر ببيانات تجريبية"),dlcsv:T("Download CSV","تنزيل CSV"),az:T("A–Z real case","حالة حقيقية من الألف للياء"),
content:T("Content","المحتوى"),steps:T("Steps","الخطوات"),pr:T("Prompts","البرومبتات"),rc:T("Real cases","الحالات العملية"),
copy:T("Copy","نسخ"),copied:T("Copied","اتنسخ"),search:T("Search prompts, cases, tools…","ابحث في البرومبتات والحالات والأدوات…"),
all:T("All","الكل"),min:T("min","دقيقة"),open:T("Open","فتح"),doc:T("Official docs","المرجع الرسمي"),tips:T("Pro tips","نصايح احترافية"),
prev:T("Previous","السابق"),next:T("Next","التالي"),day:T("Module","موديول"),units:T("lessons","دروس"),
li:T("LinkedIn","لينكدإن"),scan:T("Scan to connect on LinkedIn","امسح الكود للتواصل على لينكدإن"),
noTabs:T("No items in this section yet.","لسه مفيش عناصر هنا."),usecases:T("Use cases","حالات الاستخدام"),trigger:T("Try saying","جرّب تقول")
};
const TAGS={core:T("Core","أساسي"),practical:T("Practical","تطبيقي"),advanced:T("Advanced","متقدم"),critical:T("Important","مهم"),mastery:T("Mastery","إتقان")};
const ANAT=[
{k:T("Role","الدور"),e:T("Who should Claude be? <code>You are the FP&A lead of an Egyptian FMCG company.</code>","Claude يبقى مين؟ <code>إنت مسؤول FP&A في شركة سلع استهلاكية مصرية.</code>")},
{k:T("Task","المهمة"),e:T("One deliverable. <code>Build the September variance pack.</code>","مخرج واحد. <code>اعمل حزمة انحرافات سبتمبر.</code>")},
{k:T("Context","السياق"),e:T("Facts it can't guess: <code>EGP thousands, budget FX 48, 3 regions, board on the 15th.</code>","حقايق مش هيخمّنها: <code>بالألف جنيه، سعر الموازنة 48، 3 مناطق، المجلس يوم 15.</code>")},
{k:T("Reasoning","المنطق"),e:T("Why it matters: <code>The board decides whether to cut Q4 marketing.</code>","ليه مهم: <code>المجلس هيقرر يقلّل تسويق الربع الرابع ولا لأ.</code>")},
{k:T("Stop","التوقف"),e:T("Define done: <code>Stop when every variance >5% has a driver and an owner.</code>","عرّف الانتهاء: <code>وقّف لما كل انحراف فوق 5% يبقى ليه سبب ومسؤول.</code>")},
{k:T("Output","المخرج"),e:T("Format: <code>xlsx with formulas + 150-word Arabic commentary.</code>","الشكل: <code>xlsx بمعادلات + تعليق عربي 150 كلمة.</code>")}];
const DEEPORDER=["capabilities","prompting","tokens","memory","projects","cowork","excel","agentic","playbook","integration","mcpsec","agentbuild"];
const allPrompts=()=>{const a=[];DAYS.forEach(d=>d.units.forEach(u=>(u.prompts||[]).forEach(p=>a.push({t:p.t,p:p.p,src:T(`Module ${d.n} · ${u.t.en}`,`موديول ${d.n} · ${u.t.ar}`),dom:"course"}))));
DEEP.agentic.cases.forEach(c=>a.push({t:c.t,p:c.p,src:T("Agentic A–Z","الوكيلي من الألف للياء"),dom:"agentic"}));
DEEP.playbook.cases.forEach(c=>a.push({t:c.t,p:c.p,src:T('Playbook · '+c.tool,'دليل الوكلاء · '+c.tool),dom:'agentic'}));
DEEP.integration.cases.forEach(c=>a.push({t:c.t,p:c.p,src:T('API & mini-ERP','الـ API و Mini-ERP'),dom:'integration'}));
AZ.phases.forEach(c=>a.push({t:c.t,p:c.p,src:T('A–Z real case','الحالة من الألف للياء'),dom:'az'}));
WORKCATS.forEach(g=>g.items.forEach(w=>a.push({t:w.t,p:w.p,src:T('My work · '+g.c.en,'أعمالي · '+g.c.ar),dom:'work'})));
DEEP.agentbuild.cases.forEach(c=>a.push({t:c.t,p:c.p,src:T('Agent blueprints','مخططات الوكلاء'),dom:'agentic'}));
DEEP.mcpsec.cases.forEach(c=>a.push({t:c.t,p:c.p,src:T('MCP security','أمان MCP'),dom:'integration'}));
LAB.forEach(c=>a.push({t:c.t,p:c.p,src:T('Lab · '+c.field.en,'المعمل · '+c.field.ar),dom:'lab'}));
DEEP.featured.cases.forEach(c=>a.push({t:c.t,p:c.p,src:T('Featured skills','Skills مميزة'),dom:'course'}));
DEEP.excel.cases.forEach(c=>a.push({t:c.t,p:c.p,src:T("Excel with AI","Excel بالذكاء الاصطناعي"),dom:"excel"}));DEEP.cowork.cases.forEach(c=>a.push({t:c.t,p:c.p,src:T("Cowork","Cowork"),dom:"automation"}));
CASES.forEach(g=>g.items.forEach(c=>a.push({t:c.t,p:c.p,src:g.t,dom:g.k})));return a};
const PROMPTS=allPrompts();
const DOMDATA={finance:['bva','ar_aging'],business:['kpis'],ceo:['kpis'],hr:['employees'],marketing:['campaigns'],sales:['crm_deals','sales_monthly'],creator:['social'],trainer:['social'],slides:['kpis'],automation:['ar_aging','ap_aging'],legal:['contracts'],ops:['inventory'],procurement:['suppliers'],cs:['tickets'],risk:['expenses'],banking:['credit_fin','transactions'],pm:['project'],data:['sales_monthly','customers'],apps:['expenses'],erp:['ar_aging','inventory'],content2:['social'],excel:['bva','dcf_inputs','ar_aging'],agentic:['bank_gl','ar_aging'],playbook:['crm_deals','bva'],integration:['transactions','ar_aging'],az:['lc','ar_aging','bank_gl']};
CASES.forEach(g=>g.items.forEach(c=>c._dom=g.k));['excel','agentic','playbook','integration'].forEach(k=>DEEP[k].cases.forEach(c=>c._dom=k));AZ.phases.forEach(c=>c._dom='az');Object.assign(DOMDATA,{supply:['inventory','suppliers'],benchmark:['kpis'],cost:['bva'],accounting:['bank_gl'],pmp:['project'],cfo:['kpis','ar_aging'],instructor:['social'],ecommerce:['campaigns','transactions']});
const esc=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
let PSTORE=[];
function promptBox(p,extra){const i=PSTORE.push(L(p.p))-1;return `<div class="prompt"><div class="ph"><div><h3>${L(p.t)}</h3>${extra?`<div class="k" style="font-size:12px;color:var(--ink3)">${extra}</div>`:''}</div><button class="copy" data-i="${i}">${L(UI.copy)}</button></div><pre dir="auto">${esc(L(p.p))}</pre></div>`}
function applyChrome(){document.documentElement.lang=LANG;document.documentElement.dir=LANG==='ar'?'rtl':'ltr';
if(THEME)document.documentElement.setAttribute('data-theme',THEME);else document.documentElement.removeAttribute('data-theme');
const dark=THEME?THEME==='dark':matchMedia('(prefers-color-scheme: dark)').matches;
document.getElementById('langBtn').textContent=LANG==='ar'?'English':'العربية';
document.getElementById('themeBtn').textContent=dark?'☀':'☾';const el=document.getElementById('expLbl');if(el)el.textContent=L(UI.exp);const ab=document.getElementById('acctBtn');if(ab){const p=ST.profile;ab.innerHTML=p?`<span class="av">${esc((p.name||'?').trim().charAt(0).toUpperCase())}</span>${esc((p.name||'').split(' ')[0])}`:L(UX7.signin)}const gs=document.getElementById('gsearch');if(gs)gs.placeholder=L(UX.search);
}
function sideOld(){const r=location.hash.slice(1)||'home';
const n=(h,i,label,sub)=>`<button class="nav ${r===h?'on':''}" data-go="${h}"><span class="i">${i}</span><span>${label}${sub?`<span class="d">${sub}</span>`:''}</span></button>`;
let h=`<div class="brand"><div class="mark">✦</div><div><b>Claude Mastery</b><small>${LANG==='ar'?'د. سارة سالم — خبيرة AI في المالية':'Dr. Sara Salem — AI Finance Expert'}</small></div></div>`;
h+=n('home','⌂',L(UI.home));h+=n('path','🧭',L(UX2.path));h+=n('map','✺',L(UI.map));h+=n('deep/agentbuild','🤖',L(DEEP.agentbuild.t));h+=n('curriculum','☰',L(UI.curr));h+=n('lab','⚗',L(UI.lab));h+=`<div class="navgroup">${L(UX.learn)}</div>`;h+=n('quiz/1','🧠',L(UX.quiz));h+=n('tutor','💬',L(UX.tutor));h+=n('sim','🔄',L(UX.sim));h+=n('studio','🎛',L(UX3.studio));h+=n('builder','🧱',L(UX.builder));h+=n('skillbuilder','🧩',L(UX2.skb));h+=n('pick','🎯',L(UX2.pick));h+=n('prog','🏅',L(UX.prog)+` · ${ST.xp} XP`);h+=n('cert','🎓',L(UX.cert));h+=`<div class="navgroup">—</div>`;h+=n('words','❝',L(UI.words));h+=n('export','⤓',L(UI.exp));
h+=`<div class="navgroup">${L(UI.course)}</div>`;DAYS.forEach(d=>h+=n('day/'+d.n,d.n,L(d.t)));
h+=`<div class="navgroup">${L(UI.deep)}</div>`;DEEPORDER.forEach(k=>h+=n('deep/'+k,DEEP[k].icon,L(DEEP[k].t)));
h+=`<div class="navgroup">${L(UI.lib)}</div>`;h+=n('skills','✦',L(UI.skills));h+=n('cases','▤',L(UI.cases));h+=n('work','★',L(UI.work));h+=n('gallery','▣',L(UI.gallery));h+=n('glossary','Aa',L(UI.gloss));h+=n('about','◎',L(UI.about));
h+=`<div class="side-qr"><div class="qr">${QR_SVG}</div>${L(UI.scan)}<a href="${LINKEDIN}" target="_blank" rel="noopener">in · ${L(UI.li)}</a></div>`;
document.getElementById('side').innerHTML=h;}
function crumb(t){document.getElementById('crumb').textContent=t}
function vHomeOld(){let anat=ANAT.map((a,i)=>`<button data-anat="${i}" class="${i===0?'on':''}"><b>${i+1}</b><span>${L(a.k)}</span></button>`).join('');
let units=DAYS.reduce((s,d)=>s+d.units.length,0);
let h=`<section class="hero"><div class="sig">${LANG==='ar'?'د. سارة سالم':'Dr. Sara Salem'}</div><h1>${LANG==='ar'?'إتقان Claude للبيزنس — من أول برومبت لأول وكيل':'Claude Mastery for business — from the first prompt to the first agent'}</h1>
<p class="lede">${LANG==='ar'?'كورس عملي ثنائي اللغة لمحترفي المالية والبيزنس في مصر والخليج. كل وحدة بخطوات، وبرومبتات جاهزة، وحالات حقيقية. ابدأ من تشريح البرومبت:':'A practical bilingual course for finance and business professionals in Egypt and the Gulf. Every unit has steps, ready prompts and real cases. Start with the anatomy of a prompt:'}</p>
<p style="margin:0 0 14px"><button class="dlbtn" style="background:#D9B44A;color:#13284B" data-go="path">🧭 ${L(UX2.path)}</button> <button class="tbtn" data-starttour="1">✨ ${L(UX2.tour)}</button></p><div class="anat" role="tablist">${anat}</div><div class="anatbox" id="anatbox">${L(ANAT[0].e)}</div>
<div class="stats"><div><b>${DAYS.length}</b>${LANG==='ar'?'موديولات':'modules'}</div><div><b>${units}</b>${L(UI.units)}</div><div><b>${PROMPTS.length}</b>${L(UI.pr)}</div><div><b>${CASES.reduce((s,g)=>s+g.items.length,0)+DEEP.excel.cases.length}</b>${L(UI.rc)}</div><div><b>${SKILLS.reduce((s,g)=>s+g.items.length,0)}</b>Skills</div><div><b>${pct()}%</b>${L(UI.progress)}</div><div><b>${ST.xp}</b>XP · ${streak()}🔥</div></div></section>`;
h+=`<h2>${LANG==='ar'?'ابدأ من هنا':'Start here'}</h2><div class="grid"><button class="card feature" data-go="map"><h3>✺ ${L(UI.map)}</h3><div class="k">${LANG==='ar'?'7 مراحل من البرومبت لموظفين AI':'7 stages from prompt to AI employees'}</div></button><button class="card feature" data-go="deep/agentbuild"><h3>🤖 ${L(DEEP.agentbuild.t)}</h3><div class="k">${L(DEEP.agentbuild.sub)}</div></button><button class="card feature" data-go="lab"><h3>⚗ ${L(UI.lab)}</h3><div class="k">${LANG==='ar'?'جرّب بالبيانات التجريبية دلوقتي':'Try with dummy data now'}</div></button><button class="card feature" data-go="work"><h3>★ ${L(UI.work)}</h3><div class="k">${LANG==='ar'?'كل شغلي بالبرومبت الماستر':'All my work with master prompts'}</div></button></div>`;
h+=`<h2>${L(UX.learn)}</h2><div class="grid">${[['path','🧭',UX2.path],['pick','🎯',UX2.pick],['skillbuilder','🧩',UX2.skb],['quiz/1','🧠',UX.quiz],['tutor','💬',UX.tutor],['sim','🔄',UX.sim],['builder','🧱',UX.builder],['prog','🏅',UX.prog],['cert','🎓',UX.cert]].map(x=>`<button class="card" data-go="${x[0]}"><h3>${x[1]} ${L(x[2])}</h3></button>`).join('')}</div>`;
h+=`<h2>${L(UI.course)}</h2><div class="grid">`+DAYS.map(d=>`<button class="card daycard" data-go="day/${d.n}"><div class="daynum">${d.n}</div><div><h3>${L(d.t)}</h3><div class="k">${L(d.sub)}</div><div class="k" style="margin-top:6px">${d.units.length} ${L(UI.units)} · ${d.units.filter(u=>DONE.includes(u.id)).length}/${d.units.length} ✓</div></div></button>`).join('')+`</div>`;
h+=`<h2>${L(UI.deep)}</h2><div class="grid">`+DEEPORDER.map(k=>`<button class="card" data-go="deep/${k}"><h3>${DEEP[k].icon} ${L(DEEP[k].t)}</h3><div class="k">${L(DEEP[k].sub)}</div></button>`).join('')+`</div>`;
h+=`<h2>${L(UI.lib)}</h2><div class="grid">${[['skills','✦',UI.skills],['cases','▤',UI.cases],['prompts','✎',UX3.lib],['work','★',UI.work],['curriculum','☰',UI.curr],['lab','⚗',UI.lab],['export','⤓',UI.exp],['words','❝',UI.words],['gallery','▣',UI.gallery],['glossary','Aa',UI.gloss]].map(x=>`<button class="card" data-go="${x[0]}"><h3>${x[1]} ${L(x[2])}</h3></button>`).join('')}</div>`;
crumb(L(UI.home));return h}
let unitTab='content';let CEOON=false;
function vDay(n,uid){const d=DAYS.find(x=>x.n==n);if(!d)return vHome();
if(!uid){crumb(`${L(UI.day)} ${d.n}`);return `<div class="k" style="color:var(--gold)">${L(UI.day)} ${d.n}</div><h1>${L(d.t)}</h1><p class="lede">${L(d.sub)}</p>${modExportBar(d.n)}<div class="grid">`+d.units.map(u=>`<button class="card" data-go="day/${d.n}/${u.id}"><span class="tag ${u.tag}">${L(TAGS[u.tag])}</span> <span class="k">${u.dur} ${L(UI.min)}</span><h3 style="margin-top:8px">${u.id} · ${L(u.t)}</h3><div class="k">${(u.prompts||[]).length} ${L(UI.pr)} · ${(u.cases||[]).length} ${L(UI.rc)}</div></button>`).join('')+`</div>`+pager(d.n)}
const u=d.units.find(x=>x.id==uid);if(!u)return vDay(n);crumb(`${L(UI.day)} ${d.n} › ${L(u.t)}`);
const tabs=[['content',UI.content],['steps',UI.steps],['prompts',UI.pr],['cases',UI.rc]];
let h=`<button class="tbtn" data-go="day/${d.n}">${LANG==='ar'?'→':'←'} ${L(UI.day)} ${d.n}</button><div style="margin-top:14px"><span class="tag ${u.tag}">${L(TAGS[u.tag])}</span> <span class="k" style="color:var(--ink3);font-size:13px">${u.dur} ${L(UI.min)}</span></div><h1>${u.id} · ${L(u.t)}</h1><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="tbtn ${DONE.includes(u.id)?'donebtn':''}" data-done="${u.id}">${DONE.includes(u.id)?L(UI.isdone):L(UI.done)}</button><button class="tbtn ${CEOON?'donebtn':''}" data-ceo="1">👔 ${L(UX.ceo)}</button><button class="tbtn ${ST.bm.includes(u.id)?'donebtn':''}" data-bm="${u.id}">🔖 ${L(UX4.bm)}</button><button class="tbtn" data-present="${d.n}|${u.id}">▶ ${L(UX.present)}</button><button class="tbtn" data-go="quiz/${d.n}">🧠 ${L(UX.quiz)}</button></div>${CEOON&&CEO[u.id]?`<div class="ceobox">👔 <b>${L(UX.ceo)}:</b> ${L(CEO[u.id])}</div>`:''}`;
h+=modExportBar(d.n);h+=`<div class="tabs">${tabs.map(t=>`<button class="tab ${unitTab===t[0]?'on':''}" data-tab="${t[0]}">${L(t[1])}</button>`).join('')}</div>`;
if(unitTab==='content'){h+=`<div class="prose"><div class="tablewrap">${L(u.body)}</div>${u.doc?`<p><a href="${u.doc}" target="_blank" rel="noopener">${L(UI.doc)} ↗</a></p>`:''}</div>`}
if(unitTab==='steps'){const s=L(u.steps)||[];const tp=L(u.tips)||[];h+=s.length?`<ol class="steps">${s.map(x=>`<li>${x}</li>`).join('')}</ol>`:'';h+=tp.length?`<h2>${L(UI.tips)}</h2><ul class="tips">${tp.map(x=>`<li>${x}</li>`).join('')}</ul>`:'';if(!s.length&&!tp.length)h+=`<div class="empty">${L(UI.noTabs)}</div>`}
if(unitTab==='prompts'){h+=(u.prompts||[]).length?u.prompts.map(p=>promptBox(p)).join(''):`<div class="empty">${L(UI.noTabs)}</div>`}
if(unitTab==='cases'){h+=(u.cases||[]).length?u.cases.map(c=>`<div class="case"><h3>${L(c.t)}</h3><div>${L(c.d)}</div></div>`).join(''):`<div class="empty">${L(UI.noTabs)}</div>`}
const i=d.units.indexOf(u),pv=d.units[i-1],nx=d.units[i+1];
h+=`<div class="pager">${pv?`<button class="tbtn" data-go="day/${d.n}/${pv.id}">${L(UI.prev)}: ${pv.id}</button>`:'<span></span>'}${nx?`<button class="tbtn" data-go="day/${d.n}/${nx.id}">${L(UI.next)}: ${nx.id}</button>`:(d.n<DAYS.length?`<button class="tbtn" data-go="day/${d.n+1}">${L(UI.day)} ${d.n+1}</button>`:'')}</div>`;h+=`<div class="notes"><b>✎ ${L(UX4.notes)}</b><textarea rows="3" data-note="${u.id}" dir="auto" placeholder="${LANG==='ar'?'اكتب ملاحظاتك على الدرس ده… بتتحفظ تلقائي':'Write your notes on this lesson… saved automatically'}">${esc(ST.notes[u.id]||'')}</textarea></div>`;return h}
function pager(n){return `<div class="pager">${n>1?`<button class="tbtn" data-go="day/${n-1}">${L(UI.prev)}: ${L(UI.day)} ${n-1}</button>`:'<span></span>'}${n<DAYS.length?`<button class="tbtn" data-go="day/${n+1}">${L(UI.next)}: ${L(UI.day)} ${n+1}</button>`:''}</div>`}
function caseCard(c,meta){const s=L(c.steps)||[];return `<details class="case" ${PRINT?'open':''}><summary><div class="meta">${meta||''}</div><h3>${L(c.t)}</h3>${c.d?`<div style="color:var(--ink2);font-size:14px">${L(c.d)}</div>`:''}</summary>${s.length?`<ol>${s.map(x=>`<li>${x}</li>`).join('')}</ol>`:''}${promptBox({t:c.master?T('Master prompt','البرومبت الماستر'):T('Prompt','البرومبت'),p:c.p})}${dataBox(c.data||c._dom&&DOMDATA[c._dom]||null)}${c.cat?`<div class="row-btns">${mailBtns('Master prompt — '+c.t.en,L(c.p))}</div>`:''}</details>`}
function vDeep(k){const D=DEEP[k];if(!D)return vHome();crumb(`${L(UI.deep)} › ${L(D.t)}`);
let h=`<div class="k" style="color:var(--gold);font-size:13px">${L(UI.deep)}</div><h1>${D.icon} ${L(D.t)}</h1><p class="lede">${L(D.sub)}</p>`;
D.sections.forEach(s=>h+=`<h2>${L(s.h)}</h2><div class="prose"><div class="tablewrap">${L(s.b)}</div></div>`);
if(D.cases.length){h+=`<h2>${L(UI.usecases)} (${D.cases.length})</h2>`;D.cases.forEach((c,i)=>h+=caseCard(c,c.tool||`${i+1}`))}
const i=DEEPORDER.indexOf(k);h+=`<div class="pager">${i>0?`<button class="tbtn" data-go="deep/${DEEPORDER[i-1]}">${L(UI.prev)}: ${L(DEEP[DEEPORDER[i-1]].t)}</button>`:'<span></span>'}${i<DEEPORDER.length-1?`<button class="tbtn" data-go="deep/${DEEPORDER[i+1]}">${L(UI.next)}: ${L(DEEP[DEEPORDER[i+1]].t)}</button>`:''}</div>`;return h}
let skF='all',skQ='';
function vSkills(){crumb(L(UI.skills));const ar=LANG==='ar';const guides={};DEEP.featured.cases.forEach(c=>{const k=c.tool;guides[k]=c});const secs={learn:0,'web-artifacts-builder':1,'import-memory':2};
const fields=[...new Set(SKILLS.flatMap(g=>g.items.flatMap(s=>s.f.en.split(' · '))))];const fl=f=>{const s=SKILLS.flatMap(g=>g.items).find(x=>x.f.en.split(' · ').includes(f));const i=s.f.en.split(' · ').indexOf(f);return LANG==='ar'?s.f.ar.split(' · ')[i]:f};
let h=`<h1>✦ ${L(UI.skills)}</h1><p class="lede">${ar?'كل Skill: بتعمل إيه، إمتى تستخدمها، ميزتها، ومجالها. الـ Skills بتشتغل تلقائي لما طلبك يطابق وصفها، أو تناديها بـ /اسمها. الـ Skills المميزة فيها دليل بالخطوات وبرومبت ماستر.':'Every skill: what it does, when to use it, its advantage and its field. Skills fire automatically when your request matches their description, or call them with /name. Featured skills include a step-by-step guide and a master prompt.'}</p>`;
h+=`<div class="sk-how"><div><b>${ar?'إمتى تستخدم Skill؟':'When to use a skill?'}</b><p>${ar?'لما بتكرر نفس الطريقة أو الشكل أو قائمة المراجعة كذا مرة.':'When you repeat the same method, format or checklist several times.'}</p></div><div><b>${ar?'الميزة':'The advantage'}</b><p>${ar?'جودة ثابتة لكل الفريق، وسياق قليل لأنها بتتحمّل بس وقت الحاجة.':'Consistent quality for the whole team, and little context because it loads only when needed.'}</p></div><div><b>${ar?'Skill ولا Project ولا Plugin؟':'Skill, Project or Plugin?'}</b><p>${ar?'Project = سياق لشغل معيّن. Skill = طريقة تنفع في أي مكان. Plugin = حزمة Skills وأدوات لوظيفة.':'Project = context for one body of work. Skill = a method usable anywhere. Plugin = a bundle of skills and tools for a role.'}</p></div></div>`;
h+=`<input class="search" id="skq" value="${esc(skQ)}" placeholder="${ar?'ابحث في الـ Skills…':'Search skills…'}"><div class="chips"><button class="chip ${skF==='all'?'on':''}" data-skf="all">${L(UI.all)}</button>${fields.map(f=>{const o=SKILLS.flatMap(g=>g.items).find(s=>s.f.en===f);return `<button class="chip ${skF===f?'on':''}" data-skf="${esc(f)}">${fl(f)}</button>`}).join('')}</div>`;
const q=skQ.toLowerCase();
SKILLS.forEach(g=>{const items=g.items.filter(s=>(skF==='all'||s.f.en.split(' · ').includes(skF))&&(!q||(s.n+L(s.d)+L(s.w)+L(s.v)).toLowerCase().includes(q)));if(!items.length)return;
h+=`<h2>${L(g.g)}</h2><div class="skgrid">`+items.map(s=>{const key=s.n.split(' ')[0];const gd=guides[key];const sec=secs[key]!=null?DEEP.featured.sections[secs[key]]:null;
return `<div class="skc ${gd?'feat':''}"><div class="skh"><span class="n">${s.n}</span><span class="tag">${L(s.f)}</span>${gd?`<span class="tag advanced">★ ${ar?'مميزة':'Featured'}</span>`:''}</div><p>${L(s.d)}</p><div class="skrow"><b>🕐 ${ar?'إمتى':'When'}</b><span>${L(s.w)}</span></div><div class="skrow"><b>✓ ${ar?'الميزة':'Advantage'}</b><span>${L(s.v)}</span></div><div class="tr">${L(UI.trigger)}: <span dir="auto">“${esc(s.tr)}”</span></div>${gd?`<details class="skd" ${PRINT?'open':''}><summary>${ar?'الدليل والبرومبت الماستر':'Guide & master prompt'}</summary>${sec?`<div class="prose" style="margin:8px 0">${L(sec.b)}</div>`:''}<ol class="steps">${L(gd.steps).map(x=>`<li>${x}</li>`).join('')}</ol>${promptBox({t:T('Master prompt','البرومبت الماستر'),p:gd.p})}</details>`:''}</div>`}).join('')+`</div>`});
return h}
let caseDom='all',cQ='',cTool='all',cData=false;
const TOOLS=['Cowork','Claude Code','Excel','API','MCP','Artifact','Claude Design','Project','Skill','Chat','Research','Agent','Slides','Docs','Chrome'];
function vCases(){crumb(L(UI.cases));const ar=LANG==='ar';
let h=`<h1>▤ ${L(UI.cases)}</h1><p class="lede">${ar?`${CASES.length} مجال + الحالة الحقيقية من الألف للياء. كل حالة: السيناريو، الأداة، الخطوات، البرومبت الماستر، وبيانات تجريبية لما تكون متاحة.`:`${CASES.length} fields + the A–Z real case. Every case: scenario, tool, steps, master prompt and dummy data where available.`}</p>`;
h+=`<div class="cfil"><input class="search" id="cq" value="${esc(cQ)}" placeholder="${ar?'ابحث في الحالات…':'Search cases…'}"><select id="cdom"><option value="all">${ar?'كل المجالات':'All fields'}</option><option value="az" ${caseDom==='az'?'selected':''}>A–Z · ${L(UI.az)}</option>${CASES.map(g=>`<option value="${g.k}" ${caseDom===g.k?'selected':''}>${g.icon} ${L(g.t)}</option>`).join('')}</select><select id="ctool"><option value="all">${ar?'كل الأدوات':'All tools'}</option>${TOOLS.map(t=>`<option ${cTool===t?'selected':''}>${t}</option>`).join('')}</select><label class="opt" style="white-space:nowrap"><input type="checkbox" id="cdata" ${cData?'checked':''}> 🧪 ${ar?'ببيانات تجريبية':'With test data'}</label></div>`;
h+=`<div class="chips"><button class="chip ${caseDom==='all'?'on':''}" data-dom="all">${L(UI.all)}</button><button class="chip ${caseDom==='az'?'on':''}" data-dom="az">A–Z ★</button>${CASES.map(x=>`<button class="chip ${x.k===caseDom?'on':''}" data-dom="${x.k}">${x.icon} ${L(x.t)}</button>`).join('')}</div>`;
const q=cQ.toLowerCase();const ok=c=>(cTool==='all'||(c.tool||'').toLowerCase().includes(cTool.toLowerCase()))&&(!cData||(c.data||DOMDATA[c._dom]||[]).length)&&(!q||(L(c.t)+' '+L(c.d||T('',''))+' '+c.p.en+' '+c.p.ar).toLowerCase().includes(q));
let n=0;
if(caseDom==='all'||caseDom==='az'){const ph=AZ.phases.filter(ok);if(ph.length){n+=ph.length;h+=`<h2>A–Z · ${L(UI.az)}</h2><div class="prose"><p><b>${ar?'الشركة':'Company'}:</b> ${L(AZ.company)}</p><p><b>${ar?'المشكلة':'Problem'}:</b> ${L(AZ.problem)}</p></div>`+ph.map(c=>caseCard(c,c.tool)).join('')+`<div class="case">${L(AZ.results)}</div>`}}
if(caseDom!=='az')CASES.filter(g=>caseDom==='all'||g.k===caseDom).forEach(g=>{const its=g.items.filter(ok);if(!its.length)return;n+=its.length;h+=`<h2>${g.icon} ${L(g.t)}</h2>`+its.map(c=>caseCard(c,c.tool)).join('')});
if(!n)h+=`<div class="empty">${ar?'مفيش حالات بالفلاتر دي.':'No cases match these filters.'}</div>`;
return h.replace(`<p class="lede">`,`<p class="note">${n} ${ar?'حالة':'cases'}</p><p class="lede">`)}
let pq='',pdom='all';
function vPrompts(){crumb(L(UI.prompts));const doms=[['all',UI.all],['course',UI.course],['excel',T('Excel','Excel')],['agentic',T('Agentic & playbook','الوكلاء والدليل')],['integration',T('API & mini-ERP','الـ API و Mini-ERP')],['az',T('A–Z case','حالة A–Z')],['lab',T('Master lab','المعمل')],['work',T('My work','أعمالي')],...CASES.map(c=>[c.k,c.t])];
const q=pq.toLowerCase();const list=PROMPTS.filter(p=>(pdom==='all'||p.dom===pdom)&&(!q||(L(p.t)+' '+L(p.p)+' '+L(p.src)).toLowerCase().includes(q)));
let h=`<h1>✎ ${L(UI.prompts)}</h1><p class="lede">${PROMPTS.length} ${LANG==='ar'?'برومبت ثنائي اللغة. بدّل اللغة من فوق علشان تاخد النسخة التانية.':'bilingual prompts. Switch language at the top to get the other version.'}</p>
<input class="search" id="pq" value="${esc(pq)}" placeholder="${L(UI.search)}"><div class="chips">${doms.map(d=>`<button class="chip ${pdom===d[0]?'on':''}" data-pdom="${d[0]}">${L(d[1])}</button>`).join('')}</div><div id="plist">`;
h+=list.length?list.map(p=>promptBox(p,L(p.src))).join(''):`<div class="empty">${LANG==='ar'?'مفيش نتايج — جرّب كلمة تانية.':'No matches — try another word.'}</div>`;return h+'</div>'}
function vWork(){crumb(L(UI.work));let h=`<h1>★ ${L(UI.work)}</h1><p class="lede">${LANG==='ar'?'كل شغلي مرتب حسب النوع، ومع كل عمل البرومبت الماستر الكامل اللي يعيد بناءه. اللينكات بتفتح للي اتشاركت معاهم.':'All my work, organised by type — each with the full master prompt to rebuild it. Links open for people they are shared with.'}</p>`;
h+=`<div class="chips">${WORKCATS.map((g,i)=>`<a class="chip" href="#work" onclick="document.getElementById('wc${i}').scrollIntoView({behavior:'smooth'});return false">${g.i} ${L(g.c)} (${g.items.length})</a>`).join('')}</div>`;
WORKCATS.forEach((g,gi)=>{h+=`<h2 id="wc${gi}">${g.i} ${L(g.c)}</h2>`;g.items.forEach(w=>{h+=`<details class="case" ${PRINT?'open':''}><summary><div class="meta">${w.src}${w.u?` · <a href="${w.u}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${LANG==='ar'?'افتح ↗':'Open ↗'}</a>`:''}</div><h3>${L(w.t)}</h3><div style="color:var(--ink2);font-size:14px">${L(w.d)}</div></summary>${promptBox({t:T('Master prompt to rebuild it','البرومبت الماستر لإعادة بنائه'),p:w.p})}</details>`})});
return h}
function vCurrOld(){crumb(L(UI.curr));let mins=0;DAYS.forEach(d=>d.units.forEach(u=>mins+=+u.dur));
let h=`<h1>☰ ${L(UI.curr)}</h1><p class="lede">${DAYS.length} ${LANG==='ar'?'موديولات':'modules'} · ${DAYS.reduce((s,d)=>s+d.units.length,0)} ${L(UI.units)} · ${Math.round(mins/60)} ${LANG==='ar'?'ساعة تدريب':'training hours'} · ${DEEPORDER.length} ${LANG==='ar'?'موضوعات تعمق':'deep dives'}</p>${PRINT?'':`<div class="bar"><span style="width:${pct()}%"></span></div><p class="k" style="font-size:13px;color:var(--ink3)">${L(UI.progress)}: ${DONE.length}/${TOTAL_LESSONS()} (${pct()}%)</p>`}`;
DAYS.forEach(d=>{h+=`<h2>${L(UI.day)} ${d.n} · ${L(d.t)}</h2><div class="tablewrap"><table><tr><th>#</th><th>${LANG==='ar'?'الدرس':'Lesson'}</th><th>${LANG==='ar'?'المميزات اللي بتتغطى':'Features covered'}</th><th>${LANG==='ar'?'النوع':'Type'}</th><th>${L(UI.min)}</th><th>${L(UI.pr)}</th></tr>${d.units.map(u=>`<tr><td>${u.id}${DONE.includes(u.id)?' ✓':''}</td><td><a href="#day/${d.n}/${u.id}">${L(u.t)}</a></td><td dir="ltr" style="text-align:start">${FEAT[u.id]||''}</td><td><span class="tag ${u.tag}">${L(TAGS[u.tag])}</span></td><td>${u.dur}</td><td>${(u.prompts||[]).length}</td></tr>`).join('')}</table></div>`});
h+=`<h2>${L(UI.deep)}</h2><div class="grid">`+DEEPORDER.map(k=>`<button class="card" data-go="deep/${k}"><h3>${DEEP[k].icon} ${L(DEEP[k].t)}</h3><div class="k">${L(DEEP[k].sub)}</div></button>`).join('')+`</div>`;
return h}

function vWords(){crumb(L(UI.words));let h=`<h1>❝ ${L(UI.words)}</h1><p class="lede">${LANG==='ar'?'الجمل اللي بستخدمها في كل برومبت احترافي. انسخ وحط في برومبتك.':'The phrases I use in every professional prompt. Copy them into yours.'}</p>`;
WORDS.forEach(g=>{h+=`<h2>${L(g.g)}</h2><div class="grid">`+g.w.map(w=>{const i=PSTORE.push(LANG==='ar'?w[1]:w[0])-1;return `<div class="skill"><div style="font-size:14.5px;font-weight:500" dir="auto">${esc(LANG==='ar'?w[1]:w[0])}</div><div class="tr" dir="auto">${esc(LANG==='ar'?w[0]:w[1])}</div><button class="copy" style="margin-top:8px" data-i="${i}">${L(UI.copy)}</button></div>`}).join('')+`</div>`});return h}
function vAZ(){crumb(L(UI.az));let h=`<h1>A–Z · ${L(UI.az)}</h1><div class="prose"><p><b>${LANG==='ar'?'الشركة':'Company'}:</b> ${L(AZ.company)}</p><p><b>${LANG==='ar'?'المشكلة':'Problem'}:</b> ${L(AZ.problem)}</p></div><h2>${LANG==='ar'?'المراحل من الألف للياء':'Phases A to Z'}</h2>`;
AZ.phases.forEach(c=>h+=caseCard(c,c.tool));h+=`<h2>${LANG==='ar'?'النتايج':'Results'}</h2><div class="case">${L(AZ.results)}</div>`;return h}
function vPrint(){let h=`<section class="hero" style="margin-bottom:24px"><div class="sig">${LANG==='ar'?'د. سارة سالم':'Dr. Sara Salem'}</div><h1>Claude Mastery — ${LANG==='ar'?'المنهج الكامل':'Complete curriculum'}</h1><p class="lede">${LANG==='ar'?'صانعة المحتوى والمدرّبة · خبيرة AI في المالية':'Creator & instructor · AI Finance Expert'} · ${LINKEDIN}</p><div class="qr" style="width:120px">${QR_SVG}</div></section>`;
h+=vCurr();
DAYS.forEach(d=>{h+=`<div class="pb"></div><h1>${L(UI.day)} ${d.n} · ${L(d.t)}</h1><p class="lede">${L(d.sub)}</p>`;
d.units.forEach(u=>{h+=`<h2>${u.id} · ${L(u.t)}</h2><div class="prose"><div class="tablewrap">${L(u.body)}</div></div>`;const s=L(u.steps)||[];if(s.length)h+=`<h3 style="margin-top:14px">${L(UI.steps)}</h3><ol class="steps">${s.map(x=>`<li>${x}</li>`).join('')}</ol>`;const tp=L(u.tips)||[];if(tp.length)h+=`<h3>${L(UI.tips)}</h3><ul>${tp.map(x=>`<li>${x}</li>`).join('')}</ul>`;
(u.cases||[]).forEach(c=>h+=`<div class="case"><h3>${L(c.t)}</h3><div>${L(c.d)}</div></div>`);(u.prompts||[]).forEach(p=>h+=promptBox(p))})});
DEEPORDER.forEach(k=>{h+=`<div class="pb"></div>`+vDeep(k)});
h+=`<div class="pb"></div>`+vMap()+`<div class="pb"></div>`+vWork()+`<div class="pb"></div>`+vAZ();h+=`<div class="pb"></div>`+vWords();h+=`<div class="pb"></div>`+vSkills();
h+=`<div class="pb"></div><h1>▤ ${L(UI.cases)}</h1>`;CASES.forEach(g=>{h+=`<h2>${g.icon} ${L(g.t)}</h2>`+g.items.map(c=>caseCard(c,c.tool)).join('')});
h+=`<div class="pb"></div>`+vGloss();
h+=`<div class="pb"></div><h1>${L(UI.gallery)}</h1>`+COMMUNITY.concat(REFS).map(g=>`<h3>${L(g.g)}</h3><ul>${g.items.map(i=>`<li>${i[0]} — ${i[1]}</li>`).join('')}</ul>`).join('');
h+=`<div class="pb"></div>`+vAbout();
return h.replace(/<div class="pager">[\s\S]*?<\/div>(?=<)/g,'')}


const EXPORTS=[
['pdf_ar','📕',T('Full curriculum — PDF (Arabic)','المنهج الكامل — PDF (عربي)'),T('All modules, lessons, steps, master prompts, deep dives, A–Z case, libraries, glossary.','كل الموديولات والدروس والخطوات والبرومبتات الماستر والتعمق والحالة الكاملة والمكتبات والقاموس.')],

['html','🌐',T('Offline handbook — HTML','الدليل أوفلاين — HTML'),T('The whole curriculum in the current language as one page you can open anywhere.','المنهج كله باللغة الحالية في صفحة واحدة تفتحها في أي مكان.')],
['prompts_md','✎',T('Prompt library — Markdown','مكتبة البرومبتات — Markdown'),T('Every prompt in Arabic and English, grouped by source. Ready for Notion or Obsidian.','كل البرومبتات عربي وإنجليزي مقسمة حسب المصدر. جاهزة لـ Notion أو Obsidian.')],
['prompts_csv','▦',T('Prompt library — CSV (Excel)','مكتبة البرومبتات — CSV (Excel)'),T('One row per prompt: source, title, English, Arabic.','صف لكل برومبت: المصدر، العنوان، الإنجليزي، العربي.')],
['cases_md','▤',T('Use-case library — Markdown','مكتبة الحالات — Markdown'),T('All cases with scenario, tool, steps and master prompt.','كل الحالات بالسيناريو والأداة والخطوات والبرومبت الماستر.')],
['words_md','❝',T('My power words — Markdown','كلماتي القوية — Markdown'),T('All phrases in both languages.','كل الجمل باللغتين.')],
['gloss_csv','Aa',T('Glossary — CSV','القاموس — CSV'),T('All terms with Arabic and meanings.','كل المصطلحات بالعربي والمعنى.')],
['skills_md','✦',T('Skills library — Markdown','مكتبة الـ Skills — Markdown'),T('Every skill with what it does and a trigger sentence.','كل Skill بوظيفتها وجملة تشغيلها.')],
['mp_ar','📕',T('Master prompt book — PDF (Arabic)','كتاب البرومبتات الماستر — PDF (عربي)'),T('Every master prompt plus the lab cases with their dummy data.','كل البرومبتات الماستر ومعاها حالات المعمل وبياناتها التجريبية.')],
['data_zip','🧪',T('Dummy data pack — ZIP','حزمة البيانات التجريبية — ZIP'),T('All test datasets as CSV files.','كل بيانات الاختبار كملفات CSV.')],
['pptx','📊',T('Mastery deck — PowerPoint','عرض الإتقان — PowerPoint'),T('18 branded slides with your name and QR codes (LinkedIn + platform).','18 شريحة بالبراند واسمك وأكواد QR (لينكدإن + المنصة).')],
['zip','🗂',T('Everything — ZIP','كل حاجة — ZIP'),T('Both PDFs, the HTML handbook, all Markdown/CSV files and the reference images in folders.','الـ PDF الاتنين والدليل HTML وكل ملفات Markdown/CSV والصور المرجعية في فولدرات.')]];
function vExport(){crumb(L(UI.exp));return `<h2>${LANG==='ar'?'صدّر أي موديول (PDF · PPT · ZIP)':'Export any module (PDF · PPT · ZIP)'}</h2><p class="note">${LANG==='ar'?'بيتعمل بلغة المنصة الحالية — بدّل اللغة للنسخة التانية.':'Generated in the current language — switch language for the other version.'}</p>`+DAYS.map(d=>`<div class="modrow"><b>${d.n} · ${L(d.t)}</b>${modExportBar(d.n)}</div>`).join('')+`<h2>${LANG==='ar'?'الحزم الكاملة':'Complete packs'}</h2><h1>⤓ ${L(UI.exp)}</h1><p class="lede">${LANG==='ar'?'نزّل المنهج كله أو أي مكتبة لوحدها. الملفات بتطلع من المنصة نفسها وبتتطابق مع آخر تحديث.':'Download the whole curriculum or any library on its own. Files are generated from the platform and match the latest update.'}</p><div class="grid">`+EXPORTS.map(x=>`<div class="card"><h3>${x[1]} ${L(x[2])}</h3><div class="k" style="margin-bottom:10px">${L(x[3])}</div><button class="dlbtn" data-exp="${x[0]}">${LANG==='ar'?'تنزيل':'Download'}</button></div>`).join('')+`</div><p class="note" style="margin-top:16px">${LANG==='ar'?'هيظهرلك تأكيد قبل الحفظ.':'You will be asked to confirm each save.'}</p>`}
async function ensureZip(){if(!window.JSZip){await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)})}}
function b64blob(b,type){const bin=atob(b);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type})}
async function saveFile(filename,data){try{const dl=window.claude&&window.claude.use?await window.claude.use('downloads'):null;if(dl){await dl.save({filename,data});return true}}catch(e){if(e&&e.code==='declined')return false;if(e&&!['unavailable','not_granted','capability_disabled','capability_removed'].includes(e.code))throw e}
const blob=data instanceof Blob?data:new Blob([data]);const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);return true}
const BOM='\ufeff';const csvq=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
function mdPrompts(){let m='# Claude Mastery — Prompt library\n\nDr. Sara Salem · '+LINKEDIN+'\n';let last='';PROMPTS.forEach(p=>{if(p.src.en!==last){last=p.src.en;m+=`\n## ${p.src.en} / ${p.src.ar}\n`}m+=`\n### ${p.t.en} — ${p.t.ar}\n\n**English**\n\n\`\`\`\n${p.p.en}\n\`\`\`\n\n**العربية**\n\n\`\`\`\n${p.p.ar}\n\`\`\`\n`});return m}
function csvPrompts(){return BOM+'source,title_en,title_ar,prompt_en,prompt_ar\n'+PROMPTS.map(p=>[p.src.en,p.t.en,p.t.ar,p.p.en,p.p.ar].map(csvq).join(',')).join('\n')}
function mdCases(){let m='# Claude Mastery — Use-case library\n';const one=c=>`\n### ${c.t.en} — ${c.t.ar}\n\n*${c.tool||''}*\n\n${c.d&&c.d.en?c.d.en+'\n\n'+c.d.ar+'\n\n':''}${(c.steps&&c.steps.en||[]).map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\n\`\`\`\n${c.p.en}\n\`\`\`\n\n\`\`\`\n${c.p.ar}\n\`\`\`\n`;
CASES.forEach(g=>{m+=`\n## ${g.t.en} / ${g.t.ar}\n`;g.items.forEach(c=>m+=one(c))});['excel','cowork','agentic','playbook','integration'].forEach(k=>{m+=`\n## ${DEEP[k].t.en} / ${DEEP[k].t.ar}\n`;DEEP[k].cases.forEach(c=>m+=one(c))});m+=`\n## Master prompt lab\n`;LAB.forEach(c=>{m+=one(c);(c.data||[]).forEach(k=>m+=`\nTest data: ${k}.csv\n\n\`\`\`\n${DATA[k].csv}\n\`\`\`\n`)});m+=`\n## A–Z real case\n\n${AZ.company.en}\n\n${AZ.problem.en}\n`;AZ.phases.forEach(c=>m+=one(c));return m}
function mdWords(){return '# My power words — كلماتي القوية\n'+WORDS.map(g=>`\n## ${g.g.en} / ${g.g.ar}\n\n`+g.w.map(w=>`- ${w[0]}\n  - ${w[1]}`).join('\n')).join('\n')}
function csvGloss(){return BOM+'term,arabic,meaning_en,meaning_ar\n'+GLOSS.map(g=>g.map(csvq).join(',')).join('\n')}
function mdSkills(){return '# Skills library\n'+SKILLS.map(g=>`\n## ${g.g.en} / ${g.g.ar}\n\n`+g.items.map(s=>`### ${s.n}\n- Field: ${s.f.en} / ${s.f.ar}\n- What: ${s.d.en} / ${s.d.ar}\n- When: ${s.w.en} / ${s.w.ar}\n- Advantage: ${s.v.en} / ${s.v.ar}\n- Try: "${s.tr}"`).join('\n\n')).join('\n')}
function htmlBook(){const keep=PRINT;PRINT=true;PSTORE=[];const body=vPrint();PRINT=keep;const css=document.querySelector('style').textContent;return `<!doctype html><html lang="${LANG}" dir="${LANG==='ar'?'rtl':'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Claude Mastery — Dr. Sara Salem</title><link href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&family=Amiri:wght@700&display=swap" rel="stylesheet"><style>${css} .copy,.pager,.foot,[data-done]{display:none!important} main,.wrap{overflow:visible;height:auto}</style></head><body><div class="wrap">${body}</div></body></html>`}
async function doExport(k,btn){const old=btn.textContent;btn.textContent=LANG==='ar'?'جاري التجهيز…':'Preparing…';btn.disabled=true;
try{let ok=true;
if(k==='pdf_ar')ok=await saveFile('Claude-Mastery-Curriculum-AR.pdf',b64blob(PDF_AR,'application/pdf'));
else if(k==='pdf_en')ok=await saveFile('Claude-Mastery-Curriculum-EN.pdf',b64blob(PDF_EN,'application/pdf'));
else if(k==='html')ok=await saveFile(`Claude-Mastery-Handbook-${LANG.toUpperCase()}.html`,htmlBook());
else if(k==='mp_ar')ok=await saveFile('Master-Prompt-Book-AR.pdf',b64blob(PDF_MP_AR,'application/pdf'));
else if(k==='mp_en')ok=await saveFile('Master-Prompt-Book-EN.pdf',b64blob(PDF_MP_EN,'application/pdf'));
else if(k==='data_zip'){await ensureZip();const z=new JSZip();Object.keys(DATA).forEach(k=>z.file(k+'.csv',BOM+DATA[k].csv));ok=await saveFile('Claude-Mastery-Dummy-Data.zip',await z.generateAsync({type:'blob'}))}
else if(k==='pptx')ok=await saveFile('Claude-Mastery-Deck.pptx',b64blob(PPTX_B64,'application/vnd.openxmlformats-officedocument.presentationml.presentation'));
else if(k==='prompts_md')ok=await saveFile('Claude-Mastery-Prompt-Library.md',mdPrompts());
else if(k==='prompts_csv')ok=await saveFile('Claude-Mastery-Prompt-Library.csv',csvPrompts());
else if(k==='cases_md')ok=await saveFile('Claude-Mastery-Use-Cases.md',mdCases());
else if(k==='words_md')ok=await saveFile('Claude-Mastery-Power-Words.md',mdWords());
else if(k==='gloss_csv')ok=await saveFile('Claude-Mastery-Glossary.csv',csvGloss());
else if(k==='skills_md')ok=await saveFile('Claude-Mastery-Skills.md',mdSkills());
else if(k==='zip'){await ensureZip();
const z=new JSZip();z.file('Claude-Mastery-Curriculum-AR.pdf',b64blob(PDF_AR));
const keepL=LANG;LANG='ar';z.file('Handbook-AR.html',htmlBook());LANG='en';z.file('Handbook-EN.html',htmlBook());LANG=keepL;
z.file('libraries/Prompt-Library.md',mdPrompts());z.file('libraries/Prompt-Library.csv',csvPrompts());z.file('libraries/Use-Cases.md',mdCases());z.file('libraries/Power-Words.md',mdWords());z.file('libraries/Glossary.csv',csvGloss());z.file('libraries/Skills.md',mdSkills());z.file('Master-Prompt-Book-AR.pdf',b64blob(PDF_MP_AR));z.file('Claude-Mastery-Deck.pptx',b64blob(PPTX_B64));Object.keys(DATA).forEach(k=>z.file('dummy-data/'+k+'.csv',BOM+DATA[k].csv));
z.file('references/Official-sources.md','# Official sources\n'+COMMUNITY.concat(REFS).map(g=>`\n## ${g.g.en}\n\n`+g.items.map(i=>`- [${i[0]}](${i[1]})`).join('\n')).join('\n'));

const blob=await z.generateAsync({type:'blob'});ok=await saveFile('Claude-Mastery-Everything.zip',blob)}
btn.textContent=ok?(LANG==='ar'?'اتنزّل ✓':'Saved ✓'):old}catch(e){btn.textContent=LANG==='ar'?'حصلت مشكلة — جرّب تاني':'Something went wrong — try again';console.error(e)}
btn.disabled=false}


function vMap(){crumb(L(UI.map));const ar=LANG==='ar';
let h=`<section class="maphero"><div><div class="sig">${ar?'د. سارة سالم':'Dr. Sara Salem'}</div><h1>${ar?'خريطة إتقان Claude الكاملة':'The complete Claude mastery map'}</h1><p>${ar?'من البرومبت البسيط للوكلاء والأنظمة الحقيقية. اضغط على أي نقطة تروح للدرس بتاعها.':'From basic prompts to AI agents and real-world systems. Click any item to open its lesson.'}</p><div class="tagline">${ar?'فكّر · ابني · أتمت · اتخطى':'Think · Build · Automate · Go beyond'}</div></div><div class="pq"><div class="qr">${QR_PLATFORM}</div><a href="${PLATFORM_URL}" target="_blank" rel="noopener">${ar?'لينك المنصة':'Platform link'} ↗</a></div></section>`;
h+=`<div class="mapgrid">`+MAP.map(s=>`<div class="stage"><div class="sn">${s.n}</div><h3>${L(s.t)}</h3><p>${L(s.d)}</p><ol>${s.items.map(it=>`<li><a href="#${it[1]}">${L(it[0])}</a></li>`).join('')}</ol></div>`).join('')+`</div>`;
h+=`<h2>${ar?'التدرّج الكامل':'The complete progression'}</h2><div class="ladder">`+LADDER.map((x,i)=>`<div style="height:${30+i*11}px"><span>${i+1}</span>${x}</div>`).join('')+`</div><p class="note">${ar?'نفس الأدوات. إمكانيات أكبر.':'Same tools. Bigger possibilities.'}</p>`;
h+=`<h2>${ar?'الصورة الكبيرة':'The big picture'}</h2><div class="flow">${(ar?['البرومبت','السياق','المشروع','Artifact','Skills','Connectors','الوكلاء','موظفين AI']:['Prompt','Context','Project','Artifact','Skills','Connectors','Agents','AI employees']).map((x,i,a)=>`<span class="${i===a.length-1?'ok':''}">${x}</span>${i<a.length-1?(ar?'←':'→'):''}`).join('')}</div>`;
h+=`<h2>${ar?'رحلتك مع Claude':'Your journey with Claude'}</h2><div class="tablewrap"><table>${JOURNEY.map(j=>`<tr><td><b>${L(j[0])}</b></td><td>${L(j[1])}</td></tr>`).join('')}</table></div>`;
h+=`<div class="grid" style="margin-top:18px"><button class="card" data-go="deep/agentbuild"><h3>🤖 ${L(DEEP.agentbuild.t)}</h3><div class="k">${L(DEEP.agentbuild.sub)}</div></button><button class="card" data-go="lab"><h3>⚗ ${L(UI.lab)}</h3><div class="k">${ar?'حالات كاملة ببيانات تجريبية':'Complete cases with dummy data'}</div></button><button class="card" data-go="curriculum"><h3>☰ ${L(UI.curr)}</h3><div class="k">${ar?'كل الموديولات والدروس':'All modules and lessons'}</div></button></div>`;
return h}


function featClick(e){const g=s=>e.target.closest(s);let x;
if(x=g('[data-ceo]')){CEOON=!CEOON;render();return true}
if(x=g('[data-present]')){const [n,id]=x.dataset.present.split('|');openLive(n,id);return true}
if(x=g('[data-lv]')){const v=x.dataset.lv;if(v==='x')LIVE=null;else LIVE.i=Math.max(0,Math.min(LIVE.s.length-1,LIVE.i+(+v)));drawLive();return true}
if(x=g('[data-qmode]')){qMode=x.dataset.qmode;render();return true}
if(x=g('[data-qsubmit]')){const m=+x.dataset.qsubmit;const qs=QUIZ[m];const sc=qs.filter((q,i)=>qAns[i]===q.a).length;qDone=true;ST.quiz[m]=Math.round(sc*100/qs.length);saveST();addXP(sc*XPV.quiz);render();return true}
if(x=g('[data-qreset]')){qAns={};qDone=false;render();return true}
if(x=g('[data-fcdeck]')){fcDeck=x.dataset.fcdeck;fcI=0;fcFlip=false;render();return true}
if(x=g('[data-fcflip]')){fcFlip=!fcFlip;x.classList.toggle('flip');return true}
if(x=g('[data-fcnav]')){const n=fcDeck==='gloss'?GLOSS.length:(QUIZ[+(location.hash.split('/')[1]||1)]||[]).length;fcI=(fcI+(+x.dataset.fcnav)+n)%n;fcFlip=false;render();return true}
if(x=g('[data-tchip]')){tutorAsk(window._tchips[+x.dataset.tchip]);return true}
if(x=g('#tsend')){const t=document.getElementById('tq');tutorAsk(t.value);return true}
if(x=g('#tstop')){tutCtl&&tutCtl.abort();return true}
if(x=g('[data-simk]')){simK=x.dataset.simk;simI=0;render();return true}
if(x=g('[data-simnext]')){simI++;const s=SIMS.find(y=>y.k===simK);const n=s.steps.filter(y=>simAppr||y[0]!=='approval').length;if(simI>=n){ST.sims++;saveST();addXP(XPV.sim)}render();return true}
if(x=g('[data-simreset]')){simI=0;render();return true}
if(x=g('[data-pbsave]')){const o=pbOut();ST.mine.unshift({t:(PB_.task||'Prompt').slice(0,80),d:new Date().toISOString().slice(0,10),p:o});ST.built++;saveST();addXP(5);render();return true}
if(x=g('[data-pbdel]')){ST.mine.splice(+x.dataset.pbdel,1);saveST();render();return true}
if(x=g('[data-certdl]')){saveFile('Claude-Mastery-Certificate-'+certId()+'.svg',certSVG());return true}
return false}
document.addEventListener('change',e=>{const t=e.target;
if(t.dataset.qa){const [i,j]=t.dataset.qa.split(':').map(Number);qAns[i]=j}
if(t.dataset.simappr){simAppr=t.checked;simI=0;render()}
if(t.dataset.pbc!==undefined){const j=+t.dataset.pbc;PB_.ctrl=t.checked?[...new Set([...PB_.ctrl,j])].sort():PB_.ctrl.filter(x=>x!==j);const o=document.getElementById('pbout');if(o)o.textContent=pbOut();PSTORE[window._pbi]=pbOut()}});
document.addEventListener('input',e=>{const t=e.target;
if(t.dataset.pb){PB_[t.dataset.pb]=t.value;const o=document.getElementById('pbout');if(o)o.textContent=pbOut();PSTORE[window._pbi]=pbOut()}
if(t.id==='cname'){ST.name=t.value;saveST();const w=document.querySelector('.certwrap');if(w){const lock=w.querySelector('.lockmsg');w.innerHTML=certSVG()+(lock?lock.outerHTML:'')}}});
document.addEventListener('keydown',e=>{if(LIVE){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){const dir=(e.key==='ArrowRight')!==(LANG==='ar')?1:-1;LIVE.i=Math.max(0,Math.min(LIVE.s.length-1,LIVE.i+dir));drawLive()}if(e.key==='Escape'){LIVE=null;drawLive()}}
if(e.key==='Enter'&&(e.target.id==='gsearch'||e.target.id==='sq2')){e.preventDefault();go('search/'+encodeURIComponent(e.target.value))}
if(e.key==='Enter'&&!e.shiftKey&&e.target.id==='tq'){e.preventDefault();tutorAsk(e.target.value)}});

function footer(){return `<div class="foot"><span>© ${LANG==='ar'?'د. سارة سالم — صانعة المحتوى والمدرّبة':'Dr. Sara Salem — creator & instructor'}</span><a class="tbtn li" href="${LINKEDIN}" target="_blank" rel="noopener">in · ${LANG==='ar'?'تواصل على لينكدإن':'Connect on LinkedIn'}</a></div>`}
function vGlossOld(){crumb(L(UI.gloss));return `<h1>Aa ${L(UI.gloss)}</h1><div class="tablewrap"><table><tr><th>English</th><th>العربية</th><th>${LANG==='ar'?'المعنى':'Meaning'}</th></tr>${GLOSS.map(g=>`<tr><td><b>${g[0]}</b></td><td>${g[1]}</td><td>${LANG==='ar'?g[3]:g[2]}</td></tr>`).join('')}</table></div>`}
function vAbout(){crumb(L(UI.about));return `<h1>◎ ${L(UI.about)}</h1><p class="lede">${LANG==='ar'?'المنصة دي من تصميم وإعداد وتقديم د. سارة سالم.':'This platform was created, written and taught by Dr. Sara Salem.'}</p><div class="prof"><div><div class="sig" style="font-family:Amiri,serif;color:var(--gold);font-size:22px">${LANG==='ar'?'د. سارة سالم':'Dr. Sara Salem'}</div><h2 style="margin-top:4px">${LANG==='ar'?'صانعة محتوى ومدرّبة — خبيرة AI في المالية':'Creator & instructor — AI Finance Expert'}</h2><p>${LANG==='ar'?'مدرّبة وباحثة في الإدارة المالية، بتساعد محترفي المالية والبيزنس في مصر والخليج يستخدموا الذكاء الاصطناعي في شغلهم الحقيقي — من FP&A والتقييم للتمويل التجاري والاعتمادات المستندية.':'Trainer and researcher in financial management, helping finance and business professionals in Egypt and the Gulf use AI in real work — from FP&A and valuation to trade finance and documentary credits.'}</p><a class="tbtn li" href="${LINKEDIN}" target="_blank" rel="noopener">in · ${LANG==='ar'?'تواصل معايا على لينكدإن':'Connect on LinkedIn'}</a></div><div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center"><div><div class="qr" style="margin:0 auto">${QR_SVG}</div><div style="text-align:center;font-size:12px;color:var(--ink3)">LinkedIn</div></div><div><div class="qr" style="margin:0 auto">${QR_PLATFORM}</div><div style="text-align:center;font-size:12px;color:var(--ink3)"><a href="${PLATFORM_URL}" target="_blank" rel="noopener">${LANG==='ar'?'المنصة':'Platform'} ↗</a></div></div></div><div><div style="text-align:center;font-size:12.5px;color:var(--ink3);margin-top:6px">${L(UI.scan)}</div></div></div>`}
function render(){const rr=(location.hash.slice(1)||'').split('/');if(rr[0]==='print'||rr[0]==='printmp'){PRINT=true;LANG=rr[1]||LANG;document.body.classList.add('printing')}applyChrome();side();const r=(location.hash.slice(1)||'home').split('/');PSTORE=[];if(typeof PKS!=='undefined')PKS=[];let h;
if(r[0]==='day')h=vDay(r[1],r[2]);else if(r[0]==='deep')h=vDeep(r[1]);else if(r[0]==='skills')h=vSkills();else if(r[0]==='cases')h=vCases();else if(r[0]==='prompts'){labTab='library';h=vLab()}else if(r[0]==='work')h=vWork();else if(r[0]==='gallery')h=vGallery();else if(r[0]==='community')h=vGallery();else if(r[0]==='rescue'||r[0]==='remix'){labTab='studio';stuTab=r[0]==='rescue'?'game':'remix';history.replaceState(null,'','#lab');h=vLab()}else if(r[0]==='spot'){qMode='spot';history.replaceState(null,'','#quiz/1');h=vQuiz(1)}else if(r[0]==='fields')h=vFields();else if(r[0]==='news')h=vNews();else if(r[0]==='tracks')h=vTracks();else if(r[0]==='projects')h=vProjects();else if(r[0]==='e2e')h=vE2E();else if(r[0]==='showcase'||r[0]==='csim'){SIMTAB=r[0]==='csim'?'case':'wall';history.replaceState(null,'','#sim');h=vSim()}else if(r[0]==='curriculum')h=vCurr();else if(r[0]==='words')h=vWords();else if(r[0]==='lab'||r[0]==='studio')h=vLab();else if(r[0]==='acct')h=vAcct();else if(r[0]==='agentb')h=vAgentB();else if(r[0]==='register')h=vRegister();else if(r[0]==='card'){PRTAB='card';history.replaceState(null,'','#prog');h=vHub()}else if(r[0]==='cohort')h=vCohort();else if(r[0]==='policy')h=vPolicy();else if(r[0]==='wf')h=vWF();else if(r[0]==='mcpp')h=vMCPP();else if(r[0]==='packs'){labTab='packs';history.replaceState(null,'','#lab');h=vLab()}else if(r[0]==='roi'){PRTAB='roi';history.replaceState(null,'','#prog');h=vHub()}else if(r[0]==='ready')h=vReady();else if(r[0]==='wb'){history.replaceState(null,'','#curriculum');h=vCurr()}else if(r[0]==='map')h=vMap();else if(r[0]==='quiz')h=vQuiz(r[1]);else if(r[0]==='path')h=vPath();else if(r[0]==='pick'){PTAB='pick';history.replaceState(null,'','#path');h=vPath()}else if(r[0]==='skillbuilder')h=vSkillBuilder();else if(r[0]==='tutor')h=vTutor();else if(r[0]==='sim')h=vSim();else if(r[0]==='builder'){stuTab='build';labTab='studio';h=vLab()}else if(r[0]==='prog')h=vHub();else if(r[0]==='cert')h=vCert();else if(r[0]==='search')h=vSearch(r.slice(1).join('/'));else if(r[0]==='printmp'){h=vPrintMP();}else if(r[0]==='export')h=vExport();else if(r[0]==='az'){caseDom='az';h=vCases()}else if(r[0]==='print'){h=vPrint();}else if(r[0]==='glossary')h=vGloss();else if(r[0]==='about')h=vAbout();else h=vHome();
document.getElementById('view').innerHTML=h+(PRINT?'':footer());if(typeof asRender==='function'&&document.getElementById('asbox'))asRender();}
function go(h){if(location.hash.slice(1)===h){render()}else{location.hash=h}document.querySelector('main').scrollTop=0;document.getElementById('side').classList.remove('open')}
document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(g){unitTab='content';go(g.dataset.go);return}
const t=e.target.closest('[data-tab]');if(t){unitTab=t.dataset.tab;render();return}
const c=e.target.closest('.copy');if(c){const txt=PSTORE[+c.dataset.i];addXP(XPV.copy);const done=()=>{c.textContent=L(UI.copied);c.classList.add('done');setTimeout(()=>{c.textContent=L(UI.copy);c.classList.remove('done')},1500)};
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done,()=>{fallback(txt);done()})}else{fallback(txt);done()}return}
const dn=e.target.closest('[data-done]');if(dn){const id=dn.dataset.done;const adding=!DONE.includes(id);DONE=adding?[...DONE,id]:DONE.filter(x=>x!==id);saveDone();if(adding)addXP(XPV.lesson);render();return}
if(acctClick(e))return;if(ui4Click(e))return;if(ui3Click(e))return;if(ui2Click(e))return;if(featClick(e))return;if(toolsClick(e))return;if(studioClick(e))return;if(libClick(e))return;
const skf=e.target.closest('[data-skf]');if(skf){skF=skf.dataset.skf;render();return}
const lf=e.target.closest('[data-labf]');if(lf){labF=lf.dataset.labf;render();return}
const cv=e.target.closest('[data-csv]');if(cv){const k=cv.dataset.csv;saveFile(k+'.csv',BOM+DATA[k].csv).then(ok=>{if(ok)cv.textContent='✓'});return}
const ex=e.target.closest('[data-exp]');if(ex){doExport(ex.dataset.exp,ex);return}
const a=e.target.closest('[data-anat]');if(a){document.querySelectorAll('[data-anat]').forEach(b=>b.classList.remove('on'));a.classList.add('on');document.getElementById('anatbox').innerHTML=L(ANAT[+a.dataset.anat].e);return}
const d=e.target.closest('[data-dom]');if(d){caseDom=d.dataset.dom;render();return}
const pd=e.target.closest('[data-pdom]');if(pd){pdom=pd.dataset.pdom;render();return}

const im=e.target.closest('.gal img');if(im){const lb=document.getElementById('lb');lb.querySelector('img').src=im.src;lb.classList.add('on');return}
if(e.target.closest('#lb')){document.getElementById('lb').classList.remove('on');return}});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='cdom'){caseDom=t.value;render()}if(t.id==='ctool'){cTool=t.value;render()}if(t.id==='cdata'){cData=t.checked;render()}});
document.addEventListener('input',e=>{if(e.target.id==='cq'){cQ=e.target.value;const pos=e.target.selectionStart;render();const el=document.getElementById('cq');el.focus();el.setSelectionRange(pos,pos);return}if(e.target.id==='skq'){skQ=e.target.value;const pos=e.target.selectionStart;render();const el=document.getElementById('skq');el.focus();el.setSelectionRange(pos,pos);return}if(e.target.id==='pq'){pq=e.target.value;const pos=e.target.selectionStart;render();const el=document.getElementById('pq');el.focus();el.setSelectionRange(pos,pos)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('lb').classList.remove('on')});
function fallback(t){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch(e){}ta.remove()}
document.getElementById('langBtn').onclick=()=>{LANG=LANG==='ar'?'en':'ar';try{localStorage.setItem('cm_lang',LANG)}catch(e){}render()};
document.getElementById('themeBtn').onclick=()=>{const dark=THEME?THEME==='dark':matchMedia('(prefers-color-scheme: dark)').matches;THEME=dark?'light':'dark';try{localStorage.setItem('cm_theme',THEME)}catch(e){}render()};
document.getElementById('menuBtn').onclick=()=>document.getElementById('side').classList.toggle('open');
window.addEventListener('hashchange',()=>{render();document.querySelector('main').scrollTop=0});
render();splash();asRender();