// one-time progress migration for the round-10 restructure (runs after app.js defines DONE)
(function(){try{if(ST.restr10)return;const map=k=>IDMAP[k]&&!['15.3','15.4'].includes(k)?IDMAP[k]:k;const drop=k=>/^1[23]\.|^15\.[34]$/.test(k);
DONE=[...new Set(DONE.filter(k=>!drop(k)).map(map))];saveDone();if(ST.lv){const n={};Object.entries(ST.lv).forEach(([k,v])=>{if(!drop(k))n[map(k)]=v});ST.lv=n}ST.restr10=1;saveST()}catch(e){}})();
