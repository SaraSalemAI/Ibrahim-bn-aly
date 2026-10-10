set -e
S=$SCRATCH; O=/home/user/Ibrahim-bn-aly/eliza-video/output
until [ $(grep -h "worker done" $S/segs/log*.txt 2>/dev/null | wc -l) = 4 ]; do sleep 15; done
ls $S/segs/seg_*.mp4 | sort | sed "s/.*/file '&'/" > $S/segs/list.txt
ffmpeg -v error -y -f concat -safe 0 -i $S/segs/list.txt -i $S/build/mix.wav -i $S/build/eliza_en.srt -i $S/build/eliza_ar.srt -i $S/build/chapters.txt   -map 0:v -map 1:a -map 2 -map 3 -map_metadata 4 -map_chapters 4   -vf "drawbox=x=40:y=ih-74:w=306:h=44:color=0x050a1a@0.55:t=fill,drawbox=x=40:y=ih-74:w=4:h=44:color=0x3de8ff@0.95:t=fill,drawtext=fontfile=/usr/share/fonts/opentype/inter/Inter-SemiBold.otf:text='PREPARED BY':fontsize=17:fontcolor=0xffb547:x=58:y=h-60,drawtext=fontfile=/usr/share/fonts/opentype/inter/Inter-SemiBold.otf:text='Sara Salem':fontsize=24:fontcolor=white:x=192:y=h-65" -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k -af loudnorm=I=-14:TP=-1.5:LRA=11   -c:s mov_text -metadata:s:s:0 language=eng -metadata:s:s:0 title=English -metadata:s:s:1 language=ara -metadata:s:s:1 title=Arabic   -t 605 $O/ELIZA_The_Machine_That_Listened_Sara_Salem.mp4
cp $S/build/eliza_en.srt $S/build/eliza_ar.srt $S/build/chapters_youtube.txt $O/
ffmpeg -v error -y -ss 41 -i $O/ELIZA_The_Machine_That_Listened_Sara_Salem.mp4 -frames:v 1 -q:v 2 $O/thumbnail.jpg
echo FINISHED; ls -la $O
