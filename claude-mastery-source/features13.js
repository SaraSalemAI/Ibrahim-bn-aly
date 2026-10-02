// ---------- Round 14: merges (8-step agent guide → Agent builder, prompting method → Lab, playbook → Agentic A–Z, Excel with AI → Module 5) + ♻ prompt re-enhancer ----------
const UX20={builder:T('Builder','الباني'),guide:T('8-step guide','الدليل في 8 خطوات'),method:T('The method','الطريقة الكاملة'),reenh:T('Re-enhance','إعادة التحسين'),excel:T('Excel with AI — full guide','Excel بالذكاء الاصطناعي — الدليل الكامل'),playbook:T('Agentic playbook by field','دليل الوكلاء حسب المجال')};
const DEEPHIDE=new Set(['agentbuild','prompting','playbook','excel']);
let AGTAB='builder';
function deepInner(k){const D=DEEP[k];if(!D)return '';let h=`<p class="lede">${L(D.sub)}</p>`;D.sections.forEach(s=>h+=`<h2>${L(s.h)}</h2><div class="prose"><div class="tablewrap">${L(s.b)}</div></div>`);if(D.cases&&D.cases.length){h+=`<h2>${L(UI.usecases)} (${D.cases.length})</h2>`;D.cases.forEach((c,i)=>h+=caseCard(c,c.tool||`${i+1}`))}return h}
function deepRoute(k){
if(k==='agentbuild'){AGTAB='guide';history.replaceState(null,'','#agentb');return vAgentB()}
if(k==='prompting'){labTab='method';history.replaceState(null,'','#lab');return vLab()}
if(k==='playbook'){history.replaceState(null,'','#deep/agentic');setTimeout(()=>{const e=document.getElementById('playbook');if(e)e.scrollIntoView()},60);return vDeep('agentic')}
if(k==='excel'){history.replaceState(null,'','#day/5');setTimeout(()=>{const e=document.getElementById('excelguide');if(e)e.scrollIntoView()},60);return vDay('5')}
return vDeep(k)}

// Agent builder + 8-step guide
{const _ab=vAgentB;vAgentB=function(){const ar=LANG==='ar';const tabs=`<div class="tabs big"><button class="tab ${AGTAB==='builder'?'on':''}" data-agtab="builder">🤖 ${L(UX20.builder)}</button><button class="tab ${AGTAB==='guide'?'on':''}" data-agtab="guide">📘 ${L(UX20.guide)}</button></div>`;
if(AGTAB==='guide'){crumb(L(UX4.agentb)+' › '+L(UX20.guide));return `<h1>🤖 ${L(UX4.agentb)}</h1>`+tabs+`<h2 style="margin-top:6px">${L(DEEP.agentbuild.t)}</h2>`+deepInner('agentbuild')+`<p class="row-btns"><button class="btn-gold" data-agtab="builder">🤖 ${ar?'ابدأ تبني وكيلك دلوقتي':'Start building your agent now'}</button></p>`}
return _ab().replace(/(<\/h1>)/,'$1'+tabs)}}

