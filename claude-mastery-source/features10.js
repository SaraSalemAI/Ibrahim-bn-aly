// ---------- Round 11: standard use-case template (CX data in cx_1..3.js) ----------
const CX={};
{const _cc=caseCard;caseCard=function(c,meta){const x=c&&c._dom&&c.t?CX[c._dom+'|'+c.t.en]:null;if(!x)return _cc(c,meta);const ar=LANG==='ar';
const c2=Object.assign({},c,{data:c.data||(x.data&&DATA[x.data]?[x.data]:null)});
const chip=`<span class="cxchip">⏱ ${esc(L(x.bt))} → ${esc(L(x.at))}</span>`;
let h=_cc(c2,(meta||'')+chip);
const top=`<div class="cxtpl"><div class="cxlab">📋 ${ar?'قالب حالة الاستخدام':'Use-case template'}</div><div class="cxprob"><b>${ar?'المشكلة':'Problem'}</b><p>${esc(L(x.prob))}</p></div>
<div class="cxba"><div class="cxb"><b>${ar?'قبل':'Before'}</b><div class="cxt">⏱ ${esc(L(x.bt))}</div><p>${esc(L(x.bp))}</p></div><div class="cxa"><b>${ar?'بعد':'After'}</b><div class="cxt">⏱ ${esc(L(x.at))}</div><p>${esc(L(x.ag))}</p></div></div>
<p class="k cxnote">${ar?'تقديرات لفريق عادي — قيس وقتك إنت قبل وبعد.':'Typical estimates — measure your own before and after.'}</p><h4>🪜 ${ar?'الخطوات':'Steps'}</h4></div>`;
const risks=fdList(L(x.risks));
const bottom=`<div class="cxfoot"><div><b>⚠ ${ar?'المخاطر':'Risks'}</b><ul>${risks.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></div><div><b>👤 ${ar?'مين يراجع':'Reviewer'}</b><p>${esc(L(x.rev))}</p><b>📈 ${ar?'إزاي تقيس النجاح':'KPI'}</b><p>${esc(L(x.kpi))}</p></div></div>`;
return h.replace('</summary>','</summary>'+top).replace(/<\/details>$/,bottom+'</details>')}}
