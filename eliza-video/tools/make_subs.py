"""Write English + Arabic SRT subtitles and ffmpeg chapter metadata from timeline.json.

usage: python3 make_subs.py <timeline.json> <subtitles_ar.json> <out_dir>
"""
import json, sys

tl = json.load(open(sys.argv[1]))
ar = json.load(open(sys.argv[2]))
out = sys.argv[3]


def ts(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


en_rows, ar_rows = [], []
for s in tl["scenes"]:
    assert len(ar[s["id"]]) == len(s["lines"]), s["id"]
    for i, ln in enumerate(s["lines"]):
        tag = {"E": "ELIZA: ", "U": "PATIENT: ", "N": ""}[ln["s"]]
        tag_ar = {"E": "إليزا: ", "U": "المريضة: ", "N": ""}[ln["s"]]
        text = ln["t"].upper() if ln["s"] == "E" else ln["t"]
        en_rows.append((ln["start"], ln["end"] + .3, tag + text))
        ar_rows.append((ln["start"], ln["end"] + .3, tag_ar + ar[s["id"]][i]))
for name, rows in (("eliza_en.srt", en_rows), ("eliza_ar.srt", ar_rows)):
    with open(f"{out}/{name}", "w", encoding="utf-8") as f:
        for n, (a, b, t) in enumerate(rows, 1):
            f.write(f"{n}\n{ts(a)} --> {ts(b)}\n{t}\n\n")

with open(f"{out}/chapters.txt", "w", encoding="utf-8") as f:
    f.write(";FFMETADATA1\ntitle=ELIZA - The Machine That Listened\nartist=Sara Salem\n"
            "comment=Prepared by Sara Salem\n\n")
    names = {"cold_open": "Cold Open", "title": "Title", "outro": "Credits"}
    for s in tl["scenes"]:
        if s["id"] == "title": continue
        name = s["chapter"] or names[s["id"]]
        f.write(f"[CHAPTER]\nTIMEBASE=1/1000\nSTART={int(s['start'] * 1000)}\nEND={int(s['end'] * 1000)}\ntitle={name}\n\n")
# YouTube-style chapter list
with open(f"{out}/chapters_youtube.txt", "w", encoding="utf-8") as f:
    for s in tl["scenes"]:
        if s["id"] == "title": continue
        t = int(s["start"])
        f.write(f"{t // 60}:{t % 60:02d} {(s['chapter'] or {'cold_open': 'Cold Open', 'outro': 'Credits'}[s['id']]).replace(' · ', ': ')}\n")
print("subs ok", len(en_rows))
