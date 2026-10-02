// ===== FEATURES 5: merged pages (studio game/remix, path+picker, simulators+wall, references+community), email alerts, output checklists =====
UX10.rescue=T('Prompt rescue game','لعبة إنقاذ البرومبت');
const UX12={sims:T('Simulators & showcase','المحاكيات وحائط الأعمال'),agentsim:T('Agent loop','حلقة الوكيل'),alerts:T('Email alerts','تنبيهات بالإيميل'),pathpick:T('Learning path & feature picker','مسار التعلم واختيار الأداة')};

// ---------- Studio: + game, + remix tabs ----------
{const _tabs=vStudioTabs;vStudioTabs=function(){const ar=LANG==='ar';return _tabs().replace(/<\/div>$/,`<button class="tab ${stuTab==='game'?'on':''}" data-stutab="game">🛟 ${L(UX10.rescue)}</button><button class="tab ${stuTab==='remix'?'on':''}" data-stutab="remix">🎚 ${L(UX11.remix)}</button></div>`)}}
{const _vs=vStudio;vStudio=function(){if(stuTab!=='game'&&stuTab!=='remix')return _vs();const strip=h=>h.replace(/^<h1>[\s\S]*?<\/h1>/,'');const body=stuTab==='game'?strip(vRescue()):strip(vRemix());crumb(L(UX3.studio)+' › '+(stuTab==='game'?L(UX10.rescue):L(UX11.remix)));return `<h1>🎛 ${L(UX3.studio)}</h1>`+vStudioTabs()+body}}

// ---------- Learning path + feature picker ----------
var PTAB='path';
{const _vp=vPath;vPath=function(){const ar=LANG==='ar';const tabs=`<div class="tabs big"><button class="tab ${PTAB==='path'?'on':''}" data-ptab="path">🧭 ${L(UX2.path)}</button><button class="tab ${PTAB==='pick'?'on':''}" data-ptab="pick">🎯 ${L(UX2.pick)}</button></div>`;
const body=PTAB==='pick'?vPick():_vp();crumb(PTAB==='pick'?L(UX2.pick):L(UX2.path));return `<h1>🧭 ${L(UX12.pathpick)}</h1>`+tabs+body.replace(/^<h1>[\s\S]*?<\/h1>/,'')}}

// ---------- Simulators: agent loop + case simulator + showcase wall ----------
var SIMTAB='agent';
function wallVisible(){const h=location.hash;return h.startsWith('#showcase')||(h.startsWith('#sim')&&SIMTAB==='wall')}
{const _vsim=vSim;vSim=function(){const ar=LANG==='ar';const tabs=`<div class="tabs big"><button class="tab ${SIMTAB==='agent'?'on':''}" data-simtab="agent">🔄 ${L(UX12.agentsim)}</button><button class="tab ${SIMTAB==='case'?'on':''}" data-simtab="case">🧭 ${L(UX6.csim)}</button><button class="tab ${SIMTAB==='wall'?'on':''}" data-simtab="wall">🖼 ${L(UX10.wall)}</button></div>`;
const body=SIMTAB==='case'?vCsim():SIMTAB==='wall'?vShowcase():_vsim();return `<h1>🔄 ${L(UX12.sims)}</h1>`+tabs+body.replace(/^<h1>[\s\S]*?<\/h1>/,'')}}

