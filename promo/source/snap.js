const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
 p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>console.log('LOG',m.text()));
 await p.goto('file://'+__dirname+'/ad.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
 const ts=process.argv.slice(2).map(Number);
 for(const t of ts){await p.evaluate(t=>seek(t),t);await p.screenshot({path:`snap_${t}.jpg`,type:'jpeg',quality:70});}
 await b.close();
})();
