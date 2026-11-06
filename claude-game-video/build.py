# Assembles index.html from src.html + base.css + extra.css + timing.json
import json
s=open('src.html').read().replace('/*BASE*/',open('base.css').read()).replace('/*EXTRA*/',open('extra.css').read())
s=s.replace('<script>\nconst IC=', '<script>window.TIMING='+json.dumps(json.load(open('timing.json')))+';</script>\n<script>\nconst IC=',1)
open('index.html','w').write(s)
