set -e
cd "$(dirname "$0")"
python3 -c "
s=open('ad2.src.html').read().replace('<!--BASECSS-->',open('base.css.html').read()); open('ad2.html','w').write(s)
open('timing.js','w').write('window.TIMING='+open('timing.json').read()+';')"
N=$(python3 -c "import json,math;print(math.ceil(json.load(open('timing.json'))['duration']*30))")
P=4; Q=$(( (N+P-1)/P ))
for i in $(seq 0 $((P-1))); do a=$((i*Q)); b=$(( (i+1)*Q < N ? (i+1)*Q : N )); PAGE=ad2.html node render_seg.js $a $b v2seg$i.mp4 & done; wait
: > v2segs.txt; for i in $(seq 0 $((P-1))); do echo "file v2seg$i.mp4" >> v2segs.txt; done
ffmpeg -y -loglevel error -f concat -i v2segs.txt -i final_audio.wav -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart AI-for-Finance-Promo.mp4
echo ALLDONE
