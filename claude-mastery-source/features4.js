// ===== FEATURES 4: spot the hallucination (#spot), prompt remix (#remix) =====
const UX11={spot:T('Spot the hallucination','اكتشف الهلوسة'),remix:T('Prompt remix','ريمكس البرومبت')};

// ---------- 7. SPOT THE HALLUCINATION ----------
// Each round: a small source table + five sentences Claude "wrote"; exactly one contradicts the table.
const SPOT=[
{id:'sales',t:T('Q3 sales by region','مبيعات الربع التالت حسب المنطقة'),cols:T(['Region','Sales (EGP M)'],['المنطقة','المبيعات (مليون جنيه)']),rows:[[T('Cairo','القاهرة'),'12.4'],[T('Alexandria','الإسكندرية'),'6.1'],[T('Delta','الدلتا'),'4.5'],[T('Upper Egypt','الصعيد'),'3.0']],
 s:T(['Total Q3 sales were EGP 26.0M.','Cairo contributed the largest share, at EGP 12.4M.','Alexandria sales were about double Upper Egypt’s.','Delta accounted for about 25% of total sales.','Upper Egypt was the smallest region.'],['إجمالي مبيعات الربع التالت 26.0 مليون جنيه.','القاهرة ليها أكبر نصيب بـ 12.4 مليون جنيه.','مبيعات الإسكندرية تقريباً ضعف الصعيد.','الدلتا كانت حوالي 25% من إجمالي المبيعات.','الصعيد كان أصغر منطقة.']),wrong:3,
 why:T('Delta is 4.5 of 26.0 = about 17%, not 25%.','الدلتا 4.5 من 26.0 = حوالي 17%، مش 25%.')},
{id:'bva',t:T('September budget vs actual','الموازنة مقابل الفعلي — سبتمبر'),cols:T(['Line','Budget (EGP k)','Actual (EGP k)'],['البند','الموازنة (ألف جنيه)','الفعلي (ألف جنيه)']),rows:[[T('Salaries','المرتبات'),'2,000','2,150'],[T('Marketing','التسويق'),'500','380'],[T('Rent','الإيجار'),'300','300'],[T('IT','تكنولوجيا المعلومات'),'400','460']],
 s:T(['Total spend was EGP 90k over budget.','Salaries were 15% over budget.','Marketing was under budget by EGP 120k.','IT overspent by EGP 60k.','Rent was exactly on budget.'],['إجمالي الصرف زاد 90 ألف جنيه عن الموازنة.','المرتبات زادت 15% عن الموازنة.','التسويق كان أقل من الموازنة بـ 120 ألف جنيه.','تكنولوجيا المعلومات زادت 60 ألف جنيه.','الإيجار كان مطابق للموازنة بالظبط.']),wrong:1,
 why:T('Salaries are 150 over 2,000 = 7.5%, not 15%.','المرتبات زادت 150 على 2,000 = 7.5%، مش 15%.')},
{id:'ar',t:T('Receivables ageing','أعمار المديونيات'),cols:T(['Bucket','Balance (EGP k)'],['الفترة','الرصيد (ألف جنيه)']),rows:[[T('Current','جاري'),'1,800'],[T('31–60 days','31–60 يوم'),'600'],[T('61–90 days','61–90 يوم'),'350'],[T('Over 90 days','أكتر من 90 يوم'),'250']],
 s:T(['Total receivables are EGP 3.0M.','60% of receivables are current.','Balances over 60 days total EGP 850k.','The 31–60 day bucket is the largest overdue bucket.','Chasing the over-90 balances first targets EGP 250k.'],['إجمالي المديونيات 3.0 مليون جنيه.','60% من المديونيات جارية.','الأرصدة اللي فوق 60 يوم إجماليها 850 ألف جنيه.','فترة 31–60 يوم هي أكبر فترة متأخرة.','لو بدأنا بالأرصدة اللي فوق 90 يوم هنستهدف 250 ألف جنيه.']),wrong:2,
 why:T('Over 60 days is 350 + 250 = 600k, not 850k.','فوق 60 يوم = 350 + 250 = 600 ألف، مش 850 ألف.')},
{id:'hr',t:T('Headcount and leavers this year','عدد الموظفين والمستقيلين السنة دي'),cols:T(['Team','Headcount','Leavers'],['الفريق','العدد','المستقيلين']),rows:[[T('Finance','المالية'),'12','1'],[T('Sales','المبيعات'),'30','6'],[T('Operations','العمليات'),'45','3'],[T('HR','الموارد البشرية'),'5','0']],
 s:T(['Sales had the highest attrition rate, at 25%.','The company has 92 employees in total.','Overall attrition was about 11%.','Operations lost 3 people, an attrition rate of about 7%.','Finance’s attrition rate (about 8%) was higher than Operations’.'],['المبيعات كان عندها أعلى معدل دوران، 25%.','الشركة فيها 92 موظف إجمالاً.','معدل الدوران الكلي حوالي 11%.','العمليات خسرت 3 أشخاص، بمعدل حوالي 7%.','معدل دوران المالية (حوالي 8%) أعلى من العمليات.']),wrong:0,
 why:T('Sales lost 6 of 30 = 20%, not 25% (it is still the highest).','المبيعات خسرت 6 من 30 = 20%، مش 25% (ولسه هي الأعلى).')},
{id:'loan',t:T('Term loan terms','شروط القرض'),cols:T(['Item','Value'],['البند','القيمة']),rows:[[T('Principal','أصل القرض'),'EGP 10M'],[T('Annual interest rate (simple)','الفايدة السنوية (بسيطة)'),'20%'],[T('Term','المدة'),T('1 year','سنة')],[T('Interest paid','سداد الفايدة'),T('Quarterly','كل ربع سنة')],[T('Principal repaid','سداد الأصل'),T('At maturity','في نهاية المدة')]],
 s:T(['Each quarterly interest payment is EGP 500k.','Total interest over the year is EGP 2M.','The principal is repaid at the end of the term.','Total cash paid to the lender over the year is EGP 12M.','The quarterly interest rate is 4%.'],['كل قسط فايدة ربع سنوي 500 ألف جنيه.','إجمالي الفايدة في السنة 2 مليون جنيه.','أصل القرض بيتسدد في نهاية المدة.','إجمالي اللي هيتدفع للبنك في السنة 12 مليون جنيه.','الفايدة كل ربع سنة 4%.']),wrong:4,
 why:T('20% a year paid quarterly is 5% a quarter, not 4%.','20% في السنة بتتدفع كل ربع = 5% في الربع، مش 4%.')}];
