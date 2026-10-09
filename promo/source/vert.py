import json,subprocess,os
tm=json.load(open('timing.json')); S={x['id']:x for x in tm['scenes']}
segs=[(S['s1']['start'],S['s1']['end']),(S['s2']['start'],S['s2']['end']),(S['s3']['start'],S['s3']['end']),
      (S['s6b']['lines'][3]['start']-0.6,S['s6b']['end']),(S['s8i']['start'],S['s8i']['lines'][0]['end']+1.2),(S['s13']['start'],S['s13']['end'])]
env=dict(os.environ,VW='1080',VH='1920',PAGE='ad4.html')
procs=[]
for i,(a,b) in enumerate(segs):
    procs.append(subprocess.Popen(['node','render_seg.js',str(round(a*30)),str(round(b*30)),f'vraw{i}.mp4'],env=env,stdout=subprocess.DEVNULL))
    if len([p for p in procs if p.poll() is None])>=4:
        for p in procs: p.wait()
for p in procs: p.wait()
L=open('vsegs.txt','w')
for i,(a,b) in enumerate(segs):
    a0=round(a*30)/30; d=(round(b*30)-round(a*30))/30
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f'vraw{i}.mp4','-ss',f'{a0:.3f}','-t',f'{d:.3f}','-i','final_audio.wav',
      '-vf',f'fade=t=in:st=0:d=0.25,fade=t=out:st={d-0.3:.3f}:d=0.3','-af',f'afade=t=in:st=0:d=0.2,afade=t=out:st={d-0.35:.3f}:d=0.35',
      '-map','0:v','-map','1:a','-c:v','libx264','-preset','medium','-crf','21','-maxrate','3000k','-bufsize','6000k','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','160k','-ar','44100','-shortest',f'vseg{i}.mp4'],check=True)
    L.write(f'file vseg{i}.mp4\n')
L.close()
subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-i','vsegs.txt','-c','copy','-movflags','+faststart','/home/user/Ibrahim-bn-aly/promo/AI-for-Finance-Vertical-9x16-60s.mp4'],check=True)
print('VDONE')
