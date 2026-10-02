// ---------- Round 12: merges (diagrams → Studio, finance department → Simulators, tracks → Field library, Get involved removed) + curriculum-wide AI assistant ----------
const UX18={diag:T('Diagrams','الرسومات'),fin:T('Finance department','الإدارة المالية'),lib:T('Library','المكتبة'),track:T('Field track','مسار المجال')};
UX12.sims=T('Simulators & finance department','المحاكيات والإدارة المالية');
let FTAB='lib';

// Interactive diagrams → Master Prompt Studio tab
{const _tabs=vStudioTabs;vStudioTabs=function(){return _tabs().replace(/<\/div>$/,`<button class="tab ${stuTab==='diag'?'on':''}" data-stutab="diag">🎞 ${L(UX18.diag)}</button></div>`)}}
{const _vs=vStudio;vStudio=function(){if(stuTab!=='diag')return _vs();crumb(L(UX3.studio)+' › '+L(UX16.diag));return `<h1>🎛 ${L(UX3.studio)}</h1>`+vStudioTabs()+vDiagrams().replace(/^<h1>[\s\S]*?<\/h1>/,'')}}

// Claude Finance Department → Simulators tab
{const _vsim=vSim;vSim=function(){const btn=`<button class="tab ${SIMTAB==='fin'?'on':''}" data-simtab="fin">💼 ${L(UX18.fin)}</button>`;
if(SIMTAB!=='fin')return _vsim().replace(/(<div class="tabs big">[\s\S]*?)(<\/div>)/,'$1'+btn+'$2');
const keep=SIMTAB;SIMTAB='agent';let head;try{head=_vsim()}finally{SIMTAB=keep}const m=head.match(/^<h1>[\s\S]*?<\/h1><div class="tabs big">[\s\S]*?<\/div>/);
const tabs=(m?m[0]:`<h1>🔄 ${L(UX12.sims)}</h1>`).replace(/ on"/g,'"').replace(/(<div class="tabs big">[\s\S]*?)(<\/div>)$/,'$1'+btn+'$2');
const body=vFinDept().replace(/^<h1>[\s\S]*?<\/h1>/,'');crumb(L(UX12.sims)+' › '+L(UX16.fd));return tabs+`<h2 style="margin-top:6px">💼 ${L(UX16.fd)}</h2>`+body}}

// Field tracks → Field library tab
{const _vf=vFields;vFields=function(){const ar=LANG==='ar';const tabs=`<div class="tabs big ftabs"><button class="tab ${FTAB==='lib'?'on':''}" data-ftab="lib">🗃 ${L(UX18.lib)}</button><button class="tab ${FTAB==='track'?'on':''}" data-ftab="track">🎓 ${L(UX18.track)}</button></div>`;
if(FTAB==='track'){const h=vTracks();crumb(L(UX13.fields)+' › '+L(UX18.track));return h.replace(/^(<h1>[\s\S]*?<\/h1>)/,`<h1>🗃 ${L(UX13.fields)}</h1>`+tabs)}
const h=_vf();return h.replace(/(<\/h1>)/,'$1'+tabs)}}

// References: remove the "Get involved" checklist
{const _vg=vGallery;vGallery=function(){const ar=LANG==='ar';return _vg().replace(/<h2>✅[\s\S]*?(?=<h2>)/,'').replace(/<div class="tips2 ok">🏅[\s\S]*?<\/div>/,'').replace(ar?'شارك في المجتمع، ':'get involved, ','')}}

// Old module 11 links → Module 8
{const _vd=vDay;vDay=function(n,id){if(String(n)==='11'){n=8;if(id&&IDMAP2[id])id=IDMAP2[id]}return _vd(n,id)}}

// ---------- AI assistant that knows the whole curriculum ----------
let ASIDX=null;
const asNorm=s=>String(s||'').toLowerCase().replace(/[ً-ْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');
const AS_STOP=new Set('the and for with how what can you are this that from into your have about want need make give write build create use using does which when where who why عايز عاوز ازاي اعمل ممكن ايه اللي على علي في من مع عن هو هي انا انت لو يعني بتاع ده دي كده اكتب اكتبلي ابني'.split(' '));
function asBuild(){const A=[];const add=(t,r,kind,body,prompt,xar)=>{if(!t)return;const te=t.en||'',ta=t.ar||'';A.push({t,r,kind,title:asNorm(te+' '+ta),txt:asNorm(te+' '+ta+' '+(body||'')+' '+(xar||'')),body:body||'',prompt:prompt||''})};
const S=x=>{try{x()}catch(e){}};const P=p=>p?(typeof p==='string'?p:p.en||''):'';
S(()=>DAYS.forEach(d=>d.units.forEach(u=>add(u.t,'day/'+d.n+'/'+u.id,'lesson '+u.id,strip(u.body.en||'').slice(0,900),P((u.prompts||[])[0]&&u.prompts[0].p),strip(u.body.ar||'').slice(0,700)))));
S(()=>Object.entries(FIELDMODS).forEach(([k,F])=>F.m.units.forEach(u=>add(T(u.t.en+' — '+F.m.t.en,u.t.ar+' — '+F.m.t.ar),'fields/'+k,'field course',strip(u.body.en||'').slice(0,700),P(u.prompts[0]&&u.prompts[0].p),strip(u.body.ar||'').slice(0,600)))));
S(()=>FIELDLIB.forEach(f=>f.tasks.forEach(t=>add(T(f.t.en+' · '+t.t.en,f.t.ar+' · '+t.t.ar),'fields/'+f.k,'field task','',P(t.p)))));
S(()=>CASES.forEach(g=>g.items.forEach(c=>{const x=typeof CX!=='undefined'?CX[g.k+'|'+c.t.en]:null;add(c.t,'cases','use case',(c.d?c.d.en:'')+' '+(x?x.prob.en:''),P(c.p),(c.d?c.d.ar:'')+' '+(x?x.prob.ar:''))})));
S(()=>E2E.forEach(c=>add(c.co,'e2e/'+c.k,'company case',strip(c.prob.en||''),P(c.phases[0]&&c.phases[0].p))));
S(()=>FD.forEach(f=>f.agents.forEach(a=>add(T(a.n.en+' ('+f.t.en+')',a.n.ar+' ('+f.t.ar+')'),'findept/'+f.k,'finance agent',a.role.en+'. Job: '+a.job.en+' Inputs: '+a.in.en+' Outputs: '+a.out.en+' Guardrails: '+a.guard.en,fdPrompt(a,f,'en'),a.role.ar+' '+a.job.ar+' '+a.out.ar))));
S(()=>DEEPORDER.forEach(k=>(DEEP[k].sections||[]).forEach(s=>add(T(DEEP[k].t.en+' · '+(s.h?s.h.en:''),DEEP[k].t.ar+' · '+(s.h?s.h.ar:'')),'deep/'+k,'deep dive',strip(s.b&&s.b.en||'').slice(0,700),''))));
S(()=>GLOSS.forEach(g=>add(T(g[0],g[1]),'glossary','glossary',g[2],'',g[3])));
S(()=>DIAG.forEach(d=>add(d.t,'diagrams/'+d.k,'diagram',d.d.en+' '+d.steps.map(s=>s.c.en).join(' '),'')));
S(()=>Object.entries(CHAINS).forEach(([k,c])=>add(c.t,'fields/'+k,'prompt chain',c.steps.map(s=>s.t.en).join(' → '),P(c.steps[0]&&c.steps[0].p))));
ASIDX=A}
const asStem=w=>{if(!/[\u0600-\u06FF]/.test(w))return w.replace(/(ies|es|s)$/,'');let x=w.replace(/^(وال|بال|كال|فال|لل|ال|و)(?=..)/,'');x=x.replace(/(ات|ون|ين|ه|ي)$/,m=>x.length-m.length>=3?'':m);return x.length>=3?x:w};
function asSearch(q,n){if(!ASIDX)asBuild();const terms=[...new Set(asNorm(q).split(/[^\p{L}\p{N}&+#.]+/u).filter(w=>w.length>2&&!AS_STOP.has(w)).map(asStem))];if(!terms.length)return [];const md=asMode(q);
return ASIDX.map(x=>({x,s:terms.reduce((a,t)=>a+(x.title.includes(t)?3:x.txt.includes(t)?1:0),0)+(md==='agent'&&/agent/.test(x.kind)?1:0)})).filter(r=>r.s>0).sort((a,b)=>b.s-a.s||(b.x.prompt?1:0)-(a.x.prompt?1:0)).slice(0,n||6).map(r=>r.x)}
function asMode(q){const s=asNorm(q);if(/agent|وكيل|وكلاء|system prompt|سيستم برومبت|automat|اتمت|أتمت/.test(s))return 'agent';if(/skill|سكيل|skill\.md|مهاره/.test(s))return 'skill';if(/prompt|برومبت|بروميت|template|قالب/.test(s))return 'prompt';return 'ask'}
const ASK_SUG2=T(["Write me a master prompt for a monthly KPI pack","Build me an agent that chases overdue invoices","Create a Skill for our board report","What is the difference between Projects and Skills?","Which lessons teach IFRS 9 staging?","Give me an HR agent that screens CVs fairly"],["اكتبلي برومبت ماستر لحزمة مؤشرات شهرية","ابنيلي وكيل يتابع الفواتير المتأخرة","اعملي Skill لتقرير مجلس الإدارة","إيه الفرق بين Projects و Skills؟","أنهي دروس بتشرح مراحل IFRS 9؟","اديني وكيل HR يفرز السير الذاتية بعدل"]);
const AS_MODES={ask:'Answer the question directly (short paragraphs and bullets). Then "Try it": ONE full master prompt that applies the answer — English in a fenced code block, then Arabic in a second fenced code block. Then "Learn more".',
prompt:'1) One paragraph: which Claude surface to use and why. 2) Numbered steps (5–8). 3) A full master prompt in ENGLISH in a fenced code block with XML tags <role>, <task>, <context>, <reasoning>, <stop_when>, <output_format>; it must ask up to 3 clarifying questions first, label assumptions, never invent numbers, and mark items for human review. 4) The same master prompt in ARABIC in a second fenced code block. 5) A filled example of the brackets for a typical company in Egypt. 6) "Learn more".',
agent:'1) Purpose and the ONE job of the agent. 2) Architecture: which surface (Cowork, Claude Code, Agent SDK / API, Managed Agents), tools and connectors, Skills, memory/knowledge, and the human approval points. 3) A full AGENT SYSTEM PROMPT in ENGLISH in a fenced code block with sections <role>, <job>, <inputs>, <outputs>, <tools>, <responsibilities>, <guardrails>, <approval_points>, <method>, <stop_when>, <output_format>. 4) The same system prompt in ARABIC in a second fenced code block. 5) A practical test task the user can run today with sample data. 6) "Learn more".',
skill:'1) When the Skill should trigger. 2) A complete SKILL.md in ENGLISH in a fenced code block: YAML front matter (name in lowercase-kebab, description that says what it does AND when to use it), then sections When to use, Method (numbered steps), Output (exact format), Quality checks (checkboxes), Guardrails. 3) The same SKILL.md in ARABIC in a second fenced code block. 4) How to add and test it. 5) "Learn more".'};
async function asAsk(q){if(!q||!q.trim()||AS.busy)return;AS.msgs.push({role:'user',text:q});const src=asSearch(q,6);const mode=asMode(q);const sample=await tutorSample();
if(!sample){AS.msgs.push(asOffline(q));asRender();return}
AS.busy=true;asRender();const ar=LANG==='ar';const toc=DAYS.map(d=>`Module ${d.n} ${d.t.en}: `+d.units.map(u=>u.id+' '+u.t.en).join('; ')).join('\n');
const ctx=src.map((x,i)=>`[${i+1}] ${x.kind} — ${x.t.en} (open: #${x.r})\n${x.body.slice(0,550)}${x.prompt?'\nPlatform master prompt (excerpt):\n'+x.prompt.slice(0,800):''}`).join('\n\n').slice(0,7000);
const sys=`You are the AI tutor and build assistant of "Claude Mastery" by Dr. Sara Salem, a bilingual platform for business and finance professionals in Egypt and the Gulf. You know the whole platform: 11 modules, 23 field courses, a use-case library with standard templates, end-to-end company cases, the Claude Finance Department (50 agents and 50 skills), deep dives, diagrams and a glossary. Answer ANY question the learner asks — about Claude, prompting, agents, Skills, the curriculum, or applying AI at work.
Use the PLATFORM CONTEXT as your main source; cite items like [1] and name the lesson. If the context does not cover it, answer from general knowledge and say what to verify. Never invent Claude features, prices, limits or dates; date-sensitive facts are "as of Sept 2026". Respect privacy: tell users not to paste confidential or personal data into tools their company has not approved. Keep a human in the loop for decisions.
MODE: ${mode}. Reply structure: ${AS_MODES[mode]}
"Learn more" = 1–3 lines naming the most relevant platform items from the context or the curriculum below.
Write all explanations in ${ar?'Egyptian Arabic':'English'}; prompts in the languages stated above.
CURRICULUM:
${toc}

PLATFORM CONTEXT:
${ctx||'(no close match — use the curriculum list)'}`;
try{const {text}=await sample([{role:'user',content:sys},{role:'assistant',content:ar?'تمام، جاهز.':'Ready.'},...AS.msgs.filter(m=>m.role==='user'||m.text).slice(-6).map(m=>({role:m.role,content:m.text}))],{cache:false,modelTier:'default',onText:({text})=>{const l=document.getElementById('aslive');if(l)l.innerHTML=asFmt(text)}});
const prompts=[...text.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map(x=>x[1].trim());AS.msgs.push({role:'assistant',text,prompts,src:src.map(x=>({t:x.t,r:x.r,kind:x.kind})),mode,q})}
catch(e){AS.msgs.push(asOffline(q))}
AS.busy=false;asRender()}
{const _off=asOffline;asOffline=function(q){const o=_off(q);const src=asSearch(q,5);if(src.length){o.rel=src.map(x=>({x:{r:x.r,t:x.t}}));const p=src.find(x=>x.prompt);if(p&&p.prompt.includes('<role>')){o.en=p.prompt;o.why=(LANG==='ar'?'أقرب برومبت ماستر من المنصة: ':'Closest master prompt on the platform: ')+L(p.t);o.route=p.r}}return o}}
function asFmt(text,btns){const parts=String(text||'').split(/```[a-zA-Z]*\n?([\s\S]*?)(?:```|$)/);return parts.map((x,i)=>{if(i%2===0)return x.trim()?fmtMD(x):'';const code=x.trim();return `<div class="asp"><div class="ph"><b>${/[\u0600-\u06FF]/.test(code)?'العربي':'English'}</b>${btns?btns(code):''}</div><pre dir="auto">${esc(code)}</pre></div>`}).join('')}
function asRender(){let b=document.getElementById('asbox');if(!b){b=document.createElement('div');b.id='asbox';document.body.appendChild(b)}const ar=LANG==='ar';
if(!AS.open){b.innerHTML=`<button class="asfab" data-as="open" aria-label="Assistant">💬<span>${ar?'اسأل المساعد':'Ask the assistant'}</span></button>`;return}
const save=(p,q)=>{const i=PSTORE.push(p)-1;return `<span class="asbtns"><button class="copy" data-i="${i}">${L(UI.copy)} ${/[؀-ۿ]/.test(p)?'(AR)':'(EN)'}</button><button class="tbtn" data-assave="${i}" data-asq="${esc((q||'Assistant prompt').slice(0,70))}">💾 ${ar?'احفظ':'Save'}</button></span>`};
const srcs=m=>m.src&&m.src.length?`<div class="assrc"><b>📚 ${ar?'من المنصة':'From the platform'}:</b> ${m.src.map((s,i)=>`<a href="#${s.r}">[${i+1}] ${esc(L(s.t))}</a>`).join(' · ')}</div>`:'';
const msg=m=>{if(m.role==='user')return `<div class="msg user">${esc(m.text)}</div>`;if(m.kind==='offline'){const ie=PSTORE.push(m.en)-1,ia=PSTORE.push(m.ar)-1;return `<div class="msg assistant"><p class="k">${ar?'وضع بدون اتصال — افتح المنصة جوه Claude علشان ردود كاملة.':'Offline mode — open the platform inside Claude for full answers.'}</p><b>${ar?'المقترح':'Suggested'}:</b> ${esc(m.why)} <a href="#${m.route}">${ar?'افتح':'Open'} →</a><ol>${m.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><div class="asp"><div class="ph"><b>Master prompt (EN)</b><button class="copy" data-i="${ie}">${L(UI.copy)}</button></div><pre dir="ltr">${esc(m.en)}</pre></div><div class="asp"><div class="ph"><b>البرومبت الماستر (عربي)</b><button class="copy" data-i="${ia}">${L(UI.copy)}</button></div><pre dir="rtl">${esc(m.ar)}</pre></div>${m.rel.length?`<div class="assrc"><b>📚 ${ar?'من المنصة':'From the platform'}:</b> ${m.rel.map(r=>`<a href="#${r.x.r}">${esc(L(r.x.t))}</a>`).join(' · ')}</div>`:''}</div>`}
const tag=m.mode?`<span class="asmode">${{ask:ar?'إجابة':'Answer',prompt:ar?'برومبت ماستر':'Master prompt',agent:ar?'وكيل':'Agent',skill:'Skill'}[m.mode]}</span>`:'';
return `<div class="msg assistant">${tag}${asFmt(m.text,c=>save(c,m.q))}${srcs(m)}</div>`};
b.innerHTML=`<div class="aspanel ${AS.big?'big':''}"><div class="ashead"><b>💬 ${ar?'مساعد Claude Mastery':'Claude Mastery assistant'}</b><span class="k">${ar?'اسأل عن أي حاجة في المنهج — وخد برومبت ماستر أو وكيل أو Skill كامل بالعربي والإنجليزي':'Ask about anything in the curriculum — get a full master prompt, agent or Skill in English and Arabic'}</span><button class="tbtn" data-as="big" title="${ar?'كبّر':'Expand'}">${AS.big?'⤡':'⤢'}</button>${AS.msgs.length?`<button class="tbtn" data-as="clear" title="${ar?'محادثة جديدة':'New chat'}">↺</button>`:''}<button class="tbtn" data-as="close">✕</button></div><div class="asmsgs" id="asmsgs">${AS.msgs.length?AS.msgs.map(msg).join(''):`<p class="k" style="margin:4px 0 8px">${ar?'جرّب:':'Try:'}</p><div class="chips">${L(ASK_SUG2).map((s,i)=>`<button class="chip" data-assug2="${i}">${esc(s)}</button>`).join('')}</div>`}${AS.busy?'<div class="msg assistant" id="aslive">…</div>':''}</div><div class="ask"><textarea id="asq" rows="2" placeholder="${ar?'اسأل عن أي حاجة: درس، برومبت، وكيل، Skill…':'Ask anything: a lesson, a prompt, an agent, a Skill…'}"></textarea><button class="dlbtn" data-as="send" ${AS.busy?'disabled':''}>${ar?'اسأل':'Ask'}</button></div></div>`;
const mm=document.getElementById('asmsgs');if(mm)mm.scrollTop=mm.scrollHeight}

document.addEventListener('click',e=>{const g=s=>e.target.closest(s);let x;
if(x=g('[data-ftab]')){FTAB=x.dataset.ftab;render();return}
if(x=g('[data-assug2]')){asAsk(L(ASK_SUG2)[+x.dataset.assug2]);return}
if(x=g('[data-as="big"]')){AS.big=!AS.big;asRender();return}
if(x=g('[data-as="clear"]')){AS.msgs=[];asRender();return}
if(x=g('[data-assave]')){const p=PSTORE[+x.dataset.assave];if(p){ST.mine.unshift({t:x.dataset.asq||'Assistant prompt',d:new Date().toISOString().slice(0,10),p});saveST();x.textContent='✓';if(!ST.asSaveXP){ST.asSaveXP=1;addXP(5)}}return}},true);
{const _vq=vQuiz;vQuiz=function(n){if(String(n)==='11')n=8;return _vq(n)}}
