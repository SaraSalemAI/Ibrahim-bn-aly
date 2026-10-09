"""Add terminal typing events (scene-local seconds) to timeline.json.

The same events drive the on-screen terminal text and the keyboard sound effects.
usage: python3 typing.py <timeline.json>
"""
import json, sys

path = sys.argv[1]
tl = json.load(open(path))
sc = {s["id"]: s for s in tl["scenes"]}


def local(s, i, key="start"):
    return round(s["lines"][i][key] - s["start"], 3)


def ev(kind, text, t0, t1=None):
    # ELIZA prints like a fast teletype; people type at a human pace
    if t1 is None:
        t1 = t0 + (0.045 if kind == "E" else 0.075) * len(text)
    return {"k": kind, "text": text, "t0": round(t0, 3), "t1": round(t1, 3)}


s = sc["cold_open"]
events = [ev("E", "HOW DO YOU DO.  PLEASE TELL ME YOUR PROBLEM.", 0.1, 1.9)]
for i in range(4):
    ln = s["lines"][i]
    text = ln["t"].upper() if ln["s"] == "E" else ln["t"]
    if ln["s"] == "U":
        events.append(ev("U", text, local(s, i) - 0.1, local(s, i, "end")))
    else:
        events.append(ev("E", text, local(s, i)))
s["screen"] = events

s = sc["secretary"]
a = local(s, 1)
s["screen"] = [ev("E", "HOW DO YOU DO.  PLEASE TELL ME YOUR PROBLEM.", 0.4),
               ev("U", "Nobody really listens to me.", a + 0.4),
               ev("E", "WHY DO YOU THINK NOBODY REALLY LISTENS TO YOU?", a + 3.2),
               ev("U", "You do.", local(s, 2) + 1.2),
               ev("E", "WHAT MAKES YOU THINK I DO?", local(s, 2) + 2.6)]

s = sc["closing"]
s["screen"] = [ev("E", "HOW DO YOU DO.  PLEASE TELL ME YOUR PROBLEM.", 0.3),
               ev("U", "Do you understand me?", 2.6),
               ev("E", "WE WERE DISCUSSING YOU -- NOT ME.", 5.0)]

json.dump(tl, open(path, "w"), indent=1)
print("ok")
