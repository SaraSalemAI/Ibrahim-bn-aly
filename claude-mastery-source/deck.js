const pptxgen=require('pptxgenjs');const fs=require('fs');
const pres=new pptxgen();pres.layout='LAYOUT_WIDE';pres.author='Dr. Sara Salem';pres.title='Claude Mastery';
const NAVY='13284B',GOLD='C9A227',TEAL='1C7F7A',INK='1E293B',MUT='5B6B82',BG='F4F6FA';
const QRL='image/png;base64,'+fs.readFileSync('qr_li.b64','utf8'),QRP='image/png;base64,'+fs.readFileSync('qr_pf.b64','utf8');
const W=13.333,H=7.5;
function foot(s,n){s.addText(`Claude Mastery · Dr. Sara Salem · ${n}`,{x:0.5,y:7.0,w:8,h:0.3,fontFace:'Arial',fontSize:9,color:MUT,isTextBox:true,margin:0});}
function title(s,en,ar){s.addText(en,{x:0.5,y:0.4,w:8.6,h:0.8,fontFace:'Cambria',fontSize:34,bold:true,color:NAVY,isTextBox:true,margin:0});
s.addText(ar,{x:6.5,y:1.15,w:6.33,h:0.5,fontFace:'Arial',fontSize:18,color:TEAL,align:'right',rtlMode:true,lang:'ar-EG',isTextBox:true,margin:0});}
function circ(s,x,y,t,c){s.addShape(pres.shapes.OVAL,{x,y,w:0.62,h:0.62,fill:{color:c||GOLD},line:{color:c||GOLD}});s.addText(t,{x,y,w:0.62,h:0.62,fontFace:'Arial',fontSize:16,bold:true,color:c===NAVY?'FFFFFF':NAVY,align:'center',valign:'middle',isTextBox:true,margin:0});}
function card(s,x,y,w,h,head,body,num){s.addShape(pres.shapes.ROUNDED_RECTANGLE,{x,y,w,h,fill:{color:'FFFFFF'},line:{color:'DDE3EC'},rectRadius:0.12,shadow:{type:'outer',blur:6,offset:2,angle:90,color:'000000',opacity:0.08}});
if(num)circ(s,x+0.2,y+0.2,num);const tx=num?x+0.95:x+0.25;s.addText(head,{x:tx,y:y+0.2,w:w-(tx-x)-0.2,h:0.6,fontFace:'Arial',fontSize:15,bold:true,color:NAVY,valign:'middle',isTextBox:true,margin:0});
s.addText(body,{x:x+0.25,y:y+0.9,w:w-0.5,h:h-1.05,fontFace:'Arial',fontSize:14,color:INK,valign:'top',isTextBox:true,margin:0});}
let n=0;const S=()=>{const s=pres.addSlide();s.background={color:BG};n++;return s};
// 1 Title
{const s=pres.addSlide();n++;s.background={color:NAVY};
s.addShape(pres.shapes.ROUNDED_RECTANGLE,{x:0.6,y:0.6,w:0.9,h:0.9,fill:{color:GOLD},line:{color:GOLD},rectRadius:0.15});s.addText('✦',{x:0.6,y:0.6,w:0.9,h:0.9,fontSize:30,color:NAVY,align:'center',valign:'middle',isTextBox:true,margin:0});
s.addText('Claude Mastery',{x:0.6,y:1.9,w:8,h:1.1,fontFace:'Cambria',fontSize:54,bold:true,color:'FFFFFF',isTextBox:true,margin:0});
s.addText('From the first prompt to the first AI agent — for finance & business professionals',{x:0.6,y:3.0,w:7.6,h:0.9,fontFace:'Arial',fontSize:18,color:'C7D1E2',isTextBox:true,margin:0});
s.addText('إتقان Claude للبيزنس — من أول برومبت لأول وكيل',{x:0.6,y:3.9,w:7.6,h:0.6,fontFace:'Arial',fontSize:20,color:'F1D27A',rtlMode:true,lang:'ar-EG',align:'left',isTextBox:true,margin:0});
s.addText([{text:'Dr. Sara Salem',options:{bold:true,breakLine:true}},{text:'Creator & instructor — AI Finance Expert',options:{breakLine:true}},{text:'د. سارة سالم — صانعة المحتوى والمدرّبة'}],{x:0.6,y:5.2,w:7,h:1.3,fontFace:'Arial',fontSize:16,color:'FFFFFF',isTextBox:true,margin:0});
s.addImage({data:QRL,x:9.4,y:1.9,w:1.6,h:1.6});s.addText('LinkedIn',{x:9.4,y:3.55,w:1.6,h:0.3,fontSize:11,color:'C7D1E2',align:'center',isTextBox:true,margin:0});
s.addImage({data:QRP,x:11.2,y:1.9,w:1.6,h:1.6});s.addText('Platform',{x:11.2,y:3.55,w:1.6,h:0.3,fontSize:11,color:'C7D1E2',align:'center',isTextBox:true,margin:0});}
// 2 Map
{const s=S();title(s,'The Claude mastery map','خريطة إتقان Claude');const st=[['01','Foundation','Prompting, context, styles'],['02','Workflow','Projects, chaining, research, artifacts'],['03','Power features','Skills, connectors, MCP, Claude Code'],['04','Agents','Tools, loops, subagents, human-in-the-loop'],['05','Claude Code','CLAUDE.md, hooks, plugins, multi-agent'],['06','AI employees','Research, content, sales, support, finance'],['07','Build with Claude','Systems, products, mini-ERP, SaaS']];
st.forEach((x,i)=>{const c=i%4,r=Math.floor(i/4);card(s,0.5+c*3.15,1.9+r*2.5,2.95,2.25,x[1],x[2],x[0])});foot(s,n);}
// 3 Surfaces
{const s=S();title(s,'Claude is a set of tools, not one chatbot','Claude مجموعة أدوات مش شات بوت');
const g=[['Claude app','Chat + Cowork in one, Projects, memory, styles'],['Deliverables','Artifacts, Docs, Slides, Design, real files'],['Where you work','Excel, PowerPoint, Word, Outlook, Chrome, Slack'],['Extend','Skills, Plugins, Connectors (MCP)'],['Build','Claude Code, API, Agent SDK, Managed Agents'],['Govern','Team/Enterprise controls, audit, retention']];
g.forEach((x,i)=>card(s,0.5+(i%3)*4.15,1.9+Math.floor(i/3)*2.5,3.95,2.2,x[0],x[1],String(i+1)));foot(s,n);}
// 4 Models
{const s=S();title(s,'Choosing the right model','اختيار الموديل الصح');
const rows=[['Model','Context','API $ in/out per M','Use it for'],['Haiku 4.5','200K','1 / 5','High-volume, low-risk tasks'],['Sonnet 5.5','1M','2 / 10','Everyday default'],['Opus 5.5','1M','4 / 20','Complex models, long agentic work'],['Fable 5.1','1M','10 / 50','Hardest reasoning']];
s.addTable(rows.map((r,i)=>r.map(c=>({text:c,options:{bold:i===0,color:i===0?'FFFFFF':INK,fill:{color:i===0?NAVY:(i%2?'FFFFFF':'EEF2F7')},fontSize:14,fontFace:'Arial'}}))),{x:0.5,y:1.95,w:8.2,colW:[1.8,1.2,2.1,3.1],rowH:0.6,border:{type:'solid',pt:0.5,color:'DDE3EC'}});
s.addText([{text:'Rule of thumb',options:{bold:true,breakLine:true,color:NAVY,fontSize:16}},{text:'Start with Sonnet → Opus when nuance or many files matter → Fable only if Opus falls short → Haiku for bulk.',options:{fontSize:14,color:INK}}],{x:9.1,y:1.95,w:3.7,h:3.2,fontFace:'Arial',isTextBox:true,margin:0.15,fill:{color:'FFF7E0'}});
s.addText('Prices and status as of Sept 2026 — verify on claude.com/pricing.',{x:0.5,y:5.4,w:8,h:0.3,fontSize:10,color:MUT,italic:true,isTextBox:true,margin:0});foot(s,n);}
// 5 Six elements
{const s=S();title(s,'The 6-element master prompt','البرومبت الماستر بالعناصر الستة');
const e=[['Role','Who should Claude be?'],['Task','One clear deliverable'],['Context','Facts it can\'t guess'],['Reasoning','The decision it supports'],['Stop conditions','What "done" looks like'],['Output format','Table, memo, xlsx, language, length']];
e.forEach((x,i)=>{const c=i%3,r=Math.floor(i/3);const X=0.5+c*4.15,Y=1.95+r*1.6;circ(s,X,Y+0.1,String(i+1),i%2?TEAL:GOLD);s.addText([{text:x[0],options:{bold:true,color:NAVY,fontSize:17,breakLine:true}},{text:x[1],options:{color:INK,fontSize:13}}],{x:X+0.8,y:Y,w:3.2,h:1.1,fontFace:'Arial',isTextBox:true,margin:0,valign:'middle'})});
s.addText('Controls: ask up to 3 questions first · label assumptions · never invent numbers · verify against sources · mark items for human review',{x:0.5,y:5.4,w:12.3,h:0.8,fontFace:'Arial',fontSize:13,color:NAVY,fill:{color:'E6EEF8'},isTextBox:true,margin:0.15});foot(s,n);}
// 6 Workflow 8 steps
{const s=S();title(s,'The professional prompt workflow','طريقة البرومبت الاحترافي');
const st=['Define the decision','Name the deliverable','Collect the context','Assign the role','Write the 6 blocks','Add controls','Test & score','Save as template / Skill'];
st.forEach((x,i)=>{const c=i%4,r=Math.floor(i/4);const X=0.5+c*3.15,Y=2.0+r*2.0;circ(s,X,Y,String(i+1),NAVY);s.addText(x,{x:X+0.75,y:Y,w:2.3,h:0.62,fontFace:'Arial',fontSize:15,bold:true,color:INK,valign:'middle',isTextBox:true,margin:0});if(c<3)s.addText('→',{x:X+2.85,y:Y,w:0.3,h:0.62,fontSize:18,color:GOLD,isTextBox:true,margin:0})});foot(s,n);}
// 7 Tokens
{const s=S();title(s,'Context & tokens','السياق والتوكنز — وفّر وحافظ على الجودة');
const h=[['One task = one chat','Start fresh; use a hand-off summary'],['Edit, don\'t stack','Fix the original prompt'],['Short outputs','"Table only", "max 200 words"'],['Lean Projects','Stable references only'],['Skills over repetition','Load only when needed'],['Right model & effort','Sonnet default; Haiku for bulk']];
h.forEach((x,i)=>card(s,0.5+(i%3)*4.15,1.9+Math.floor(i/3)*2.4,3.95,2.1,x[0],x[1],String(i+1)));foot(s,n);}
// 8 Skill vs Project vs Plugin
{const s=S();title(s,'Project vs Skill vs Plugin','Project مقابل Skill مقابل Plugin');
[['Project','Context for one body of work','Monthly FP&A pack, LC desk, thesis'],['Skill','A method usable anywhere','LC doc checker, Arabic finance report'],['Plugin','A bundle for a role','Finance plugin: /reconciliation, /variance-analysis']].forEach((x,i)=>{card(s,0.5+i*4.15,1.95,3.95,3.6,x[0],x[1]+'\n\nExample: '+x[2])});foot(s,n);}
// 9 MCP security
{const s=S();title(s,'MCP security controls','ضوابط أمان MCP');
[['Authentication','OAuth per user; no shared keys'],['Authorization','User\'s own permissions enforced server-side'],['Tool scoping','Read-only first; no free-text SQL'],['Sandboxing','Isolated runtimes; copies only'],['Auditing','Log every tool call; monthly review'],['Human approval','Drafts only until approved']].forEach((x,i)=>card(s,0.5+(i%3)*4.15,1.9+Math.floor(i/3)*2.4,3.95,2.1,x[0],x[1],String(i+1)));foot(s,n);}
// 10 Excel
{const s=S();title(s,'Excel with AI — 14 use cases','Excel بالذكاء الاصطناعي — 14 حالة مالية');
const L1=['Explain an inherited model','Trace a number to its source','Fix formula errors','3-statement model','DCF with country risk','FX scenarios without breaking links','Budget vs actual + commentary'],L2=['13-week cash flow','Clean messy exports','Pivot & chart pack','Ratios & DuPont','Credit spreading','Headcount & payroll','Workbook → board deck'];
[L1,L2].forEach((L,j)=>s.addText(L.map((t,i)=>({text:t,options:{bullet:true,breakLine:i<L.length-1}})),{x:0.5+j*4.3,y:1.95,w:4.1,h:4.4,fontFace:'Arial',fontSize:15,color:INK,paraSpaceAfter:8,isTextBox:true,margin:0}));
s.addText([{text:'Rules',options:{bold:true,color:NAVY,breakLine:true}},{text:'Formulas, not values · change log · check one row per block · keep a version copy',options:{color:INK}}],{x:9.3,y:1.95,w:3.5,h:2.6,fontFace:'Arial',fontSize:14,fill:{color:'FFF7E0'},isTextBox:true,margin:0.15});foot(s,n);}
// 11 Agent 8 steps
{const s=S();title(s,'Build a real AI agent — 8 steps','ابني وكيل AI حقيقي — 8 خطوات');
['Define ONE job','Give it a brain','Add tools','Build the agentic loop','Add knowledge + memory','Add MCP','Add Skills','Keep human approval'].forEach((x,i)=>card(s,0.5+(i%4)*3.15,1.9+Math.floor(i/4)*2.4,2.95,2.1,x,['Research, sales, content, support','Role + goal + rules + constraints','Search, code, files, APIs, browser','Goal→Plan→Tool→Result→Review→Repeat','Files, SOPs, past work','Drive, Gmail, CRM, ERP','Reusable expertise','Prepare; you approve'][i],String(i+1)));foot(s,n);}
// 12 Architecture
{const s=S();title(s,'Agent architecture','معمارية الوكيل');
const f=['GOAL','CLAUDE','TOOLS + KNOWLEDGE\n+ SKILLS + MCP','AGENTIC LOOP','REVIEW','RESULT'];
f.forEach((x,i)=>{const X=0.5+i*2.1;s.addShape(pres.shapes.ROUNDED_RECTANGLE,{x:X,y:2.6,w:1.85,h:1.4,fill:{color:i===1?NAVY:(i===5?TEAL:'FFFFFF')},line:{color:i===1?NAVY:'C9D3E1'},rectRadius:0.12});s.addText(x,{x:X,y:2.6,w:1.85,h:1.4,fontFace:'Arial',fontSize:13,bold:true,color:(i===1||i===5)?'FFFFFF':NAVY,align:'center',valign:'middle',isTextBox:true,margin:0.05});if(i<5)s.addText('→',{x:X+1.85,y:3.0,w:0.25,h:0.5,fontSize:18,color:GOLD,isTextBox:true,margin:0})});
s.addText("Don't build a chatbot that answers. Build an agent that completes a job.",{x:0.5,y:4.7,w:12.3,h:0.7,fontFace:'Cambria',fontSize:22,italic:true,color:NAVY,align:'center',isTextBox:true,margin:0});
s.addText('Managed Agents (beta) can host model, system prompt, tools, MCP servers and Skills as one reusable agent.',{x:0.5,y:5.5,w:12.3,h:0.5,fontFace:'Arial',fontSize:13,color:MUT,align:'center',isTextBox:true,margin:0});foot(s,n);}
// 13 Claude Code
{const s=S();title(s,'Claude Code essentials','أساسيات Claude Code');
const rows=[['Command','What it does'],['/init','Create CLAUDE.md'],['/plan','Plan before editing'],['/compact','Summarise context (~70%)'],['/context','See context usage'],['/mcp · /agents','Connectors · subagents'],['/permissions · /hooks','Approval rules · automation'],['/rewind','Roll back to a checkpoint']];
s.addTable(rows.map((r,i)=>r.map(c=>({text:c,options:{bold:i===0,color:i===0?'FFFFFF':INK,fill:{color:i===0?NAVY:(i%2?'FFFFFF':'EEF2F7')},fontSize:14,fontFace:i===0||!c.startsWith('/')?'Arial':'Courier New'}}))),{x:0.5,y:1.95,w:7.5,colW:[3,4.5],rowH:0.5,border:{type:'solid',pt:0.5,color:'DDE3EC'}});
s.addText([{text:'Golden rule',options:{bold:true,color:NAVY,breakLine:true}},{text:'Clear plan + clean context + continuous review = great results.',options:{color:INK}}],{x:8.5,y:1.95,w:4.3,h:2.2,fontFace:'Arial',fontSize:16,fill:{color:'FFF7E0'},isTextBox:true,margin:0.15});foot(s,n);}
// 14 Mini-ERP
{const s=S();title(s,'Mini-ERP — build in 6 phases','Mini-ERP — البناء على 6 مراحل');
['Spec','Artifact prototype','Production app','Accounting engine & tests','MCP server','AI assistant & governance'].forEach((x,i)=>{const X=0.5+i*2.1;circ(s,X+0.6,2.1,String(i+1),i%2?TEAL:GOLD);s.addText(x,{x:X,y:2.85,w:1.95,h:1.0,fontFace:'Arial',fontSize:14,bold:true,color:NAVY,align:'center',isTextBox:true,margin:0})});
s.addText('Every phase has a full master prompt in the platform (Deep dives → API, agents & mini-ERP).',{x:0.5,y:4.6,w:12.3,h:0.5,fontFace:'Arial',fontSize:14,color:INK,align:'center',isTextBox:true,margin:0});foot(s,n);}
// 15 Stats
{const s=S();title(s,'What is inside the platform','إيه اللي جوه المنصة');
[['11','modules'],['47','lessons'],['460+','master prompts'],['26','dummy datasets'],['23','field tracks'],['5','company cases A–Z']].forEach((x,i)=>{const X=0.5+(i%3)*4.15,Y=1.9+Math.floor(i/3)*2.3;s.addText(x[0],{x:X,y:Y,w:3.9,h:1.2,fontFace:'Cambria',fontSize:60,bold:true,color:i%2?TEAL:NAVY,isTextBox:true,margin:0});s.addText(x[1],{x:X,y:Y+1.2,w:3.9,h:0.5,fontFace:'Arial',fontSize:16,color:MUT,isTextBox:true,margin:0})});foot(s,n);}
// 16 Governance
{const s=S();title(s,'Responsible AI & governance','الذكاء الاصطناعي المسؤول والحوكمة');
const p=['Accountability — a named owner','Accuracy — verify numbers & references','Transparency — disclose AI use','Fairness — no AI-only people decisions','Privacy — minimum, anonymised data','Security — least privilege, supervised agents','Human oversight — approve impact','Integrity — no invented references'];
s.addText(p.map((t,i)=>({text:t,options:{bullet:true,breakLine:i<p.length-1}})),{x:0.5,y:1.95,w:7.2,h:4.6,fontFace:'Arial',fontSize:16,color:INK,paraSpaceAfter:8,isTextBox:true,margin:0});
[['Low','Drafting, internal summaries → self-review','DCEFE3'],['Medium','Analysis used in decisions → peer review','FFF1CC'],['High','Customers, credit, people, regulators → documented approval + audit','F5DDDD']].forEach((x,i)=>s.addText([{text:x[0]+' risk',options:{bold:true,breakLine:true,color:NAVY}},{text:x[1],options:{color:INK}}],{x:8.2,y:1.95+i*1.5,w:4.6,h:1.3,fontFace:'Arial',fontSize:13,fill:{color:x[2]},isTextBox:true,margin:0.12}));foot(s,n);}
// 17 90-day plan
{const s=S();title(s,'Your 90-day plan','خطتك لـ 90 يوم');
[['Days 1–30','Foundations','Daily use · 6-element prompts · first Project'],['Days 31–60','Expansion','First Skill · Excel add-in · two connectors'],['Days 61–90','Mastery','Cowork automation · team Skill/Plugin · ROI report']].forEach((x,i)=>card(s,0.5+i*4.15,1.95,3.95,3.4,x[0]+' · '+x[1],x[2],String(i+1)));
s.addText('Daily question: "Which task today could Claude take half of?"',{x:0.5,y:5.7,w:12.3,h:0.5,fontFace:'Cambria',fontSize:18,italic:true,color:NAVY,align:'center',isTextBox:true,margin:0});foot(s,n);}
// 17b New content
{const s=S();title(s,'Prompt failures clinic','عيادة أخطاء البرومبت');
const r=[['Failure','Symptom','Fix in the prompt'],['Made-up numbers','Totals not in the file','“Use only the attached file; cite sheet and row”'],['Missed constraint','900 words instead of 200','Limits as a checklist in <stop_when>'],['Wrong format','Prose instead of a table','Show one example row or a JSON skeleton'],['Ignored file part','Summary of pages 1–10 only','Documents first, question last; list every section'],['Over-confident advice','Firm legal or tax answer','Options with risks; flag for a qualified reviewer'],['Stale facts','Old rates stated as current','Give date and source; label what is unconfirmed'],['Language drift','Arabic turns into English','State language, dialect and English terms']];
s.addTable(r.map((row,i)=>row.map(c=>({text:c,options:{bold:i===0,color:i===0?'FFFFFF':INK,fill:{color:i===0?NAVY:(i%2?'FFFFFF':'EEF2F7')}}}))),{x:0.5,y:1.85,w:12.3,colW:[2.6,3.6,6.1],fontFace:'Arial',fontSize:13,border:{type:'solid',pt:0.5,color:'DDE3EC'},rowH:0.55});foot(s,n);}
{const s=S();title(s,'One job, six Claude tools','شغلانة واحدة بست أدوات');
[['Chat','One-off, a few files'],['Project','Same job monthly, same references'],['Skill','A reusable method for the team'],['Cowork','Many steps across files, review at the end'],['Claude in Excel','The work lives in a workbook'],['API','Runs on a schedule inside a system']].forEach((x,i)=>card(s,0.5+(i%3)*4.15,1.9+Math.floor(i/3)*2.45,3.95,2.2,x[0],x[1],String(i+1)));
s.addText('Worked jobs: month-end close commentary · weekly sales pipeline review — each written six ways.',{x:0.5,y:6.55,w:12.3,h:0.4,fontFace:'Arial',fontSize:13,italic:true,color:NAVY,isTextBox:true,margin:0});foot(s,n);}
{const s=S();title(s,'Module 10 · Claude for Arabic content','Claude للمحتوى العربي');
[['Register & dialect','MSA for boards and print; Egyptian or Gulf for posts — give one example sentence'],['Translate & localise','Locked glossary, terms table, back-translation in a new chat'],['Check Arabic outputs','Agreement, numbers, mixed direction, names, register drift'],['Files & layouts','Quote what was read; RTL tables; check the final file']].forEach((x,i)=>card(s,0.5+(i%2)*6.2,1.9+Math.floor(i/2)*2.45,6.0,2.2,x[0],x[1],String(i+1)));foot(s,n);}
{const s=S();title(s,'Audit, compliance & the Egypt / GCC pack','المراجعة والامتثال وحزمة لوائح مصر والخليج');
card(s,0.5,1.9,6.0,4.6,'Claude for audit','• Evidence trail: every statement points to a document, sheet and row\n• Sampling: Claude explains the approach; selection is reproducible\n• Sign-off: a named reviewer approves every output\n• Master prompts: control test worksheet, sampling rationale, gap analysis','1');
card(s,6.8,1.9,6.0,4.6,'Regulations pack','Paste the current official text — never rely on memory.\n• Egypt: e-invoice & e-receipt, VAT, labour law, CBE circulars, data protection\n• KSA: ZATCA e-invoicing, zakat, VAT, SAMA, data protection\n• UAE: VAT, corporate tax, CBUAE, labour law, data protection','2');foot(s,n);}
{const s=S();title(s,'Module 11 · Family business & SMEs','الشركات العائلية والصغيرة');
[['Small team, no IT','One plan, three Projects, a one-page AI policy, a template owner'],['Family governance','Charter options, board minutes, succession criteria'],['SME money','13-week cash view, collection messages, pricing check'],['Selling on a budget','Catalogue texts, a month of posts, quick replies in dialect']].forEach((x,i)=>card(s,0.5+(i%2)*6.2,1.9+Math.floor(i/2)*2.45,6.0,2.2,x[0],x[1],String(i+1)));foot(s,n);}
{const s=S();title(s,'Field library, tracks & projects','مكتبة المجالات والمسارات والمشروعات');
[['23 fields × 4 tasks','Daily, weekly, monthly, yearly master prompts with sample data and example outputs'],['Field tracks','Lessons, prompts, cases and data per field — with a track certificate'],['Module projects','One real deliverable per module, graded with Claude on a 4-part rubric'],['Company cases A–Z','HR, sales, procurement, legal, operations — problem to measured result']].forEach((x,i)=>card(s,0.5+(i%2)*6.2,1.9+Math.floor(i/2)*2.45,6.0,2.2,x[0],x[1],String(i+1)));foot(s,n);}
// 18 Closing
{const s=pres.addSlide();n++;s.background={color:NAVY};
s.addText('Let\'s build with Claude',{x:0.6,y:1.2,w:8,h:1,fontFace:'Cambria',fontSize:44,bold:true,color:'FFFFFF',isTextBox:true,margin:0});
s.addText('يلا نبني مع Claude',{x:0.6,y:2.2,w:8,h:0.7,fontFace:'Arial',fontSize:26,color:'F1D27A',rtlMode:true,lang:'ar-EG',align:'left',isTextBox:true,margin:0});
s.addText([{text:'Dr. Sara Salem',options:{bold:true,breakLine:true}},{text:'Creator & instructor — AI Finance Expert',options:{breakLine:true}},{text:'linkedin.com/in/sara-salem-57629b226'}],{x:0.6,y:3.6,w:8,h:1.5,fontFace:'Arial',fontSize:17,color:'FFFFFF',isTextBox:true,margin:0});
s.addImage({data:QRL,x:9.2,y:1.4,w:1.8,h:1.8});s.addText('Connect on LinkedIn',{x:9.0,y:3.25,w:2.2,h:0.3,fontSize:11,color:'C7D1E2',align:'center',isTextBox:true,margin:0});
s.addImage({data:QRP,x:11.2,y:1.4,w:1.8,h:1.8});s.addText('Open the platform',{x:11.0,y:3.25,w:2.2,h:0.3,fontSize:11,color:'C7D1E2',align:'center',isTextBox:true,margin:0});}
pres.writeFile({fileName:process.env.DECK_OUT||'Claude-Mastery-Deck.pptx'}).then(f=>console.log('ok',f));