// Lab: prompting method tab
{const _vl=vLab;vLab=function(){const btn=`<button class="tab ${labTab==='method'?'on':''}" data-labtab="method">📐 ${L(UX20.method)}</button>`;const inj=h=>h.replace(/(<div class="tabs big">[\s\S]*?)(<\/div>)/,'$1'+btn+'$2');
if(labTab!=='method')return inj(_vl());const keep=labTab;labTab='library';let head;try{head=_vl()}finally{labTab=keep}const m=head.match(/^[\s\S]*?<div class="tabs big">[\s\S]*?<\/div>/);crumb(L(UI.lab)+' › '+L(UX20.method));
return inj((m?m[0]:'').replace(/ on"/g,'"'))+`<h2 style="margin-top:6px">${L(DEEP.prompting.t)}</h2>`+deepInner('prompting')+`<p class="row-btns"><button class="btn-gold" data-gostu="reenh">♻ ${L(UX20.reenh)}</button><button class="tbtn" data-labtab="studio">🎛 ${L(UX3.studio)}</button></p>`}}

// Agentic A–Z + playbook by field
{const _vd=vDeep;vDeep=function(k){const h=_vd(k);if(k!=='agentic')return h;const ar=LANG==='ar';const P=DEEP.playbook;
const jump=`<div class="chips"><button class="chip" data-jump="playbook">📒 ${L(UX20.playbook)} (${P.cases.length})</button></div>`;
const body=`<section id="playbook" class="mergedsec"><h2>📒 ${L(P.t)}</h2>`+deepInner('playbook')+`</section>`;
return h.replace(/(<p class="lede">[\s\S]*?<\/p>)/,'$1'+jump).replace(/(<div class="pager">)/,body+'$1')}}

// Excel with AI → Module 5 page
{const _vd=vDay;vDay=function(n,id){const h=_vd(n,id);if(String(n)!=='5'||id)return h;return h+`<section id="excelguide" class="mergedsec"><h2>📗 ${L(UX20.excel)}</h2>`+deepInner('excel')+`</section>`}}
(function(){const u=(DAYS.find(d=>d.n===5)||{units:[]}).units.find(x=>x.id==='5.1');if(u)u.t=T(u.t.en.replace(/\s*\(full guide in Deep dives\)/,'')+' (full guide on the module page)',u.t.ar.replace(/\s*\(.*?\)/,'')+' (الدليل الكامل في صفحة الموديول)')})();

// ---------- ♻ Prompt re-enhancer (Studio tab) ----------
const RE_GOALS=[['role',T('Sharper role & market','دور وسوق أوضح')],['context',T('Richer context & data','سياق وبيانات أغنى')],['reason',T('Step-by-step reasoning','تفكير خطوة بخطوة')],['stop',T('Checkable stop conditions','شروط توقف قابلة للمراجعة')],['format',T('Exact output format','شكل مخرج محدد')],['accuracy',T('Accuracy controls','ضوابط الدقة')],['example',T('Add an example','ضيف مثال')],['shorter',T('Shorter & tighter','أقصر وأدق')],['arabic',T('Add an Arabic version','ضيف نسخة عربي')]];
let RE=Object.assign({p:'',goals:['role','context','stop','format','accuracy'],hist:[],busy:false},ST.re||{});
function saveRE(){const {busy,...r}=RE;ST.re=r;saveST()}
function reLocal(p){p=String(p||'').trim();if(!p)return '';const ar=/[؀-ۿ]/.test(p)&&!/[a-z]{4}/i.test(p.replace(/<[^>]+>/g,''));const tag=k=>(p.match(new RegExp(`<${k}>([\\s\\S]*?)</${k}>`))||[])[1];
const role=tag('role')||(ar?'خبير متخصص لشركة في مصر أو الخليج':'Senior specialist at a company in Egypt or the Gulf');const task=tag('task')||p.split(/\n|\.\s/)[0].slice(0,300);
const ctx=tag('context')||p.split('\n').slice(1).filter(x=>x.trim()).map(x=>'- '+x.replace(/^[-•*]\s*/,'')).join('\n');
const add=(s,line)=>s.includes(line.slice(2,20))?s:(s?s+'\n':'')+line;
let c=ctx;c=add(c,ar?'- البيانات: [ارفع الملف أو الصقه]':'- Data: [attach or paste the file]');c=add(c,ar?'- الفترة والعملة والجمهور: [..]':'- Period, currency and audience: [..]');
const reason=tag('reasoning')||(ar?'فكّر خطوة بخطوة: افهم الهدف، راجع البيانات، طلّع النتيجة، وراجعها قبل ما تسلّم.':'Think step by step: clarify the goal, check the data, produce the result, then review it before you deliver.');
let stop=tag('stop_when')||'';stop=add(stop,ar?'- كل رقم ليه مصدر من البيانات المرفقة':'- Every number traced to the attached data');stop=add(stop,ar?'- لحد 3 أسئلة توضيحية قبل البدء لو فيه نقص':'- Up to 3 clarifying questions first if anything is missing');stop=add(stop,ar?'- الافتراضات متعلّمة ومفيش حاجة متألفة':'- Assumptions labelled; nothing invented');
const out=tag('output_format')||(ar?'جدول + ملخص 5 نقاط، بالعربي، أقل من صفحة':'A table + 5-bullet summary, in English, under 1 page');
return `<role>${role.trim()}</role>\n<task>${task.trim()}</task>\n<context>\n${c.trim()}\n</context>\n<reasoning>${reason.trim()}</reasoning>\n<stop_when>\n${stop.trim()}\n</stop_when>\n<output_format>${out.trim()}</output_format>`}
function vReenh(){const ar=LANG==='ar';const cur=RE.hist.length?RE.hist[RE.hist.length-1].p:RE.p;const s0=RE.p.trim()?pkScoreFull(RE.p).score:null;
let h=`<p class="lede">${ar?'الصق أي برومبت — بتاعك أو من المنصة أو من المساعد — واختار هتحسّن إيه. هتاخد نسخة محسّنة فورًا، وبعدين Claude يحسّنها تاني، وتقدر تعيد التحسين كذا مرة لحد ما توصل لـ 90+.':'Paste any prompt — yours, from the platform or from the assistant — and pick what to improve. You get an instant upgrade, then Claude enhances it, and you can re-enhance again and again until it reaches 90+.'}</p>
<div class="twocol"><div class="abpane"><label class="pbf"><b>${ar?'البرومبت الأصلي':'Original prompt'} ${s0!=null?`<span class="pkscore ${s0>=80?'hi':s0>=55?'mid':'lo'}">${s0}</span>`:''}</b><textarea class="search" id="rep" rows="9" dir="auto">${esc(RE.p)}</textarea></label>
<b>${ar?'حسّن إيه؟':'Improve what?'}</b><div class="chips">${RE_GOALS.map(g=>`<button class="chip ${RE.goals.includes(g[0])?'on':''}" data-reg="${g[0]}">${L(g[1])}</button>`).join('')}</div>
<div class="row-btns"><button class="tbtn" data-re="local">⚡ ${ar?'تحسين فوري':'Instant upgrade'}</button><button class="btn-gold" data-re="claude" ${RE.busy?'disabled':''}>${RE.busy?(ar?'Claude بيحسّن…':'Claude is enhancing…'):'♻ '+(RE.hist.length?(ar?'أعد التحسين':'Re-enhance again'):(ar?'حسّن مع Claude':'Enhance with Claude'))}</button><button class="tbtn" data-re="clear">${ar?'ابدأ من جديد':'Start over'}</button></div><p class="note" id="renote"></p>
<div class="reext"><b>🧩 ${ar?'إضافة لـ Claude نفسه':'Add-on for Claude itself'}</b><p class="k">${ar?'نزّل Skill «مُعيد تحسين البرومبتات» وارفعها في Claude — وأي برومبت تكتبه هناك تقوله «حسّنه» يتحسّن بنفس الطريقة.':'Download the «prompt re-enhancer» Skill and add it to Claude — then say «enhance this» to any prompt there and it improves it the same way.'}</p><div class="row-btns"><button class="tbtn" data-re="skill">⬇ SKILL.md</button><button class="tbtn" data-re="proj">📋 ${ar?'انسخ كتعليمات Project':'Copy as Project instructions'}</button></div></div></div>
<div class="abpane"><h3>📈 ${ar?'النسخ':'Versions'}</h3>${RE.hist.length?`<div class="rehist">${RE.hist.map((v,i)=>`<span class="pkscore ${v.s>=80?'hi':v.s>=55?'mid':'lo'}">v${i+1}: ${v.s}</span>`).join(' → ')}</div>`:`<p class="k">${ar?'لسه مفيش نسخ — ابدأ بتحسين فوري أو مع Claude.':'No versions yet — start with an instant upgrade or Claude.'}</p>`}
${RE.hist.length?(()=>{const v=RE.hist[RE.hist.length-1];const i=PSTORE.push(v.p)-1;return `<h3>v${RE.hist.length} · ${v.by==='claude'?'Claude':(ar?'فوري':'instant')}</h3>${v.changes&&v.changes.length?`<ul class="k" style="font-size:13px">${v.changes.map(c=>`<li dir="auto">${esc(c)}</li>`).join('')}</ul>`:''}<pre dir="auto" class="repre">${esc(v.p)}</pre><div class="row-btns"><button class="copy" data-i="${i}">${L(UI.copy)}</button><button class="tbtn" data-re="save">💾 ${ar?'احفظ في برومبتاتي':'Save to My prompts'}</button><button class="tbtn" data-re="back" ${RE.hist.length<2?'disabled':''}>↶ ${ar?'رجّع نسخة':'Undo version'}</button></div>`})():''}</div></div>`;
return h}
async function reClaude(){const ar=LANG==='ar';const n=t=>{const e=document.getElementById('renote');if(e)e.textContent=t};const cur=RE.hist.length?RE.hist[RE.hist.length-1].p:RE.p;if(!cur.trim()){n(ar?'الصق برومبت الأول.':'Paste a prompt first.');return}
const sample=await tutorSample();if(!sample){n(ar?'التحسين مع Claude بيشتغل لما المنصة تتفتح جوه Claude — جرّب «تحسين فوري».':'Enhancing with Claude works when the platform is opened inside Claude — try «Instant upgrade».');return}
RE.busy=true;render();const goals=RE.goals.map(g=>RE_GOALS.find(x=>x[0]===g)[1].en).join('; ');
const ask=`You are a master prompt engineer for business professionals in Egypt and the Gulf. Re-enhance the prompt below (version ${RE.hist.length+1}). Focus on: ${goals}. Keep every fact, number, name and the user's intent; put unknowns in [brackets]; do not invent data. Use the six XML blocks <role>, <task>, <context>, <reasoning>, <stop_when>, <output_format> (context and stop_when as "- " lines; stop_when has 2–4 checkable limits with numbers). Keep the prompt's language${RE.goals.includes('arabic')?', then add a complete Arabic version after a line "---"':''}. List the 3–6 most important changes in ${ar?'Egyptian Arabic':'English'}.
Reply with JSON only: {"rewrite":"","changes":[""]}

PROMPT:
${cur.slice(0,7000)}`;
try{const j=await sample.json(ask,{modelTier:'default'});if(!j||typeof j.rewrite!=='string'||!j.rewrite.trim())throw new Error('shape');const p=j.rewrite.trim();RE.hist.push({p,s:pkScoreFull(p).score,by:'claude',changes:(j.changes||[]).slice(0,6).map(String)});if(!ST.reXP){ST.reXP=1;addXP(5)}}
catch(e){n(e&&e.code==='rate_limited'?(ar?'طلبات كتير — جرّب بعد شوية.':'Too many requests — try again soon.'):(ar?'مقدرتش أحسّن دلوقتي. جرّب تاني.':'Could not enhance right now. Try again.'))}
RE.busy=false;saveRE();render()}
const RE_SKILL=`---
name: prompt-re-enhancer
description: "Re-enhances any prompt into a six-block master prompt (role, task, context, reasoning, stop conditions, output format) for business work in Egypt and the Gulf. Use when the user says enhance, improve, rewrite or fix a prompt, or pastes a prompt and asks to make it better."
---

# Prompt re-enhancer (Claude Mastery)

## Method
1. Read the prompt and the user's goal. Ask up to 3 short questions only if the task or audience is unclear.
2. Score it 0–100 on six blocks: role, task, context, reasoning, stop conditions, output format. Show the score per block.
3. Rewrite it with XML tags <role>, <task>, <context>, <reasoning>, <stop_when>, <output_format>:
   - role: expertise + market (Egypt / Gulf) + audience
   - context: "- " lines with data, period, currency, constraints; unknowns in [brackets]
   - stop_when: 2–4 checkable limits with numbers; every number traced to the data; assumptions labelled
   - output_format: exact structure, language, length
4. List the 3–6 changes you made and why.
5. Offer one more round: "Say re-enhance to improve it again (e.g. shorter, add an example, Arabic version)."

## Rules
- Keep every fact, number and name from the original. Never invent data.
- Keep the original language unless asked; add an Arabic version on request.
- Keep a human review step for decisions, money, people and customers.
`;
{const _tabs=vStudioTabs;vStudioTabs=function(){return _tabs().replace(/<\/div>$/,`<button class="tab ${stuTab==='reenh'?'on':''}" data-stutab="reenh">♻ ${L(UX20.reenh)}</button></div>`)}}
{const _vs=vStudio;vStudio=function(){if(stuTab!=='reenh')return _vs();crumb(L(UX3.studio)+' › '+L(UX20.reenh));return `<h1>🎛 ${L(UX3.studio)}</h1>`+vStudioTabs()+vReenh()}}
// "Re-enhance" button under every master prompt on the platform
{const _pb=promptBox;promptBox=function(p,extra){const h=_pb(p,extra);if(!/<role>/.test(L(p.p)||''))return h;const i=PSTORE.push(L(p.p))-1;return h.replace(/(<\/div><pre)/,`<button class="tbtn rebtn" data-rei="${i}" title="${LANG==='ar'?'أعد تحسينه':'Re-enhance'}">♻</button>$1`)}}

document.addEventListener('click',e=>{const g=s=>e.target.closest(s);let x;
if(x=g('[data-agtab]')){AGTAB=x.dataset.agtab;render();document.querySelector('main').scrollTop=0;return}
if(x=g('[data-jump]')){const el=document.getElementById(x.dataset.jump);if(el)el.scrollIntoView({behavior:'smooth'});return}
if(x=g('[data-gostu]')){labTab='studio';stuTab=x.dataset.gostu;if(location.hash.slice(1)!=='lab')location.hash='lab';else render();return}
if(x=g('[data-rei]')){const p=PSTORE[+x.dataset.rei];if(p){RE={p,goals:RE.goals,hist:[],busy:false};saveRE();labTab='studio';stuTab='reenh';if(location.hash.slice(1)!=='lab')location.hash='lab';else render();document.querySelector('main').scrollTop=0}return}
if(x=g('[data-reg]')){const k=x.dataset.reg;RE.goals=RE.goals.includes(k)?RE.goals.filter(y=>y!==k):RE.goals.concat(k);saveRE();render();return}
if(x=g('[data-re]')){const a=x.dataset.re;const ar=LANG==='ar';
if(a==='local'){const cur=RE.hist.length?RE.hist[RE.hist.length-1].p:RE.p;if(!cur.trim())return;const p=reLocal(cur);RE.hist.push({p,s:pkScoreFull(p).score,by:'local',changes:[ar?'اتضافت البلوكات الناقصة وضوابط الدقة':'Missing blocks and accuracy controls added']});saveRE();render()}
else if(a==='claude'&&!RE.busy)reClaude();
else if(a==='clear'){RE={p:'',goals:RE.goals,hist:[],busy:false};saveRE();render()}
else if(a==='back'){RE.hist.pop();saveRE();render()}
else if(a==='save'&&RE.hist.length){ST.mine.unshift({t:(ar?'محسّن · ':'Re-enhanced · ')+RE.p.slice(0,50),d:new Date().toISOString().slice(0,10),p:RE.hist[RE.hist.length-1].p});saveST();x.textContent='✓'}
else if(a==='skill')saveFile('prompt-re-enhancer-SKILL.md',RE_SKILL).then(ok=>{if(ok)x.textContent='✓'});
else if(a==='proj'){const t=RE_SKILL.replace(/^---[\s\S]*?---\n\n/,'');(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>x.textContent='✓').catch(()=>{const i=PSTORE.push(t)-1;x.outerHTML=`<button class="copy" data-i="${i}">${L(UI.copy)}</button>`})}return}});
document.addEventListener('input',e=>{if(e.target.id==='rep'){RE.p=e.target.value;RE.hist=[];saveRE()}});
