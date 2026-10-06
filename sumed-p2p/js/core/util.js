/* SUMED P2P — core utilities (no dependencies). Classic script: attaches to window.SUMED */
(function (root) {
  'use strict';
  const S = (root.SUMED = root.SUMED || {});
  const U = (S.util = {});

  /* ---------- HTML ---------- */
  U.esc = (v) =>
    v == null ? '' : String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.attr = U.esc;

  /* ---------- Collections ---------- */
  U.sum = (arr, f) => arr.reduce((a, x) => a + (Number(f ? f(x) : x) || 0), 0);
  U.groupBy = (arr, f) => {
    const m = new Map();
    for (const x of arr) {
      const k = typeof f === 'function' ? f(x) : x[f];
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return m;
  };
  U.indexBy = (arr, f) => {
    const m = new Map();
    for (const x of arr) {
      const k = typeof f === 'function' ? f(x) : x[f];
      if (k != null && k !== '' && !m.has(k)) m.set(k, x);
    }
    return m;
  };
  U.uniq = (arr) => Array.from(new Set(arr));
  U.round = (n, d = 2) => (n == null || isNaN(n) ? null : Math.round(n * Math.pow(10, d)) / Math.pow(10, d));
  U.clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  U.isBlank = (v) => v == null || (typeof v === 'string' && v.trim() === '') || (typeof v === 'number' && isNaN(v));

  /* ---------- Numbers ---------- */
  const AR_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '٫': '.', '٬': ',' };
  U.normDigits = (s) => String(s).replace(/[٠-٩٫٬]/g, (c) => AR_DIGITS[c]);
  /** Parse a source number. Returns null (never 0) when not parseable. */
  U.parseNum = (v) => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = U.normDigits(String(v)).trim();
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[A-Za-z$€£¥\s]|ج\.?م\.?|جنيه/g, '');
    if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
    // 1.234.567,89 (EU) vs 1,234,567.89
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    if (!/^-?\d*\.?\d+(e-?\d+)?$/i.test(s)) return null;
    const n = parseFloat(s);
    if (!isFinite(n)) return null;
    return neg ? -Math.abs(n) : n;
  };
  U.parseBool = (v) => {
    if (v == null || v === '') return null;
    if (typeof v === 'boolean') return v;
    const s = String(v).trim().toLowerCase();
    if (['y', 'yes', 'true', '1', 'x', 'نعم', 'critical', 'strategic'].includes(s)) return true;
    if (['n', 'no', 'false', '0', 'لا', '-'].includes(s)) return false;
    return null;
  };

  /* ---------- Dates (ISO yyyy-mm-dd strings everywhere) ---------- */
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const pad = (n) => String(n).padStart(2, '0');
  U.isoFromParts = (y, m, d) => {
    y = +y; m = +m; d = +d;
    if (y < 100) y += 2000;
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1900 && y < 2200)) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  };
  /** order: 'DMY' (default, Egypt) or 'MDY' for ambiguous slash dates */
  U.parseDate = (v, order = 'DMY') => {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
    if (typeof v === 'number') {
      if (v > 20000 && v < 80000) { // Excel serial
        const ms = Math.round((v - 25569) * 86400000);
        const d = new Date(ms);
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      }
      return null;
    }
    const s = U.normDigits(String(v)).trim();
    let m;
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return U.isoFromParts(m[1], m[2], m[3]);
    if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) {
      const a = +m[1], b = +m[2];
      if (a > 12) return U.isoFromParts(m[3], b, a);
      if (b > 12) return U.isoFromParts(m[3], a, b);
      return order === 'MDY' ? U.isoFromParts(m[3], a, b) : U.isoFromParts(m[3], b, a);
    }
    if ((m = s.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,4})[A-Za-z]*[-\s/,]+(\d{2,4})$/))) {
      const mo = MONTHS[m[2].toLowerCase()];
      return mo ? U.isoFromParts(m[3], mo, m[1]) : null;
    }
    if ((m = s.match(/^([A-Za-z]{3,4})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})$/))) {
      const mo = MONTHS[m[1].toLowerCase()];
      return mo ? U.isoFromParts(m[3], mo, m[2]) : null;
    }
    return null;
  };
  U.toUTC = (iso) => (iso ? Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) : NaN);
  U.daysBetween = (a, b) => (a && b ? Math.round((U.toUTC(b) - U.toUTC(a)) / 86400000) : null); // b - a
  U.addDays = (iso, n) => {
    const d = new Date(U.toUTC(iso) + n * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  };
  U.dow = (iso) => new Date(U.toUTC(iso)).getUTCDay(); // 0=Sun..6=Sat
  U.month = (iso) => (iso ? iso.slice(0, 7) : null);
  U.quarter = (iso) => (iso ? `${iso.slice(0, 4)}-Q${Math.floor((+iso.slice(5, 7) - 1) / 3) + 1}` : null);
  U.year = (iso) => (iso ? iso.slice(0, 4) : null);
  U.todayISO = () => U.parseDate(new Date());
  U.startOfWeek = (iso) => U.addDays(iso, -((U.dow(iso) + 1) % 7)); // weeks start Saturday (Egypt working week Sun–Thu, weekend Fri–Sat)
  U.endOfMonth = (iso) => {
    const y = +iso.slice(0, 4), m = +iso.slice(5, 7);
    const d = new Date(Date.UTC(y, m, 0));
    return `${y}-${pad(m)}-${pad(d.getUTCDate())}`;
  };
  U.addMonths = (iso, n) => {
    let y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return `${y}-${pad(m + 1)}-01`;
  };

  /* ---------- Hashing (FNV-1a, deterministic, sync) ---------- */
  U.fnv = (str, seed = 0x811c9dc5) => {
    let h = seed >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  };
  U.hash = (str) => U.fnv(str).toString(16).padStart(8, '0') + U.fnv(str, 0x01234567).toString(16).padStart(8, '0');

  /* ---------- Seeded RNG for demo data ---------- */
  U.rng = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- Normalisation for matching ---------- */
  U.normInvNo = (v) => {
    if (v == null) return '';
    let s = U.normDigits(String(v)).toUpperCase().replace(/[^A-Z0-9]/g, '');
    s = s.replace(/^(INVOICE|INV|BILL|FAC|TAX)/, '');
    s = s.replace(/^0+(?=\d)/, '');
    return s;
  };
  const LEGAL = /\b(co|company|corp|corporation|ltd|limited|llc|inc|sae|s\.a\.e|plc|gmbh|sa|ag|group|for|and|the|&|trading|services)\b/g;
  U.normName = (v) =>
    v == null ? '' : String(v).toLowerCase().replace(/شركة|ش\.?م\.?م|ش\.?م\.?ع|للتجارة|والتوريدات/g, ' ').replace(/[.,'"()\-_/]/g, ' ').replace(LEGAL, ' ').replace(/\s+/g, ' ').trim();
  U.tokens = (s) => U.uniq(String(s || '').toLowerCase().split(/[^a-z0-9؀-ۿ]+/).filter((x) => x.length > 2));
  U.jaccard = (a, b) => {
    const A = new Set(U.tokens(a)), B = new Set(U.tokens(b));
    if (!A.size || !B.size) return 0;
    let i = 0;
    A.forEach((x) => B.has(x) && i++);
    return i / (A.size + B.size - i);
  };
  U.levRatio = (a, b) => {
    a = a || ''; b = b || '';
    if (!a.length && !b.length) return 1;
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return 1 - prev[n] / Math.max(m, n);
  };
  U.normIban = (v) => (v ? String(v).toUpperCase().replace(/\s+/g, '') : '');
  U.maskAccount = (v) => {
    const s = U.normIban(v);
    if (!s) return '';
    if (s.length <= 6) return '•'.repeat(s.length);
    return s.slice(0, 4) + ' •••• •••• ' + s.slice(-4);
  };
  /** Basic IBAN mod-97 checksum (ISO 13616). Returns true/false/null(unknown) */
  U.ibanValid = (v) => {
    const s = U.normIban(v);
    if (!s) return null;
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(s)) return false;
    const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    let mod = 0;
    for (let i = 0; i < r.length; i += 7) mod = parseInt(String(mod) + r.slice(i, i + 7), 10) % 97;
    return mod === 1;
  };

  /* ---------- CSV ---------- */
  U.parseCSV = (text) => {
    text = String(text).replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] || '';
    const cands = [',', ';', '\t', '|'];
    const delim = cands.reduce((best, d) => (first.split(d).length > first.split(best).length ? d : best), ',');
    const rows = [];
    let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { f += '"'; i++; } else q = false;
        } else f += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(f); rows.push(row); row = []; f = '';
      } else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
  };
  U.toCSV = (rows) =>
    '﻿' + rows.map((r) => r.map((v) => {
      const s = v == null ? '' : String(v);
      return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');

  U.download = (name, content, mime = 'text/plain;charset=utf-8') => {
    if (typeof document === 'undefined') return;
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    // Shared web view (claude.ai artifact): saves go through the viewer's confirmation prompt.
    if (root.SUMED_ARTIFACT && root.claude && root.claude.use) {
      const toast = (m, k) => root.SUMED.ui && root.SUMED.ui.toast(m, k);
      root.claude.use('downloads').then((dl) => {
        if (!dl) return toast(root.SUMED.t('dl.unavailable', 'File saving is not available in this view.'), 'error');
        return dl.save({ filename: name, data: blob }).catch((e) => { if (e && e.code !== 'declined') toast(root.SUMED.t('dl.failed', 'The file could not be saved ({c}).', { c: e.code || 'error' }), 'error'); });
      });
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    // Revoke late: revoking before the browser starts reading the blob silently cancels the download.
    setTimeout(() => a.remove(), 0);
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  };

  U.uid = (p = 'id') => p + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /** Lazy-load an external script once (used for optional parsers: SheetJS, pdf.js, Tesseract, JSZip, mammoth). */
  const loaded = {};
  /** Try local (vendored) copy first, then CDN fallbacks. */
  U.loadAny = async (srcs) => {
    let last;
    for (const s of [].concat(srcs)) { try { await U.loadScript(s); return s; } catch (e) { last = e; } }
    throw last || new Error('No source');
  };
  U.loadScript = (src) => {
    if (typeof document === 'undefined') return Promise.reject(new Error('no document'));
    if (!loaded[src]) {
      loaded[src] = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.async = true;
        if (/^https?:/i.test(src)) s.crossOrigin = 'anonymous'; // never on local/file:// paths (would trigger CORS)
        s.onload = () => res(true);
        s.onerror = () => { delete loaded[src]; rej(new Error('Failed to load ' + src)); };
        document.head.appendChild(s);
      });
    }
    return loaded[src];
  };
})(typeof window !== 'undefined' ? window : globalThis);
