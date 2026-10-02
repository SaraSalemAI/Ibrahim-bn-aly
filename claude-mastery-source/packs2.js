// ===== PROMPT PACKS 2: basket, filtered exports, starter packs, import preview, metadata, MD/PDF, scoring =====
// Lives inside the Lab & Studio as the "Prompt packs" tab (labTab==='packs').
if(!ST.basket)ST.basket=[];
let PKM=Object.assign({name:'My prompt pack',desc:'',tags:'',version:'1.0',lang:'cur',fmt:'json'},ST.packMeta||{});
if(ST.packName&&!ST.packMeta)PKM.name=ST.packName;
let PKIMP=null; // pending import preview
let PKS=[];      // prompt cards on screen -> {t,p} (bilingual) for "add to pack"
const pkNorm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
const pkTxt=(v,l)=>v==null?'':typeof v==='string'?v:(v[l]||v.en||'');
function savePKM(){ST.packMeta=PKM;ST.packName=PKM.name;saveST()}

// --- score any prompt text with the studio's checker ---
function pkScore(text){text=String(text||'');const tag=k=>{const m=text.match(new RegExp(`<${k}>([\\s\\S]*?)</${k}>`));return m?m[1].trim():''};
const hasXml=/<role>|<task>|<context>/.test(text);const keep=SU;
const tech=[];if(hasXml)tech.push('xml');if(/clarifying|ask (up to|me|first)|اسأل|أسئلة توضيحية/i.test(text))tech.push('ask');if(/check every number|verify|راجع (كل )?(رقم|الأرقام)/i.test(text))tech.push('verify');if(/step[- ]by[- ]step|خطوة بخطوة/i.test(text))tech.push('cot');if(/human review|مراجعة بشرية/i.test(text))tech.push('human');
SU=Object.assign({},keep,hasXml?{goal:'',role:tag('role'),task:tag('task'),context:tag('context'),reasoning:tag('reasoning'),stop:tag('stop_when'),output:tag('output_format')}:{goal:'',role:'',task:text.split('\n')[0],context:text,reasoning:'',stop:'',output:''},{tech});
let s;try{s=suScore().score}finally{SU=keep}return s}
const pkBadge=v=>`<span class="pkscore ${v>=80?'hi':v>=55?'mid':'lo'}">${v}</span>`;

// --- sources ---
function pkLabFiltered(){const q=LF.q.toLowerCase();return LAB.filter(c=>(LF.field==='all'||c.field.en===LF.field)&&(LF.cat==='all'||c.cat===LF.cat)&&(!LF.data||(c.data||[]).length)&&(!q||(L(c.t)+' '+c.p.en+' '+c.p.ar+' '+L(c.field)).toLowerCase().includes(q)))}
function pkLibFiltered(){const q=libQ.toLowerCase();return PROMPTS.filter(p=>(libDom==='all'||p.dom===libDom)&&(!q||(L(p.t)+' '+L(p.p)+' '+L(p.src)).toLowerCase().includes(q)))}
const STARTER=[
['finance','💰',T('Finance & accounting','المالية والمحاسبة'),['Finance','Accounting','FP&A','Treasury','CFO','Banking','Audit','Trade finance'],['finance','accounting','cfo','banking','cost']],
['hr','👥',T('HR & people','الموارد البشرية'),['HR'],['hr']],
['sales','📈',T('Sales & customers','المبيعات والعملاء'),['Sales','Customer service'],['sales','cs','ecommerce']],
['marketing','📣',T('Marketing & content','التسويق والمحتوى'),['Marketing','Content'],['marketing','creator','content2']],
['legal','⚖',T('Legal & compliance','القانوني والامتثال'),['Legal','Compliance'],['legal','risk']],
['education','🎓',T('Education & training','التعليم والتدريب'),['Trainer','Academic'],['trainer','academic','instructor']]];
function pkStarterItems(k){const s=STARTER.find(x=>x[0]===k);const seen=new Set();const out=[];
LAB.filter(c=>s[3].includes(c.field.en)).forEach(c=>{const n=pkNorm(c.p.en);if(!seen.has(n)){seen.add(n);out.push({t:c.t,p:c.p,data:c.data})}});
PROMPTS.filter(p=>s[4].includes(p.dom)).forEach(p=>{const n=pkNorm(p.p.en);if(!seen.has(n)){seen.add(n);out.push({t:p.t,p:p.p})}});return out}
function pkItems(src){
if(src==='basket')return ST.basket.map(b=>({t:b.t,p:b.p}));
if(src==='mine')return ST.mine.map(m=>({t:m.t,p:m.p}));
if(src==='lab')return LAB.map(c=>({t:c.t,p:c.p,data:c.data}));
if(src==='labf')return pkLabFiltered().map(c=>({t:c.t,p:c.p,data:c.data}));
if(src==='libf')return pkLibFiltered().map(p=>({t:p.t,p:p.p}));
if(src==='studio')return [{t:SU.task||SU.goal||'Studio prompt',p:suPrompt()}];
if(src.startsWith('starter:'))return pkStarterItems(src.slice(8));return []}

