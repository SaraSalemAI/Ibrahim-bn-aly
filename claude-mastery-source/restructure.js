// ---------- Round 10: curriculum restructure ----------
// 8 → 1 (1.10, 1.11) · 14 → 5 (5.5–5.8) · 15 → 9 (9.7, 9.8; 15.3 into 9.4, 15.4 into 9.6) · 16 → 8 · 12 & 13 → field courses (audit, banking) + use-case library
const IDMAP={'8.1':'1.10','8.2':'1.11','14.1':'5.5','14.2':'5.6','14.3':'5.7','14.4':'5.8','15.1':'9.7','15.2':'9.8','15.3':'9.4','15.4':'9.6','16.1':'8.1','16.2':'8.2','16.3':'8.3','16.4':'8.4'};
const FIELDMODS={};
(function(){const D=n=>DAYS.find(d=>d.n===n);const d1=D(1),d5=D(5),d8=D(8),d9=D(9),d12=D(12),d13=D(13),d14=D(14),d15=D(15),d16=D(16);if(!d16)return;
[FEAT,CEO].forEach(M=>{const snap=Object.assign({},M);Object.entries(IDMAP).forEach(([o,n])=>{if(snap[o]!==undefined&&!['15.3','15.4'].includes(o))M[n]=snap[o]});Object.keys(IDMAP).forEach(o=>{if(!Object.values(IDMAP).includes(o))delete M[o]})});
const mv=(u,id)=>{u.id=id;return u};
d8.units.forEach(u=>d1.units.push(mv(u,IDMAP[u.id])));
d14.units.forEach(u=>d5.units.push(mv(u,IDMAP[u.id])));
const merge=(into,u)=>{const t=into;['en','ar'].forEach(l=>{t.body[l]+=`<hr><h3>${l==='en'?'Going further':'تعمّق أكتر'}: ${u.t[l]}</h3>`+u.body[l]});t.prompts=(t.prompts||[]).concat(u.prompts||[]);t.cases=(t.cases||[]).concat(u.cases||[]);if(u.tips)['en','ar'].forEach(l=>{t.tips=t.tips||T([],[]);t.tips[l]=(t.tips[l]||[]).concat(u.tips[l]||[])});t.dur=String((+t.dur||0)+Math.round((+u.dur||0)/2))};
d15.units.forEach(u=>{const id=IDMAP[u.id];const ex=d9.units.find(x=>x.id===id);if(ex)merge(ex,u);else d9.units.push(mv(u,id))});
d16.n=8;d16.units.forEach(u=>mv(u,IDMAP[u.id]));
const q8=QUIZ[8]||[];QUIZ[1]=(QUIZ[1]||[]).concat(q8);QUIZ[5]=(QUIZ[5]||[]).concat(QUIZ[14]||[]);QUIZ[9]=(QUIZ[9]||[]).concat(QUIZ[15]||[]);QUIZ[8]=QUIZ[16]||[];
FIELDMODS.audit={m:d12,quiz:QUIZ[12]||[],proj:PROJECTS.find(p=>p.n===12)};FIELDMODS.banking={m:d13,quiz:QUIZ[13]||[],proj:PROJECTS.find(p=>p.n===13)};
[12,13,14,15,16].forEach(n=>delete QUIZ[n]);
for(let i=PROJECTS.length-1;i>=0;i--){const p=PROJECTS[i];if([8,12,13,14,15].includes(p.n))PROJECTS.splice(i,1);else if(p.n===16)p.n=8}
[d8,d12,d13,d14,d15].forEach(d=>DAYS.splice(DAYS.indexOf(d),1));DAYS.sort((a,b)=>a.n-b.n);
// use-case library: field lessons' master prompts
const add=(gk,fm,tool)=>{const g=CASES.find(x=>x.k===gk);if(!g)return;fm.m.units.forEach(u=>(u.prompts||[]).forEach(p=>g.items.push({t:T(p.t.en.replace(/^Master prompt — /,''),p.t.ar.replace(/^البرومبت الماستر — /,'')),tool,d:T(u.t.en,u.t.ar),steps:T(u.steps.en.slice(0,3),u.steps.ar.slice(0,3)),p:p.p,master:true})))};
add('risk',FIELDMODS.audit,'Chat · Excel · Project');add('banking',FIELDMODS.banking,'Chat · Excel · Project')})();
let FCQ={};
function fieldCourse(k){const F=FIELDMODS[k];if(!F)return '';const ar=LANG==='ar';const m=F.m;const open=ST.fco||{};
const fd=(ST.fcd||{})[k]||[];let h=`<section class="fcourse"><h2>${m.icon} ${ar?'كورس المجال':'Field course'}: ${esc(L(m.t))} <span class="pkscore ${fd.length===m.units.length?'hi':'mid'}">${fd.length}/${m.units.length}</span></h2><p class="k">${esc(L(m.sub||T('','')))}</p>`;
h+=m.units.map((u,i)=>{const isO=open[k]===i;return `<div class="fdag ${isO?'open':''}"><button class="fdhead" data-fco="${k}|${i}"><span class="fdi">${i+1}</span><span class="fdt"><b>${esc(L(u.t))}</b><span class="k">${u.dur} ${L(UI.min)} · ${(u.prompts||[]).length} ${ar?'برومبت ماستر':'master prompts'}</span></span>${fd.includes(i)?'<span class="fdok">✓</span>':''}<span class="fdchev">${isO?'▾':'▸'}</span></button>${isO?`<div class="fdbody"><div class="lessonbody">${L(u.body)}</div>${u.steps?`<h4>${ar?'الخطوات':'Steps'}</h4><ol>${L(u.steps).map(s=>`<li>${s}</li>`).join('')}</ol>`:''}${u.tips?`<h4>💡 ${ar?'نصايح':'Tips'}</h4><ul>${L(u.tips).map(s=>`<li>${s}</li>`).join('')}</ul>`:''}${(u.cases||[]).map(c=>`<div class="ceobox"><b>${esc(L(c.t))}</b> — ${esc(L(c.d))}</div>`).join('')}${(u.prompts||[]).map(p=>promptBox(p)).join('')}<div class="row-btns"><button class="${fd.includes(i)?'tbtn':'btn-gold'}" data-fcd="${k}|${i}">${fd.includes(i)?(ar?'✓ خلصته':'✓ Done'):(ar?'علّم الدرس إنه خلص':'Mark lesson as done')}</button></div></div>`:''}</div>`}).join('');
if(F.quiz.length){h+=`<h3>🧠 ${ar?'اختبر نفسك':'Quick quiz'}</h3><div class="fcq">${F.quiz.map((q,i)=>{const a=FCQ[k+i];return `<div class="fcqq"><b>${i+1}. ${esc(L(q.q))}</b><div class="chips">${q.o.map((o,j)=>`<button class="chip ${a!==undefined?(j===q.a?'ok':j===a?'no':''):''}" data-fcq="${k}|${i}|${j}" ${a!==undefined?'disabled':''}>${esc(L(o))}</button>`).join('')}</div>${a!==undefined?`<p class="k">${a===q.a?'✓':'✗'} ${esc(L(q.e))}</p>`:''}</div>`}).join('')}</div>`}
if(F.proj){const p=F.proj;h+=`<h3>🛠 ${ar?'مشروع المجال':'Field project'}: ${esc(L(p.t))}</h3><p>${esc(L(p.brief))}</p><p><b>${ar?'المطلوب':'Deliverable'}:</b> ${esc(L(p.deliv))}</p><ul>${p.rub.map(c=>`<li>${esc(L(c.t))}</li>`).join('')}</ul>`}
return h+`</section>`}
{const _vf=vFields;vFields=function(){const h=_vf();const k=typeof FLK!=='undefined'?FLK:'';return FIELDMODS[k]?h.replace(/(<\/h1>[\s\S]*?<\/p>)/,`$1<button class="card fdbanner" data-fcjump="1"><b>📚 ${LANG==='ar'?'كورس كامل للمجال ده جوه الصفحة':'A full field course is on this page'}</b><span class="k">${esc(L(FIELDMODS[k].m.t))} · ${FIELDMODS[k].m.units.length} ${LANG==='ar'?'دروس':'lessons'}</span></button>`)+fieldCourse(k):h}}
{const _bi=buildIdx;buildIdx=function(){_bi();Object.entries(FIELDMODS).forEach(([k,F])=>F.m.units.forEach(u=>IDX.push({t:u.t,txt:(u.t.en+' '+u.t.ar+' '+strip(u.body.en)).toLowerCase(),r:'fields/'+k,k:T('Field course','كورس المجال'),snip:strip(u.body.en).slice(0,200)})))}}
document.addEventListener('click',e=>{const g=s=>e.target.closest(s);let x;
if(x=g('[data-fco]')){const [k,i]=x.dataset.fco.split('|');ST.fco=Object.assign({},ST.fco);ST.fco[k]=ST.fco[k]===+i?-1:+i;saveST();render();return}
if(x=g('[data-fcq]')){const [k,i,j]=x.dataset.fcq.split('|');FCQ[k+i]=+j;const q=FIELDMODS[k].quiz[+i];if(+j===q.a){ST.fcqXP=Object.assign({},ST.fcqXP);if(!ST.fcqXP[k+i]){ST.fcqXP[k+i]=1;addXP(2);saveST()}}render();return}
if(x=g('[data-fcd]')){const [k,i]=x.dataset.fcd.split('|');ST.fcd=Object.assign({},ST.fcd);const a=(ST.fcd[k]||[]).slice();const n=+i;if(a.includes(n))a.splice(a.indexOf(n),1);else{a.push(n);ST.fcdXP=Object.assign({},ST.fcdXP);if(!ST.fcdXP[k+n]){ST.fcdXP[k+n]=1;addXP(5)}}ST.fcd[k]=a;saveST();render();return}
if(x=g('[data-fcjump]')){const s=document.querySelector('.fcourse');if(s)s.scrollIntoView({behavior:'smooth'});return}});