// ---------- References + community (one page) with email alerts ----------
let ALR={state:'init',doc:null,email:'',topics:['events','lessons'],msg:'',subs:null,tpl:'events',subj:'',body:''};
const ALTOPICS=[['events',T('Community events','فعاليات المجتمع')],['lessons',T('New lessons and tools','دروس وأدوات جديدة')],['challenge',T('Weekly challenge','تحدي الأسبوع')],['wall',T('Showcase highlights','أبرز أعمال الحائط')]];
const ALTPL={events:[T('New Claude community event','فعالية جديدة لمجتمع Claude'),T('Hello,\n\nA new Claude community event is coming up:\n\n• Event: [name]\n• Date: [date]\n• Where: [city / online]\n• Link: [https://…]\n\nSee you there,\nDr. Sara Salem — Claude Mastery','أهلاً،\n\nفيه فعالية جديدة لمجتمع Claude:\n\n• الفعالية: [الاسم]\n• التاريخ: [التاريخ]\n• المكان: [المدينة / أونلاين]\n• اللينك: [https://…]\n\nنشوفكم هناك،\nد. سارة سالم — Claude Mastery')],
lessons:[T('New on Claude Mastery','جديد على Claude Mastery'),T('Hello,\n\nNew on the platform this week:\n\n• [lesson or tool]\n• [lesson or tool]\n\nOpen the platform: '+PLATFORM_URL+'\n\nDr. Sara Salem','أهلاً،\n\nالجديد على المنصة الأسبوع ده:\n\n• [درس أو أداة]\n• [درس أو أداة]\n\nافتح المنصة: '+PLATFORM_URL+'\n\nد. سارة سالم')],
challenge:[T('This week’s Claude challenge','تحدي Claude الأسبوع ده'),T('Hello,\n\nThis week’s challenge: [describe the task in one line].\n\nPost your result on the Showcase wall by [day].\n\n'+PLATFORM_URL+'\n\nDr. Sara Salem','أهلاً،\n\nتحدي الأسبوع: [اوصف المهمة في سطر].\n\nانشر نتيجتك على حائط الأعمال قبل [اليوم].\n\n'+PLATFORM_URL+'\n\nد. سارة سالم')],
wall:[T('Showcase highlights','أبرز أعمال الحائط'),T('Hello,\n\nThree builds worth a look on the Showcase wall:\n\n1. [title] — [one line]\n2. [title] — [one line]\n3. [title] — [one line]\n\n'+PLATFORM_URL+'\n\nDr. Sara Salem','أهلاً،\n\nتلات أعمال تستاهل تشوفها على حائط الأعمال:\n\n1. [العنوان] — [سطر]\n2. [العنوان] — [سطر]\n3. [العنوان] — [سطر]\n\n'+PLATFORM_URL+'\n\nد. سارة سالم')]};
async function alrInit(){if(ALR.state!=='init')return;ALR.state='loading';await wallInit().catch(()=>{});
if(!WALL.db||!WALL.me){ALR.state='off';rerenderRefs();return}
try{const d=await WALL.db.doc('alerts/'+WALL.me).get();ALR.doc=d.exists?d.data():null}catch(e){ALR.doc=null}
ALR.email=(ALR.doc&&ALR.doc.email)||(ST.profile&&ST.profile.email)||'';if(ALR.doc&&Array.isArray(ALR.doc.topics))ALR.topics=ALR.doc.topics.slice();ALR.state='ready';rerenderRefs()}
function rerenderRefs(){if(location.hash.startsWith('#gallery')||location.hash.startsWith('#community'))render()}
function alertsSection(){const ar=LANG==='ar';alrInit();
let h=`<h2>✉ ${L(UX12.alerts)}</h2><div class="twocol"><div class="abpane"><h3>${ar?'اشترك في التنبيهات':'Get alerts by email'}</h3>`;
if(ALR.state==='off')h+=`<p class="note">${ar?'التنبيهات بتشتغل لما المنصة تتفتح جوه Claude وإنت مسجّل دخول.':'Alerts work when the platform is opened inside Claude while you are signed in.'}</p>`;
else if(ALR.state!=='ready')h+=`<p class="k">${ar?'بيحمّل…':'Loading…'}</p>`;
else{h+=`<p>${ar?'المدرّبة هتبعتلك إيميل لما يكون فيه جديد في المواضيع اللي تختارها. إيميلك بيظهر للمدرّبة بس.':'Your instructor will email you when there is something new on the topics you choose. Only the instructor can see your email.'}</p>
<label class="pbf"><b>${ar?'الإيميل':'Email'}</b><input class="search" id="alremail" type="email" dir="ltr" value="${esc(ALR.email)}" placeholder="name@company.com"></label>
<div class="alrtopics">${ALTOPICS.map(t=>`<label class="opt"><input type="checkbox" data-alrt="${t[0]}" ${ALR.topics.includes(t[0])?'checked':''}> ${L(t[1])}</label>`).join('')}</div>
<div class="row-btns"><button class="btn-gold" data-alr="save">${ALR.doc?(ar?'حدّث الاشتراك':'Update subscription'):(ar?'اشترك':'Subscribe')}</button>${ALR.doc?`<button class="tbtn" data-alr="off">${ar?'إلغاء الاشتراك':'Unsubscribe'}</button>`:''}</div><p class="note" id="alrnote">${esc(ALR.msg)||(ALR.doc?(ar?'إنت مشترك.':'You are subscribed.'):'')}</p>`}
h+=`</div>`;
if(WALL.owner&&ALR.state==='ready'){const tp=ALTPL[ALR.tpl];if(!ALR.subj){ALR.subj=L(tp[0]);ALR.body=L(tp[1])}
const list=(ALR.subs||[]).filter(s=>(s.topics||[]).includes(ALR.tpl));const bcc=list.map(s=>s.email).join(',');
h+=`<div class="abpane"><h3>📣 ${ar?'ابعت تنبيه (للمدرّبة)':'Send an alert (instructor)'}</h3>${ALR.subs?`<p class="note">${ALR.subs.length} ${ar?'مشترك':'subscribers'} · ${list.length} ${ar?'للموضوع ده':'for this topic'}</p>`:`<button class="tbtn" data-alr="load">${ar?'حمّل المشتركين':'Load subscribers'}</button>`}
<label class="pbf"><b>${ar?'نوع التنبيه':'Alert type'}</b><select id="alrtpl">${ALTOPICS.map(t=>`<option value="${t[0]}" ${ALR.tpl===t[0]?'selected':''}>${L(t[1])}</option>`).join('')}</select></label>
<label class="pbf"><b>${ar?'العنوان':'Subject'}</b><input class="search" id="alrsubj" value="${esc(ALR.subj)}"></label><label class="pbf"><b>${ar?'الرسالة':'Message'}</b><textarea class="search" id="alrbody" rows="8" dir="auto">${esc(ALR.body)}</textarea></label>
${ALR.subs?`<div class="row-btns"><a class="btn-gold" href="https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(bcc)}&su=${encodeURIComponent(ALR.subj)}&body=${encodeURIComponent(ALR.body.slice(0,1800))}" target="_blank" rel="noopener">✉ ${ar?'افتح في Gmail':'Open in Gmail'}</a><a class="tbtn" href="mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(ALR.subj)}&body=${encodeURIComponent(ALR.body.slice(0,1800))}" target="_blank" rel="noopener">✉ ${ar?'برنامج الإيميل':'Email app'}</a><button class="tbtn" data-alr="copy">⧉ ${ar?'انسخ الإيميلات':'Copy addresses'}</button></div><p class="note">${ar?'المستلمين في BCC علشان محدش يشوف إيميل التاني. لو اللينك ما فتحش، انسخ الإيميلات والرسالة.':'Recipients go in BCC so nobody sees the others. If a link does not open, copy the addresses and the message.'}</p>`:''}</div>`}
return h+`</div>`}
async function alrSave(off){const ar=LANG==='ar';const say=t=>{ALR.msg=t;const n=document.getElementById('alrnote');if(n)n.textContent=t};
try{const ref=WALL.db.doc('alerts/'+WALL.me);if(off){await ref.delete();ALR.doc=null;say(ar?'اتلغى الاشتراك.':'Unsubscribed.');render();return}
const em=(document.getElementById('alremail')||{}).value||ALR.email;if(!/^\S+@\S+\.\S+$/.test(em.trim())){say(ar?'اكتب إيميل صحيح.':'Enter a valid email.');return}if(!ALR.topics.length){say(ar?'اختار موضوع واحد على الأقل.':'Pick at least one topic.');return}
const doc={email:em.trim().slice(0,200),topics:ALR.topics.slice(),lang:LANG,name:(ST.profile&&ST.profile.name)||ST.name||'',at:new Date().toISOString()};await ref.set(doc);ALR.doc=doc;ALR.email=doc.email;say(ar?'تمام — هيوصلك إيميل لما يكون فيه جديد.':'Done — you will get an email when there is something new.');render()}
catch(e){say(e&&e.code==='invalid_argument'?(ar?'صلاحيتك على المنصة مشاهدة بس.':'You have view-only access.'):(ar?'مقدرتش أحفظ. جرّب تاني.':'Could not save. Try again.'))}}
async function alrLoad(){try{const s=await WALL.db.collection('alerts').get();ALR.subs=s.docs.filter(d=>d.exists).map(d=>d.data())}catch(e){ALR.subs=[]}render()}

