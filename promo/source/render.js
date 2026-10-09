const {chromium}=require('playwright');const {spawn}=require('child_process');
(async()=>{
 const FPS=30;const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
 await p.goto('file://'+__dirname+'/ad.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(500);
 const DUR=await p.evaluate(()=>DUR);const n=Math.round(DUR*FPS);
 const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-i','music.wav',
  '-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart','out.mp4'],{stdio:['pipe','inherit','inherit']});
 const cdp=await p.context().newCDPSession(p);
 for(let i=0;i<n;i++){
  await p.evaluate(t=>seek(t),i/FPS);
  const {data}=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:95});
  if(!ff.stdin.write(Buffer.from(data,'base64'))) await new Promise(r=>ff.stdin.once('drain',r));
  if(i%300===0) console.log('frame',i,'/',n);
 }
 ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('done');
})();
