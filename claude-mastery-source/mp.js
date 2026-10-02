const MPen=(r,t,c,re,s,o)=>`<role>${r}</role>
<task>${t}</task>
<context>
${c}
</context>
<reasoning>${re}</reasoning>
<stop_when>
${s}
</stop_when>
<output_format>
${o}
</output_format>
Before you start: restate the task in one line, ask up to 3 clarifying questions, and label every assumption.
Before you finish: check every number against its source, mark anything that needs human review, and end with the 3 next steps.`;
const MPar=(r,t,c,re,s,o)=>`<role>${r}</role>
<task>${t}</task>
<context>
${c}
</context>
<reasoning>${re}</reasoning>
<stop_when>
${s}
</stop_when>
<output_format>
${o}
</output_format>
قبل ما تبدأ: اعد صياغة المهمة في سطر، واسألني لحد 3 أسئلة توضيحية، وعلّم على كل افتراض.
قبل ما تخلّص: راجع كل رقم على مصدره، وعلّم على أي حاجة محتاجة مراجعة بشرية، واختم بأهم 3 خطوات جاية.`;
const CM=(t,ta,tool,d,da,s,sa,en,ar)=>({t:T(t,ta),tool,d:T(d,da),steps:T(s,sa),p:T(MPen(...en),MPar(...ar)),master:true});
