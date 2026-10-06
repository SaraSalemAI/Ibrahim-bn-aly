import { useState } from 'react';
import { useApp } from '../state';
import { answer, SUGGESTED, type CopilotAnswer } from '../engine/copilot';
import { Card, Tag } from '../ui/kit';

export function Copilot() {
  const { t, tl, analysis, settings, setNav, go, log_ } = useApp();
  const [q, setQ] = useState('');
  const [hist, setHist] = useState<{ q: string; a: CopilotAnswer }[]>([]);
  const ask = (text: string) => { if (!text.trim()) return; const a = answer(text, analysis, settings); setHist((h) => [...h, { q: text, a }]); setQ(''); log_('COPILOT_QUERY', 'copilot', text); };
  const open = (r: CopilotAnswer['refs'][number]) => {
    if (r.kind === 'finding') setNav({ findingId: r.id });
    else if (r.kind === 'risk') { setNav({ riskId: r.id }); go('risks'); }
    else if (r.kind === 'control') { setNav({ controlId: r.id }); go('controls'); }
    else if (analysis.findingById[`F-${r.id}`]) setNav({ findingId: `F-${r.id}` });
  };
  return (
    <>
      <div className="banner info small"><Tag kind="ai" /> {tl({ en: 'The copilot answers only from computed results of your uploaded data and cites the findings, risks, controls or tests behind each answer. It does not generate figures or use outside knowledge.', ar: 'يجيب المساعد فقط من النتائج المحتسبة لبياناتك المرفوعة ويستشهد بالملاحظات أو المخاطر أو الضوابط أو الاختبارات. لا يولّد أرقامًا ولا يستخدم معرفة خارجية.' })}</div>
      <Card title={t('copilot')}>
        <div className="row">{SUGGESTED.map((s) => <button key={s.en} className="btn sm" onClick={() => ask(tl(s))}>{tl(s)}</button>)}</div>
        <div className="sep" />
        <div className="chat">
          {hist.map((h, i) => (
            <div key={i} className="stack">
              <div className="msg q">{h.q}</div>
              <div className="msg a">
                <b>{tl(h.a.title)}</b> {h.a.insufficient && <span className="insufficient small">{t('insufficient')}</span>}
                <ul>{h.a.lines.map((l, j) => <li key={j}>{tl(l)}</li>)}</ul>
                {h.a.refs.length > 0 && <div className="row small" style={{ marginTop: 6 }}><b>{t('source')}:</b>{h.a.refs.map((r) => <button key={r.kind + r.id} className="btn sm" onClick={() => open(r)}>{r.id}</button>)}{h.a.refs.some((r) => r.kind === 'finding') && <button className="btn sm evidence-btn" onClick={() => { const f = h.a.refs.find((r) => r.kind === 'finding')!; setNav({ evidence: { findingId: f.id, index: 0 } }); }}>{t('showEvidence')}</button>}</div>}
                <div className="small muted">{t('confidence')}: {h.a.confidence}</div>
              </div>
            </div>
          ))}
        </div>
        <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <input className="inp" style={{ flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('askPlaceholder')} />
          <button className="btn primary" type="submit">{t('ask')}</button>
        </form>
      </Card>
    </>
  );
}