const _commHub=vCommunity;
function vGallery(){crumb(L(UI.gallery));if(location.hash.slice(1).includes('/')||location.hash.startsWith('#community'))history.replaceState(null,'','#gallery');const ar=LANG==='ar';
let hub=_commHub();const a=hub.indexOf('</section>');if(a>0)hub=hub.slice(a+10);const b=hub.indexOf('<h2>🔗');if(b>0)hub=hub.slice(0,b);crumb(L(UI.gallery));
let h=`<h1>▣ ${L(UI.gallery)}</h1><p class="lede">${ar?'مجتمع Anthropic و Claude الرسمي في مكان واحد: شارك في المجتمع، اعرف الفعاليات، اشترك في التنبيهات، وتحتها المصادر الرسمية للتعلم والتوثيق.':'The official Anthropic & Claude community in one place: get involved, find events, subscribe to alerts — followed by official learning and documentation sources.'}</p>`;
h+=`<h2>${L(UX9.comm)}</h2>`+commCards(true)+hub+alertsSection();
h+=`<h2>${ar?'المصادر الرسمية':'Official sources'}</h2><div class="grid">`+REFS.map(g=>`<div class="card" style="padding:0"><h3 style="padding:12px 12px 4px">${L(g.g)}</h3><div class="reflist">${g.items.map(i=>`<a href="${i[1]}" target="_blank" rel="noopener">${i[0]} ↗</a>`).join('')}</div></div>`).join('')+`</div><p class="note" style="margin-top:14px">${ar?'المصادر الرسمية متراجعة آخر سبتمبر 2026؛ روابط المجتمع متراجعة '+fmtDate(COMM_CHECKED)+'.':'Official sources checked end of September 2026; community links checked '+fmtDate(COMM_CHECKED)+'.'}</p>`;
return h}