if(!ST.spot)ST.spot={};let SPI=0,SPP=null,SPGEN=null,SPBUSY=false;
const spCell=v=>typeof v==='string'?esc(v):esc(L(v));
function spRound(){return SPI==='gen'&&SPGEN?SPGEN:SPOT[SPI]}
function vSpot(){crumb(L(UX11.spot));const ar=LANG==='ar';const r=spRound();const done=SPOT.filter(x=>ST.spot[x.id]).length;
let h=`<h1>🔎 ${L(UX11.spot)}</h1><p class="lede">${ar?'Claude لخّص الجدول في 5 جمل، وواحدة منهم بس غلط. اضغط على الجملة اللي مش متطابقة مع البيانات.':'Claude summarised the table in five sentences, and exactly one of them is wrong. Click the sentence that does not match the data.'}</p>`;
h+=`<div class="chips">${SPOT.map((x,i)=>`<button class="chip ${SPI===i?'on':''}" data-spgo="${i}">${i+1}. ${L(x.t)}${ST.spot[x.id]?' ✓':''}</button>`).join('')}<button class="chip ${SPI==='gen'?'on':''}" data-spgen="1">✨ ${ar?'جولة جديدة من Claude':'New round from Claude'}</button></div><p class="note">${done}/${SPOT.length} ${ar?'اتحلّوا':'solved'}</p>`;
if(SPBUSY)return h+`<div class="empty">${ar?'Claude بيجهّز جولة…':'Claude is preparing a round…'}</div>`;
if(!r)return h+`<div class="empty">${ar?'اختار جولة.':'Pick a round.'}</div>`;
const cols=Array.isArray(r.cols)?r.cols:L(r.cols);const sents=Array.isArray(r.s)?r.s:L(r.s);
h+=`<div class="spgrid"><div><h3>${spCell(r.t)}</h3><div class="tablewrap"><table><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr>${r.rows.map(row=>`<tr>${row.map(c=>`<td>${spCell(c)}</td>`).join('')}</tr>`).join('')}</table></div>${SPI==='gen'?`<p class="note">${ar?'الجولة دي Claude كتبها — لو حسيت إن فيها مشكلة، راجع الحساب بنفسك.':'Claude wrote this round — if something looks off, check the maths yourself.'}</p>`:''}</div>
<div><h3>${ar?'ملخص Claude':'Claude’s summary'}</h3><ol class="spsent">${sents.map((s,i)=>{let cls='';if(SPP!=null){if(i===r.wrong)cls='right';else if(i===SPP)cls='wrong'}return `<li><button class="${cls}" data-spp="${i}" ${SPP!=null?'disabled':''}>${esc(s)}</button></li>`}).join('')}</ol>`;
if(SPP!=null)h+=`<div class="tips2 ${SPP===r.wrong?'ok':''}">${SPP===r.wrong?(ar?'✓ صح! ':'✓ Correct! '):(ar?'✗ لأ — الجملة الغلط كانت رقم '+(r.wrong+1)+'. ':'✗ Not that one — the wrong sentence was number '+(r.wrong+1)+'. ')}${spCell(r.why)}</div><div class="row-btns"><button class="tbtn" data-spretry="1">↻ ${ar?'جرّب تاني':'Try again'}</button>${typeof SPI==='number'&&SPI<SPOT.length-1?`<button class="btn-gold" data-spgo="${SPI+1}">${ar?'الجولة الجاية':'Next round'} →</button>`:''}</div>`;
h+=`</div></div><p class="note" style="margin-top:14px">${ar?'الدرس: راجع كل رقم في ملخص Claude مع المصدر — خصوصاً النسب والإجماليات. شوف ':'The lesson: check every number in a Claude summary against the source — especially percentages and totals. See '}<a href="#day/1/1.9">1.9 · ${L(T('Prompt failures clinic','عيادة أخطاء البرومبت'))}</a>.</p>`;
return h}
async function spGenerate(){const ar=LANG==='ar';const sample=await tutorSample();if(!sample){SPI=0;SPP=null;render();const n=document.querySelector('#view .note');if(n)n.textContent=ar?'الجولات الجديدة بتشتغل لما المنصة تتفتح جوه Claude (claude.ai).':'New rounds work when the platform is opened inside Claude (claude.ai).';return}
SPBUSY=true;SPI='gen';SPP=null;render();
const keys=Object.keys(DATA);const k=keys[Math.floor(Math.random()*keys.length)];const lines=DATA[k].csv.split('\n').slice(0,7).join('\n');
const ask=`Create one round of a "spot the hallucination" training game for finance and business learners. Use the CSV sample below as inspiration: build a small table of 3 to 5 rows and 2 or 3 columns with simple numbers (you may simplify or aggregate the sample). Then write exactly 5 short sentences summarising the table. Exactly ONE sentence must contain a clear numeric error (a wrong total, percentage, difference or ranking); the other four must be exactly correct — double-check every calculation. Write the title, column headers, row labels, sentences and explanation in ${ar?'Egyptian Arabic':'English'}. Reply with JSON only: {"title": string, "cols": [string], "rows": [[string]], "sentences": [5 strings], "wrong": index 0-4, "why": "one sentence with the correct calculation"}.\n\nCSV sample (${k}):\n${lines}`;
try{const j=await sample.json(ask,{modelTier:'default'});if(!j||!Array.isArray(j.sentences)||j.sentences.length!==5||!Array.isArray(j.rows)||!(j.wrong>=0&&j.wrong<5))throw new Error('shape');
SPGEN={id:'gen',t:String(j.title||''),cols:(j.cols||[]).map(String),rows:j.rows.slice(0,6).map(r=>r.map(String)),s:j.sentences.map(String),wrong:+j.wrong,why:String(j.why||'')}}
catch(e){SPGEN=null;SPI=0}SPBUSY=false;render()}

