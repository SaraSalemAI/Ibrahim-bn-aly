const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:+(process.env.VW||1920),height:+(process.env.VH||1080)}});
 p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>console.log('LOG',m.text()));
 await p.goto('file://'+__dirname+'/'+(process.env.PAGE||'ad.html'));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
 const ts=process.argv.slice(2).map(Number);
 for(const t of ts){await p.evaluate(t=>seek(t),t);await p.screenshot({path:`snap_${t}.jpg`,type:'jpeg',quality:70});}
 await b.close();
})();
