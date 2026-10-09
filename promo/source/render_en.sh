set -e
cd "$(dirname "$0")"
cp voice_en.wav voice.wav; cp timing_en.json timing.json
python3 make_env.py
python3 music2.py
python3 -c "
s=open('ad3.src.html').read().replace('<!--BASECSS-->',open('base.css.html').read()); open('ad3.html','w').write(s)
open('timing.js','w').write('window.TIMING='+open('timing.json').read()+';')"
N=$(python3 -c "import json,math;print(math.ceil(json.load(open('timing.json'))['duration']*30))")
P=4; Q=$(( (N+P-1)/P )); rm -f v3seg*.mp4
for i in $(seq 0 $((P-1))); do a=$((i*Q)); b=$(( (i+1)*Q < N ? (i+1)*Q : N )); PAGE=ad3.html node render_seg.js $a $b v3seg$i.mp4 & done; wait
: > v3segs.txt; for i in $(seq 0 $((P-1))); do echo "file v3seg$i.mp4" >> v3segs.txt; done
ffmpeg -y -loglevel error -f concat -i v3segs.txt -i final_audio.wav -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart AI-for-Finance-Promo-EN-1080p.mp4
D=$(python3 -c "import json;print(json.load(open('timing.json'))['duration'])")
VB=$(python3 -c "print(int(29.0*8*1024/$D - 64))")
ffmpeg -y -loglevel error -i AI-for-Finance-Promo-EN-1080p.mp4 -vf scale=1280:720:flags=lanczos -c:v libx264 -preset medium -b:v ${VB}k -pass 1 -passlogfile pen -an -f null /dev/null
ffmpeg -y -loglevel error -i AI-for-Finance-Promo-EN-1080p.mp4 -vf scale=1280:720:flags=lanczos -c:v libx264 -preset medium -b:v ${VB}k -maxrate $((VB*2))k -bufsize $((VB*4))k -pass 2 -passlogfile pen -pix_fmt yuv420p -c:a aac -b:a 64k -movflags +faststart /home/user/Ibrahim-bn-aly/promo/AI-for-Finance-Promo-English.mp4
ls -la /home/user/Ibrahim-bn-aly/promo/AI-for-Finance-Promo-English.mp4
echo ALLDONE