// ---------- 9. PROMPT REMIX ----------
const INDUSTRIES=[['health',T('Healthcare','الرعاية الصحية'),['health','hospital','clinic','patient','pharma','صح','مستشفى','عيادة','مريض','دوا']],['retail',T('Retail','التجزئة'),['retail','store','shop','sku','مول','تجزئة','محل','فرع']],['realestate',T('Real estate','العقارات'),['real estate','property','unit','developer','compound','عقار','وحدات','مطور','كمبوند']],['manufacturing',T('Manufacturing','التصنيع'),['manufactur','factory','plant','production','مصنع','تصنيع','إنتاج']],['logistics',T('Logistics','اللوجستيات'),['logistic','shipping','fleet','warehouse','delivery','شحن','مخزن','أسطول','توصيل','لوجست']],['tourism',T('Hospitality & tourism','الضيافة والسياحة'),['hotel','tourism','hospitality','guest','booking','فندق','سياح','نزلاء','حجز','ضيافة']],['education',T('Education','التعليم'),['school','university','student','education','course','مدرسة','جامعة','طالب','طلاب','تعليم']],['telecom',T('Telecom','الاتصالات'),['telecom','subscriber','network','mobile','اتصالات','مشترك','شبكة']],['construction',T('Construction','المقاولات'),['construction','contractor','site','project','مقاول','موقع','إنشاء']],['agri',T('Agriculture & food','الزراعة والأغذية'),['agri','farm','crop','food','زراع','مزرعة','محاصيل','أغذية']],['ngo',T('NGOs & non-profits','الجمعيات والمنظمات غير الربحية'),['ngo','non-profit','donor','grant','beneficiar','جمعية','متبرع','منحة','مستفيد']]];
if(!ST.remix)ST.remix={};
let RM=Object.assign({ci:0,ind:'health',txt:'',fb:'',busy:false},ST.rm||{});
const rmCase=()=>LAB[RM.ci%LAB.length];
const rmTokens=s=>new Set(String(s).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>2));
function rmSim(a,b){const A=rmTokens(a),B=rmTokens(b);if(!A.size||!B.size)return 1;let i=0;A.forEach(w=>{if(B.has(w))i++});return i/Math.max(A.size,B.size)}
function rmChecks(){const c=rmCase();const orig=L(c.p);const ind=INDUSTRIES.find(x=>x[0]===RM.ind);const t=RM.txt.toLowerCase();
const score=pkScore(RM.txt);const sim=rmSim(RM.txt,orig);const mentions=ind[2].some(k=>t.includes(k.toLowerCase()));
return {score,sim,mentions,ok:score>=70&&sim<0.8&&mentions}}
function saveRM(){const {busy,...rest}=RM;ST.rm=rest;saveST()}
function vRemix(){crumb(L(UX11.remix));const ar=LANG==='ar';const c=rmCase();const ind=INDUSTRIES.find(x=>x[0]===RM.ind);if(!RM.txt)RM.txt=L(c.p);const k=rmChecks();const key=RM.ci+':'+RM.ind;
let h=`<h1>🎚 ${L(UX11.remix)}</h1><p class="lede">${ar?'خد برومبت من المعمل وكيّفه لصناعة تانية. لازم الدرجة توصل 70، والبرومبت يتغير بشكل حقيقي، ويتكلم بلغة الصناعة الجديدة.':'Take a lab prompt and adapt it to another industry. It must score 70+, change for real, and speak the new industry’s language.'}</p>`;
h+=`<div class="cfil" style="grid-template-columns:2fr 1fr auto"><select id="rmcase">${LAB.map((x,i)=>`<option value="${i}" ${i===RM.ci%LAB.length?'selected':''}>${esc(L(x.field))} · ${esc(L(x.t))}</option>`).join('')}</select><select id="rmind">${INDUSTRIES.map(x=>`<option value="${x[0]}" ${x[0]===RM.ind?'selected':''}>${L(x[1])}</option>`).join('')}</select><button class="tbtn" data-rm="random">🎲 ${ar?'عشوائي':'Shuffle'}</button></div>`;
h+=`<div class="rmbrief"><b>${ar?'المهمة':'Challenge'}:</b> ${ar?`حوّل «${esc(L(c.t))}» (${esc(L(c.field))}) لـ`:`Turn “${esc(L(c.t))}” (${esc(L(c.field))}) into a prompt for`} <b>${L(ind[1])}</b>.${ST.remix[key]?` <span class="pkscore hi">✓ ${ST.remix[key]}</span>`:''}</div>`;
h+=`<details class="case"><summary><h3>${ar?'البرومبت الأصلي':'Original prompt'}</h3></summary><pre class="testout" dir="auto">${esc(L(c.p))}</pre></details>`;
h+=`<div class="rxrow"><textarea class="search" id="rmtxt" rows="16" dir="auto">${esc(RM.txt)}</textarea><div class="rxscore"><div id="rmring">${ring(k.score)}</div><ul class="lint" id="rmlint">${rmLint(k)}</ul></div></div>`;
h+=`<div class="row-btns"><button class="btn-gold" data-rm="submit">✓ ${ar?'سلّم':'Submit'}</button><button class="tbtn" data-rm="review" ${RM.busy?'disabled':''}>💬 ${ar?'اطلب رأي Claude':'Ask Claude to review'}</button><button class="tbtn" data-rm="reset">↺ ${ar?'ارجع للأصلي':'Reset to original'}</button><button class="tbtn" data-rm="pack">📦 ${ar?'أضف للحزمة':'Add to pack'}</button></div><p class="note" id="rmnote"></p>`;
if(RM.busy)h+=`<div class="elmbox">${ar?'Claude بيراجع…':'Claude is reviewing…'}</div>`;else if(RM.fb)h+=`<div class="elmbox">${fmtMD(RM.fb)}</div>`;
return h}
function rmLint(k){const ar=LANG==='ar';const li=(ok,t)=>`<li class="${ok?'ok':'no'}">${ok?'✓':'✗'} ${t}</li>`;
return li(k.score>=70,(ar?'الدرجة ':'Score ')+k.score+' / 70')+li(k.sim<0.8,(ar?'اتغير ':'Changed ')+Math.round((1-k.sim)*100)+'%')+li(k.mentions,ar?'لغة الصناعة الجديدة':'Uses the new industry’s terms')}
async function rmReview(){const ar=LANG==='ar';const sample=await tutorSample();const n=document.getElementById('rmnote');if(!sample){if(n)n.textContent=ar?'المراجعة بتشتغل لما المنصة تتفتح جوه Claude (claude.ai).':'Review works when the platform is opened inside Claude (claude.ai).';return}
const c=rmCase();const ind=INDUSTRIES.find(x=>x[0]===RM.ind);RM.busy=true;render();
const ask=`A learner adapted a master prompt from ${c.field.en} to the ${ind[1].en} industry. Review the adaptation in ${ar?'Egyptian Arabic (keep technical terms in English)':'English'}, under 120 words, as exactly three labelled lines: "What works", "What is still generic or wrong for ${ind[1].en}", "One change to make next". Judge industry realism (terms, KPIs, regulations, data) and whether the six blocks still hold.\n\nORIGINAL:\n${L(c.p).slice(0,3000)}\n\nADAPTED:\n${RM.txt.slice(0,4000)}`;
try{const {text}=await sample(ask,{modelTier:'quick'});RM.fb=text}catch(e){RM.fb=e&&e.code==='rate_limited'?(ar?'طلبات كتير — جرّب بعد شوية.':'Too many requests — try again in a moment.'):(ar?'مقدرتش أراجع دلوقتي.':'Could not review right now.')}
RM.busy=false;saveRM();render()}

