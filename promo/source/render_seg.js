const {chromium}=require('playwright');const {spawn}=require('child_process');
const [a,b,out]=[+process.argv[2],+process.argv[3],process.argv[4]];
(async()=>{
 const FPS=30;const br=await chromium.launch();const p=await br.newPage({viewport:{width:1920,height:1080}});
 await p.goto('file://'+__dirname+'/'+(process.env.PAGE||'ad.html'));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(500);
 const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',out],{stdio:['pipe','inherit','inherit']});
 const cdp=await p.context().newCDPSession(p);
 for(let i=a;i<b;i++){
  await p.evaluate(t=>seek(t),i/FPS);
  const {data}=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:92});
  if(!ff.stdin.write(Buffer.from(data,'base64'))) await new Promise(r=>ff.stdin.once('drain',r));
  if((i-a)%300===0) console.log(out,'frame',i-a,'/',b-a);
 }
 ff.stdin.end();await new Promise(r=>ff.on('close',r));await br.close();console.log(out,'done');
})();