// ---------- 5. "Check the output" checklist under every master prompt ----------
function stopItems(text){const m=String(text).match(/<stop_when>([\s\S]*?)<\/stop_when>/);if(!m)return [];return m[1].split('\n').map(s=>s.replace(/^\s*[-•*]\s*/,'').trim()).filter(Boolean)}
{const _pb=promptBox;promptBox=function(p,extra){const h=_pb(p,extra);if(PRINT)return h;const items=stopItems(L(p.p));if(!items.length)return h;const ar=LANG==='ar';
const extraChecks=ar?['كل رقم متطابق مع المصدر','الافتراضات متعلّمة','اللي محتاج مراجعة بشرية متعلّم']:['Every number matches the source','Assumptions are labelled','Items needing human review are flagged'];
const box=`<details class="chk"><summary>✓ ${ar?'راجع المخرج':'Check the output'} (${items.length+extraChecks.length})</summary><ul>${items.concat(extraChecks).map(t=>`<li><label><input type="checkbox"> <span dir="auto">${esc(t)}</span></label></li>`).join('')}</ul></details>`;
return h.replace(/<\/div>$/,box+'</div>')}}

// ---------- events ----------
document.addEventListener('click',e=>{const g=s=>e.target.closest(s);let x;
if(x=g('[data-ptab]')){PTAB=x.dataset.ptab;render();return}
if(x=g('[data-simtab]')){SIMTAB=x.dataset.simtab;render();return}
if(x=g('[data-alr]')){const a=x.dataset.alr;if(a==='save')alrSave(false);if(a==='off')alrSave(true);if(a==='load')alrLoad();
if(a==='copy'){const list=(ALR.subs||[]).filter(s=>(s.topics||[]).includes(ALR.tpl)).map(s=>s.email).join(', ');(navigator.clipboard?navigator.clipboard.writeText(list):Promise.reject()).then(()=>{x.textContent='✓'},()=>{x.textContent=LANG==='ar'?'مقدرتش أنسخ':'Copy failed'})}return}});
document.addEventListener('change',e=>{const t=e.target;
if(t.dataset&&t.dataset.alrt){const k=t.dataset.alrt;ALR.topics=t.checked?[...new Set([...ALR.topics,k])]:ALR.topics.filter(y=>y!==k)}
if(t.id==='alrtpl'){ALR.tpl=t.value;ALR.subj='';ALR.body='';render()}});
document.addEventListener('input',e=>{const t=e.target;if(t.id==='alremail')ALR.email=t.value;if(t.id==='alrsubj')ALR.subj=t.value;if(t.id==='alrbody')ALR.body=t.value});