// ---------- events ----------
document.addEventListener('click',e=>{const g=s=>e.target.closest(s);let x;
if(x=g('[data-spgo]')){SPI=+x.dataset.spgo;SPP=null;render();return}
if(x=g('[data-spgen]')){if(!SPBUSY)spGenerate();return}
if(x=g('[data-spretry]')){SPP=null;render();return}
if(x=g('[data-spp]')){const r=spRound();SPP=+x.dataset.spp;if(SPP===r.wrong&&r.id!=='gen'&&!ST.spot[r.id]){ST.spot[r.id]=1;saveST();addXP(10)}else if(SPP===r.wrong&&r.id==='gen')addXP(5);render();return}
if(x=g('[data-rm]')){const a=x.dataset.rm;const ar=LANG==='ar';
if(a==='random'){RM.ci=Math.floor(Math.random()*LAB.length);let i;do{i=INDUSTRIES[Math.floor(Math.random()*INDUSTRIES.length)][0]}while(i===RM.ind&&INDUSTRIES.length>1);RM.ind=i;RM.txt='';RM.fb='';saveRM();render();return}
if(a==='reset'){RM.txt='';RM.fb='';saveRM();render();return}
if(a==='review'){if(!RM.busy)rmReview();return}
if(a==='pack'){const ind=INDUSTRIES.find(y=>y[0]===RM.ind);pkAdd(`${L(rmCase().t)} → ${L(ind[1])}`,RM.txt);return}
if(a==='submit'){const k=rmChecks();const n=document.getElementById('rmnote');const key=RM.ci%LAB.length+':'+RM.ind;
if(k.ok){const first=!ST.remix[key];ST.remix[key]=Math.max(ST.remix[key]||0,k.score);if(first){addXP(15);ST.mine.unshift({t:`${L(rmCase().t)} → ${L(INDUSTRIES.find(y=>y[0]===RM.ind)[1])}`,d:new Date().toISOString().slice(0,10),p:RM.txt})}saveST();render();const m=document.getElementById('rmnote');if(m)m.textContent=ar?'برافو! الريمكس اتحفظ في برومبتاتي.':'Well done! The remix was saved to My prompts.'}
else if(n)n.textContent=ar?'لسه — بص على العلامات الحمرا جنب الدرجة.':'Not yet — check the red items next to the score.';return}}});
document.addEventListener('input',e=>{const t=e.target;if(t.id==='rmtxt'){RM.txt=t.value;const k=rmChecks();const r=document.getElementById('rmring');if(r)r.innerHTML=ring(k.score);const l=document.getElementById('rmlint');if(l)l.innerHTML=rmLint(k);clearTimeout(window._rmT);window._rmT=setTimeout(saveRM,600)}});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='rmcase'){RM.ci=+t.value;RM.txt='';RM.fb='';saveRM();render()}if(t.id==='rmind'){RM.ind=t.value;RM.fb='';saveRM();render()}});
