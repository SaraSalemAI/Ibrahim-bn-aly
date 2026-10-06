/* SUMED P2P — state store, session/permissions, immutable audit trail, persistence. */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = S.util;
  const LS_WS = 'sumed.p2p.workspace.v1';
  const LS_PREF = 'sumed.p2p.prefs.v1';

  const emptyData = () => Object.fromEntries(S.entityOrder.map((k) => [k, []]));

  S.state = {
    mode: 'empty', // 'empty' | 'demo' | 'live'
    data: emptyData(),
    sources: [], // uploaded files & sheets with classification
    ocrDocs: [], // OCR / text-extraction results with field confidences
    config: S.defaultConfig(),
    roles: S.defaultRoles(),
    session: { userId: 'local.admin', name: 'Local Administrator', role: 'System Administrator', sessionId: U.uid('sess'), startedAt: new Date().toISOString() },
    audit: [],
    revealLog: [],
    prefs: { lang: 'en', theme: 'auto', route: 'dashboard' },
    persistWarning: null,
  };

  /* ---------------- Listeners ---------------- */
  const listeners = new Set();
  S.on = (fn) => listeners.add(fn);
  S.emit = (what) => listeners.forEach((fn) => { try { fn(what); } catch (e) { console.error(e); } });

  /* ---------------- Session & permissions ---------------- */
  S.can = (perm) => {
    const perms = S.state.roles[S.state.session.role] || [];
    if (perms.includes(perm)) return true;
    if (perm.startsWith('view.') && perms.includes('view.all') && perm !== 'view.sensitive' && perm !== 'view.audit') return true;
    if (perm === 'view.audit' && (perms.includes('view.all'))) return true; // read-only audit view for all view.all roles
    return false;
  };
  S.setSession = (user) => {
    const prev = S.state.session;
    S.state.session = { userId: user.userId, name: user.name, role: user.role, sessionId: U.uid('sess'), startedAt: new Date().toISOString() };
    S.audit('session.switch', 'session', user.userId, { field: 'role', oldValue: prev.role + ' / ' + prev.userId, newValue: user.role + ' / ' + user.userId });
    S.emit('session');
  };
  /** Display a sensitive value: masked unless the role holds view.sensitive AND it was explicitly revealed. */
  S.sensitive = (value, key) => {
    if (U.isBlank(value)) return null;
    if (S.can('view.sensitive') && S.state.revealLog.some((r) => r.key === key && r.sessionId === S.state.session.sessionId)) return String(value);
    return U.maskAccount(value);
  };
  S.reveal = (key, reason) => {
    if (!S.can('view.sensitive')) return false;
    S.state.revealLog.push({ key, sessionId: S.state.session.sessionId, at: new Date().toISOString() });
    S.audit('sensitive.reveal', 'bank-detail', key, { reason: reason || 'Operational need' });
    return true;
  };

  /* ---------------- Audit trail (append-only, hash-chained, frozen) ---------------- */
  const entryPayload = (e) => [e.seq, e.ts, e.userId, e.role, e.sessionId, e.action, e.entity, e.recordId, e.field, JSON.stringify(e.oldValue ?? null), JSON.stringify(e.newValue ?? null), e.reason || '', e.prevHash].join('|');
  S.audit = (action, entity, recordId, extra = {}) => {
    const log = S.state.audit;
    const prev = log[log.length - 1];
    const ses = S.state.session;
    const e = {
      seq: log.length + 1,
      ts: new Date().toISOString(),
      userId: ses.userId, userName: ses.name, role: ses.role, sessionId: ses.sessionId,
      client: typeof navigator !== 'undefined' ? (navigator.userAgent || '').slice(0, 80) : 'node',
      ip: 'Not Available in Source Data', // a browser cannot see its own public IP; supplied by server in ERP deployment
      action, entity, recordId: recordId == null ? null : String(recordId),
      field: extra.field || null, oldValue: extra.oldValue ?? null, newValue: extra.newValue ?? null,
      reason: extra.reason || null,
      prevHash: prev ? prev.hash : '0'.repeat(16),
    };
    e.hash = U.hash(entryPayload(e));
    log.push(Object.freeze(e));
    S.persistSoon();
    return e;
  };
  S.verifyAudit = () => {
    const log = S.state.audit;
    for (let i = 0; i < log.length; i++) {
      const e = log[i];
      const expPrev = i ? log[i - 1].hash : '0'.repeat(16);
      if (e.prevHash !== expPrev || U.hash(entryPayload(e)) !== e.hash || e.seq !== i + 1) return { ok: false, brokenAt: i + 1, total: log.length };
    }
    return { ok: true, total: log.length };
  };

  /* ---------------- Record mutation through workflow only ---------------- */
  /** Change a field on a record; logs old/new to the audit trail and keeps edit lineage on the record. */
  S.updateRecord = (entity, rec, field, value, reason, action) => {
    const old = rec[field];
    if (old === value) return;
    rec[field] = value;
    rec._edits = rec._edits || {};
    rec._edits[field] = { old, new: value, by: S.state.session.userId, at: new Date().toISOString(), reason: reason || null };
    const pk = S.schema[entity] && S.schema[entity].pk;
    S.audit(action || entity + '.update', entity, pk ? rec[pk] : rec._key, { field, oldValue: old, newValue: value, reason });
  };
  S.addRecord = (entity, rec, action, reason) => {
    rec._key = rec._key || entity + ':' + (S.state.data[entity].length + 1) + ':' + U.uid('r').slice(-5);
    rec._origin = 'app';
    rec._demo = S.state.mode === 'demo';
    rec._src = rec._src || { file: 'Created in application', sheet: entity, row: null };
    S.state.data[entity].push(rec);
    const pk = S.schema[entity] && S.schema[entity].pk;
    S.audit(action || entity + '.create', entity, pk ? rec[pk] : rec._key, { newValue: pk ? rec[pk] : null, reason });
    return rec;
  };

  /* ---------------- Loading datasets ---------------- */
  S.resetData = (mode) => {
    S.state.data = emptyData();
    S.state.sources = [];
    S.state.ocrDocs = [];
    S.state.mode = mode || 'empty';
  };
  S.findRecord = (entity, id) => {
    const pk = S.schema[entity] && S.schema[entity].pk;
    return S.state.data[entity].find((r) => (pk && String(r[pk]) === String(id)) || r._key === id) || null;
  };

  /* ---------------- Persistence (best effort; never required) ---------------- */
  S.loadPrefs = () => {
    try {
      const p = JSON.parse(localStorage.getItem(LS_PREF) || 'null');
      if (p) Object.assign(S.state.prefs, p);
    } catch (e) { /* storage unavailable */ }
  };
  S.savePrefs = () => {
    try { localStorage.setItem(LS_PREF, JSON.stringify(S.state.prefs)); } catch (e) { /* ignore */ }
  };
  S.serialize = () => JSON.stringify({
    format: 'sumed-p2p-workspace', version: 1, savedAt: new Date().toISOString(),
    mode: S.state.mode, data: S.state.data, sources: S.state.sources, ocrDocs: S.state.ocrDocs,
    config: S.state.config, roles: S.state.roles, audit: S.state.audit, alertStatus: S.state.alertStatus || {},
  });
  S.deserialize = (json) => {
    const w = typeof json === 'string' ? JSON.parse(json) : json;
    if (!w || w.format !== 'sumed-p2p-workspace') throw new Error('Not a SUMED P2P workspace file');
    S.state.mode = w.mode;
    S.state.data = Object.assign(emptyData(), w.data);
    S.state.sources = w.sources || [];
    S.state.ocrDocs = w.ocrDocs || [];
    S.state.config = Object.assign(S.defaultConfig(), w.config || {});
    S.state.roles = Object.assign(S.defaultRoles(), w.roles || {});
    S.state.audit = (w.audit || []).map((e) => Object.freeze(e));
    S.state.alertStatus = w.alertStatus || {};
  };
  let tmr = null;
  S.persistSoon = () => {
    if (typeof window === 'undefined') return;
    clearTimeout(tmr);
    tmr = setTimeout(S.persist, 400);
  };
  S.persist = () => {
    try {
      const s = S.serialize();
      if (s.length > 4.5e6) { S.state.persistWarning = 'size'; return; }
      localStorage.setItem(LS_WS, s);
      S.state.persistWarning = null;
    } catch (e) { S.state.persistWarning = 'unavailable'; }
  };
  S.restore = () => {
    try {
      const s = localStorage.getItem(LS_WS);
      if (!s) return false;
      S.deserialize(s);
      return true;
    } catch (e) { return false; }
  };
  S.clearWorkspace = () => {
    try { localStorage.removeItem(LS_WS); } catch (e) { /* ignore */ }
  };
})(typeof window !== 'undefined' ? window : globalThis);