// --- export ---
function pkPayload(items,meta){const lang=meta.lang==='cur'?LANG:meta.lang;
return {type:'claude-mastery-prompt-pack',version:2,name:meta.name,description:meta.desc,tags:meta.tags.split(',').map(s=>s.trim()).filter(Boolean),pack_version:meta.version,language:lang,author:ST.name||'',created:new Date().toISOString(),
items:items.map(i=>{const o={title:lang==='bi'?pkTxt(i.t,'en'):pkTxt(i.t,lang),prompt:lang==='bi'?pkTxt(i.p,'en'):pkTxt(i.p,lang)};
if(lang==='bi'&&typeof i.p!=='string'){o.title_ar=pkTxt(i.t,'ar');o.prompt_en=pkTxt(i.p,'en');o.prompt_ar=pkTxt(i.p,'ar')}
o.score=pkScore(o.prompt);if(i.data&&i.data.length)o.data=i.data;return o})}}
function pkMarkdown(pk){let m=`# ${pk.name}\n\n`;if(pk.description)m+=`${pk.description}\n\n`;
m+=`- Version: ${pk.pack_version}\n- Language: ${pk.language}\n- Prompts: ${pk.items.length}\n- Average quality score: ${pkAvg(pk.items)}/100\n`+(pk.tags.length?`- Tags: ${pk.tags.join(', ')}\n`:'')+(pk.author?`- Author: ${pk.author}\n`:'')+`- Created: ${pk.created.slice(0,10)}\n`;
pk.items.forEach((it,k)=>{m+=`\n## ${k+1}. ${it.title}${it.title_ar?` — ${it.title_ar}`:''}\n\nQuality score: ${it.score}/100\n\n`;
if(it.prompt_ar)m+=`**English**\n\n\`\`\`\n${it.prompt_en}\n\`\`\`\n\n**العربية**\n\n\`\`\`\n${it.prompt_ar}\n\`\`\`\n`;else m+=`\`\`\`\n${it.prompt}\n\`\`\`\n`});return m+`\n---\nClaude Mastery · ${LINKEDIN}\n`}
const pkAvg=items=>items.length?Math.round(items.reduce((a,b)=>a+(b.score||0),0)/items.length):0;
function pkHTML(pk){const ar=pk.language==='ar';const pre=t=>`<pre dir="auto" style="white-space:pre-wrap;background:#EEF2F7;border-radius:8px;padding:10px;font-size:11.5px;line-height:1.55">${esc(t)}</pre>`;
return `<div class="exdoc" dir="${ar?'rtl':'ltr'}"><div class="exhead"><div><div class="sig">${ar?'حزمة برومبتات':'Prompt pack'} · Claude Mastery</div><h1>${esc(pk.name)}</h1><p>${esc(pk.description||'')}</p><p class="note">v${esc(pk.pack_version)} · ${pk.items.length} ${ar?'برومبت':'prompts'} · ${ar?'متوسط الجودة':'avg score'} ${pkAvg(pk.items)}/100${pk.tags.length?' · '+esc(pk.tags.join(', ')):''}</p></div><div class="qr" style="width:90px">${QR_PLATFORM}</div></div>`+
pk.items.map((it,k)=>`<h2>${k+1}. ${esc(it.title)}${it.title_ar?` — ${esc(it.title_ar)}`:''} <small style="font-size:12px;color:#5B6B82">(${it.score}/100)</small></h2>`+(it.prompt_ar?pre(it.prompt_en)+pre(it.prompt_ar):pre(it.prompt))).join('')+`<p class="note">Claude Mastery · ${LINKEDIN}</p></div>`}
async function pkPDF(html,filename){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',()=>window.html2canvas);await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',()=>window.html2pdf);
const fr=document.createElement('iframe');fr.style.cssText='position:absolute;left:-12000px;top:0;width:794px;height:1200px;border:0';document.body.appendChild(fr);
const css=document.querySelector('style').textContent;fr.srcdoc=`<!doctype html><html lang="${LANG}" data-theme="light"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>${css} html,body{background:#fff;height:auto;overflow:visible;margin:0}.exdoc{padding:24px 28px}</style></head><body>${html}</body></html>`;
await new Promise(r=>fr.onload=r);try{await fr.contentDocument.fonts.ready}catch(e){}await new Promise(r=>setTimeout(r,400));const body=fr.contentDocument.body;fr.style.height=body.scrollHeight+'px';
const canvas=await html2canvas(body,{scale:2,backgroundColor:'#ffffff',foreignObjectRendering:true,windowWidth:794,width:794,height:body.scrollHeight});fr.remove();
const blob=await html2pdf().set({margin:[8,0,10,0],image:{type:'jpeg',quality:0.9},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(canvas,'canvas').outputPdf('blob');await saveFile(filename,blob)}
async function pkExport(src,btn,nameOverride){const items=pkItems(src);const ar=LANG==='ar';
if(!items.length){pkNote(ar?'مفيش برومبتات في المصدر ده.':'Nothing to export from this source.');return}
const meta=Object.assign({},PKM);if(nameOverride)meta.name=nameOverride;const pk=pkPayload(items,meta);const base=(meta.name||'Prompt-pack').replace(/[^\w؀-ۿ-]+/g,'-').replace(/-+/g,'-');
const old=btn&&btn.textContent;if(btn){btn.disabled=true;btn.textContent=ar?'جاري…':'Working…'}
try{if(meta.fmt==='md')await saveFile(base+'.md',pkMarkdown(pk));else if(meta.fmt==='pdf')await pkPDF(pkHTML(pk),base+'.pdf');else await saveFile(base+'.json',JSON.stringify(pk,null,1));
pkNote((ar?`اتصدّر ${pk.items.length} برومبت · متوسط الجودة ${pkAvg(pk.items)}/100`:`Exported ${pk.items.length} prompts · average score ${pkAvg(pk.items)}/100`))}
catch(e){console.error(e);pkNote(ar?'حصلت مشكلة في التصدير.':'Export failed.')}
if(btn){btn.disabled=false;btn.textContent=old}}
function pkNote(t){const n=document.getElementById('pknote');if(n)n.textContent=t}

// --- import with preview + duplicate check ---
function pkParse(j){if(!j||!Array.isArray(j.items))throw new Error('bad');const have=new Set(ST.mine.map(m=>pkNorm(m.p)));const inFile=new Set();
const items=j.items.map(i=>{const p=i.prompt||(LANG==='ar'?i.prompt_ar||i.prompt_en:i.prompt_en||i.prompt_ar)||'';const t=(LANG==='ar'&&i.title_ar)||i.title||'Imported';const n=pkNorm(p);const dup=have.has(n)||inFile.has(n);inFile.add(n);return {t,p,dup,sel:!dup&&!!p,score:pkScore(p)}}).filter(i=>i.p);
return {name:j.name||'Prompt pack',desc:j.description||'',tags:(j.tags||[]).join(', '),version:j.pack_version||'',items}}

// --- add to basket ---
function pkAdd(t,p){const ar=LANG==='ar';const n=pkNorm(pkTxt(p,'en'));if(ST.basket.some(b=>pkNorm(pkTxt(b.p,'en'))===n)){toastPK(ar?'موجود في السلة بالفعل':'Already in the pack basket');return}
ST.basket.push({t,p,d:new Date().toISOString().slice(0,10)});saveST();toastPK((ar?'اتضاف لسلة الحزمة':'Added to pack basket')+` (${ST.basket.length})`)}
function toastPK(t){const x=document.getElementById('xpToast');if(x){x.textContent='📦 '+t;x.classList.add('on');setTimeout(()=>x.classList.remove('on'),1400)}}

// --- view ---
function vPacks(){crumb(L(UX6.packs));const ar=LANG==='ar';const opt=(v,cur,lab)=>`<option value="${v}" ${cur===v?'selected':''}>${lab}</option>`;
const labN=pkLabFiltered().length,libN=pkLibFiltered().length;
let h=`<h1>📦 ${L(UX6.packs)}</h1><p class="lede">${ar?'جمّع برومبتات في حزمة، صدّرها JSON أو Markdown أو PDF، وشاركها مع فريقك — أو استورد حزمة زميل.':'Collect prompts into a pack, export it as JSON, Markdown or PDF and share it with your team — or import a colleague’s pack.'}</p>`;
// basket
const bs=ST.basket.map(b=>pkScore(pkTxt(b.p,LANG)));
h+=`<h2>🧺 ${ar?'سلة الحزمة':'Pack basket'} (${ST.basket.length})${ST.basket.length?` · ${ar?'متوسط الجودة':'avg score'} ${pkBadge(Math.round(bs.reduce((a,b)=>a+b,0)/bs.length))}`:''}</h2>`;
h+=ST.basket.length?`<div class="pklist">${ST.basket.map((b,k)=>`<div class="pkrow">${pkBadge(bs[k])}<span dir="auto">${esc(pkTxt(b.t,LANG))}</span><button class="tbtn" data-pkmv="${k}:-1" title="up" ${k?'':'disabled'}>↑</button><button class="tbtn" data-pkdel="${k}">✕</button></div>`).join('')}</div><p class="row-btns"><button class="btn-gold" data-pkexp="basket">⤓ ${ar?'صدّر السلة':'Export basket'}</button><button class="tbtn" data-pkclear="1">${ar?'فضّي السلة':'Clear basket'}</button></p>`
:`<div class="empty">${ar?'السلة فاضية. اضغط 📦 جنب أي برومبت في المنصة، أو "أضف للحزمة" في الاستوديو.':'The basket is empty. Press 📦 next to any prompt on the platform, or “Add to pack” in the studio.'}</div>`;
// metadata + sources
h+=`<h2>⚙ ${ar?'بيانات الحزمة والتصدير':'Pack details & export'}</h2><div class="twocol"><div class="abpane">
<label class="pbf"><b>${ar?'اسم الحزمة':'Pack name'}</b><input class="search" data-pkm="name" value="${esc(PKM.name)}"></label>
<label class="pbf"><b>${ar?'الوصف':'Description'}</b><textarea class="search" data-pkm="desc" rows="2" dir="auto">${esc(PKM.desc)}</textarea></label>
<label class="pbf"><b>${ar?'وسوم (مفصولة بفاصلة)':'Tags (comma-separated)'}</b><input class="search" data-pkm="tags" value="${esc(PKM.tags)}" placeholder="finance, month-end"></label>
<div class="pkgrid3"><label class="pbf"><b>${ar?'الإصدار':'Version'}</b><input class="search" data-pkm="version" value="${esc(PKM.version)}"></label>
<label class="pbf"><b>${ar?'اللغة':'Language'}</b><select data-pkm="lang">${opt('cur',PKM.lang,ar?'لغة المنصة الحالية':'Current platform language')}${opt('en',PKM.lang,'English')}${opt('ar',PKM.lang,'العربية')}${opt('bi',PKM.lang,ar?'الاتنين (عربي + إنجليزي)':'Both (English + Arabic)')}</select></label>
<label class="pbf"><b>${ar?'الصيغة':'Format'}</b><select data-pkm="fmt">${opt('json',PKM.fmt,'JSON')}${opt('md',PKM.fmt,'Markdown')}${opt('pdf',PKM.fmt,'PDF')}</select></label></div>
<p class="note">${ar?'"الاتنين" بيحط النسخة العربي والإنجليزي لكل برومبت ليه نسختين. كل برومبت بيتقيّم بمقياس جودة الاستوديو.':'“Both” includes the English and Arabic version of every bilingual prompt. Every prompt is scored with the studio’s quality checker.'}</p></div>
<div class="abpane"><h3>${ar?'صدّر من':'Export from'}</h3>
<button class="btn-gold" data-pkexp="basket">🧺 ${ar?'سلة الحزمة':'Pack basket'} (${ST.basket.length})</button>
<button class="tbtn" data-pkexp="mine">💾 ${ar?'برومبتاتي المحفوظة':'My saved prompts'} (${ST.mine.length})</button>
<button class="tbtn" data-pkexp="labf">⚗ ${ar?'حالات المعمل بالفلاتر الحالية':'Lab cases with current filters'} (${labN})</button>
<button class="tbtn" data-pkexp="libf">✎ ${ar?'المكتبة بالبحث والفئة الحالية':'Library with current search & category'} (${libN})</button>
<button class="tbtn" data-pkexp="lab">⚗ ${ar?'كل حالات المعمل':'All lab cases'} (${LAB.length})</button>
<button class="tbtn" data-pkexp="studio">🎛 ${ar?'برومبت الاستوديو الحالي':'Current studio prompt'}</button>
<p class="note" id="pknote" aria-live="polite"></p></div></div>`;
// starter packs
h+=`<h2>🚀 ${ar?'حزم جاهزة حسب المجال':'Starter packs by field'}</h2><p class="note">${ar?'متجمّعة من حالات المعمل ومكتبة البرومبتات الموجودة في المنصة.':'Assembled from the platform’s lab cases and prompt library.'}</p><div class="grid">`+STARTER.map(s=>{const it=pkStarterItems(s[0]);const sc=it.length?Math.round(it.reduce((a,i)=>a+pkScore(L(i.p)),0)/it.length):0;
return `<div class="card pkstarter"><h3>${s[1]} ${L(s[2])}</h3><div class="k">${it.length} ${ar?'برومبت':'prompts'} · ${ar?'متوسط الجودة':'avg score'} ${pkBadge(sc)}</div><div class="row-btns"><button class="btn-gold" data-pkexp="starter:${s[0]}" data-pkname="${esc(L(s[2]))}">⤓ ${PKM.fmt.toUpperCase()}</button><button class="tbtn" data-pkstarter="${s[0]}">🧺 ${ar?'للسلة':'To basket'}</button></div></div>`}).join('')+`</div>`;
// import
h+=`<h2>⤒ ${ar?'استورد حزمة':'Import a pack'}</h2><div class="abpane"><label class="filebtn">${ar?'اختار ملف حزمة (.json)':'Choose a pack file (.json)'}<input type="file" id="packfile2" accept=".json,application/json"></label><p class="note" id="pkimpnote">${ar?'هتشوف البرومبتات الأول وتختار اللي عايزه. المكرر بيتعلّم ومش بيتختار.':'You preview the prompts first and pick what to keep. Duplicates are flagged and left unticked.'}</p>`;
if(PKIMP){const sel=PKIMP.items.filter(i=>i.sel).length,dups=PKIMP.items.filter(i=>i.dup).length;
h+=`<div class="pkprev"><h3>${esc(PKIMP.name)}${PKIMP.version?` · v${esc(PKIMP.version)}`:''}</h3>${PKIMP.desc?`<p dir="auto">${esc(PKIMP.desc)}</p>`:''}${PKIMP.tags?`<p class="note">${esc(PKIMP.tags)}</p>`:''}
<p class="note">${PKIMP.items.length} ${ar?'برومبت':'prompts'} · ${dups} ${ar?'مكرر':'duplicates'} · ${ar?'متوسط الجودة':'avg score'} ${pkBadge(pkAvg(PKIMP.items))}</p>
<div class="row-btns"><button class="tbtn" data-pkimpall="1">${ar?'اختار الكل':'Select all'}</button><button class="tbtn" data-pkimpall="0">${ar?'شيل الكل':'Select none'}</button></div>
<div class="pklist">${PKIMP.items.map((i,k)=>`<label class="pkrow ${i.dup?'dup':''}"><input type="checkbox" data-pkimpsel="${k}" ${i.sel?'checked':''}>${pkBadge(i.score)}<span dir="auto">${esc(i.t)}</span>${i.dup?`<em>${ar?'مكرر':'duplicate'}</em>`:''}</label>`).join('')}</div>
<div class="row-btns"><button class="btn-gold" data-pkimp="mine">✓ ${ar?`استورد ${sel} للمحفوظ`:`Import ${sel} to Saved`}</button><button class="tbtn" data-pkimp="basket">🧺 ${ar?'للسلة':'To basket'}</button><button class="tbtn" data-pkimp="cancel">${ar?'إلغاء':'Cancel'}</button></div></div>`}
return h+`<p class="row-btns" style="margin-top:12px"><button class="tbtn" data-labtab="studio">🎛 ${L(UX3.studio)}</button></p></div>`}

// --- "export these" bars on the cases and library tabs ---
const pkBar=src=>{const ar=LANG==='ar';const n=src==='labf'?pkLabFiltered().length:pkLibFiltered().length;return `<div class="pkbar"><span>📦 ${ar?`صدّر الـ ${n} دول كحزمة`:`Export these ${n} as a pack`}</span><button class="tbtn" data-pkexp="${src}">⤓ ${PKM.fmt.toUpperCase()}</button><button class="tbtn" data-labtab="packs">${ar?'إعدادات الحزمة':'Pack settings'}</button></div>`};
{const _vLab=vLab;vLab=function(){const h=_vLab();return labTab==='cases'?h.replace('<div class="lfil">',pkBar('labf')+'<div class="lfil">'):h}}
{const _vLib=vLibrary;vLibrary=function(){return pkBar('libf')+_vLib()}}
{const _vSt=vStudio;vStudio=function(){return _vSt().replace('data-sugo="save">',`data-pkstudio="1">📦 ${LANG==='ar'?'أضف للحزمة':'Add to pack'}</button><button class="dlbtn" data-sugo="save">`)}}
// --- 📦 on every prompt card ---
{const _pb=promptBox;promptBox=function(p,extra){const h=_pb(p,extra);if(PRINT)return h;const k=PKS.push({t:p.t,p:p.p})-1;return h.replace('<button class="copy"',`<button class="copy pkadd" data-pkadd="${k}" title="${LANG==='ar'?'أضف للحزمة':'Add to pack'}" aria-label="${LANG==='ar'?'أضف للحزمة':'Add to pack'}">📦</button><button class="copy"`)}}

// --- events ---
document.addEventListener('click',e=>{const g=s=>e.target.closest(s);let x;
if(x=g('[data-pkadd]')){e.preventDefault();e.stopPropagation();const it=PKS[+x.dataset.pkadd];if(it)pkAdd(it.t,it.p);return}
if(x=g('[data-pkstudio]')){pkAdd(SU.task||SU.goal||'Studio prompt',suPrompt());return}
if(x=g('[data-pkexp]')){pkExport(x.dataset.pkexp,x,x.dataset.pkname);return}
if(x=g('[data-pkdel]')){ST.basket.splice(+x.dataset.pkdel,1);saveST();render();return}
if(x=g('[data-pkmv]')){const [k,d]=x.dataset.pkmv.split(':').map(Number);const j=k+d;if(j>=0&&j<ST.basket.length){const [it]=ST.basket.splice(k,1);ST.basket.splice(j,0,it);saveST();render()}return}
if(x=g('[data-pkclear]')){ST.basket=[];saveST();render();return}
if(x=g('[data-pkstarter]')){const it=pkStarterItems(x.dataset.pkstarter);const have=new Set(ST.basket.map(b=>pkNorm(pkTxt(b.p,'en'))));let n=0;it.forEach(i=>{const k=pkNorm(pkTxt(i.p,'en'));if(!have.has(k)){have.add(k);ST.basket.push({t:i.t,p:i.p,d:new Date().toISOString().slice(0,10)});n++}});saveST();render();toastPK((LANG==='ar'?'اتضاف ':'Added ')+n);return}
if(x=g('[data-pkimpall]')){const v=x.dataset.pkimpall==='1';PKIMP.items.forEach(i=>i.sel=v);render();return}
if(x=g('[data-pkimp]')){const a=x.dataset.pkimp;if(a!=='cancel'){const items=PKIMP.items.filter(i=>i.sel);const d=new Date().toISOString().slice(0,10);
if(a==='mine')items.slice().reverse().forEach(i=>ST.mine.unshift({t:i.t,d,p:i.p}));else items.forEach(i=>ST.basket.push({t:i.t,p:i.p,d}));saveST();
const skipped=PKIMP.items.length-items.length;PKIMP=null;render();const n=document.getElementById('pkimpnote');if(n)n.textContent=LANG==='ar'?`اتضاف ${items.length} برومبت · اتساب ${skipped}.`:`Imported ${items.length} prompts · skipped ${skipped}.`;return}
PKIMP=null;render();return}});
document.addEventListener('input',e=>{const t=e.target;if(t.dataset&&t.dataset.pkm&&t.tagName!=='SELECT'){PKM[t.dataset.pkm]=t.value;savePKM()}});
document.addEventListener('change',async e=>{const t=e.target;
if(t.dataset&&t.dataset.pkm&&t.tagName==='SELECT'){PKM[t.dataset.pkm]=t.value;savePKM();render()}
if(t.dataset&&t.dataset.pkimpsel!=null){PKIMP.items[+t.dataset.pkimpsel].sel=t.checked;render()}
if(t.id==='packfile2'&&t.files[0]){try{PKIMP=pkParse(JSON.parse(await t.files[0].text()));render()}catch(err){const n=document.getElementById('pkimpnote');if(n)n.textContent=LANG==='ar'?'الملف مش حزمة صالحة.':'This file is not a valid prompt pack.'}}});
