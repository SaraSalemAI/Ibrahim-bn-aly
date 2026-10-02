// one-time progress migration for the round-10 restructure (runs after app.js defines DONE)
(function(){try{if(ST.restr10)return;const map=k=>IDMAP[k]&&!['15.3','15.4'].includes(k)?IDMAP[k]:k;const drop=k=>/^1[23]\.|^15\.[34]$/.test(k);
DONE=[...new Set(DONE.filter(k=>!drop(k)).map(map))];saveDone();if(ST.lv){const n={};Object.entries(ST.lv).forEach(([k,v])=>{if(!drop(k))n[map(k)]=v});ST.lv=n}ST.restr10=1;saveST()}catch(e){}})();

(function(){try{if(ST.restr12)return;DONE=[...new Set(DONE.map(k=>IDMAP2[k]||k))];saveDone();if(ST.lv){const n={};Object.entries(ST.lv).forEach(([k,v])=>n[IDMAP2[k]||k]=v);ST.lv=n}ST.restr12=1;saveST()}catch(e){}})();
