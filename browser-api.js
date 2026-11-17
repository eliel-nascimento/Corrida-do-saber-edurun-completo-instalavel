// Substituto usado APENAS quando a página é aberta direto no navegador (sem Electron),
// para testes de interface. No aplicativo instalado, window.api vem do preload.js
// e este arquivo não faz nada. Aqui os dados ficam no localStorage e a senha NÃO é protegida.
(() => {
  if (window.api) return;
  const LET = ['A', 'B', 'C', 'D'];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const LS = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
    del: (k) => { try { localStorage.removeItem(k); } catch (_) {} }
  };
  const merge = (b, e) => {
    const out = clone(b);
    for (const k of Object.keys(e || {})) {
      out[k] = e[k] && typeof e[k] === 'object' && !Array.isArray(e[k]) && out[k] ? Object.assign({}, out[k], e[k]) : e[k];
    }
    return out;
  };
  const cfg = () => merge(DEFAULT_CONFIG, LS.get('cds_cfg', {}));
  const pub = () => { const c = cfg(); c._aiLive = false; c._hasKey = false; delete c.ai.apiKey; return c; };
  const qs = () => LS.get('cds_q', null) || clone(window.QUESTIONS);
  let authed = false;
  const need = (fn) => async (...a) => (authed ? fn(...a) : { ok: false, error: 'Acesso negado.' });

  window.__browserApi = {
    isBrowser: true,
    getConfig: async () => pub(),
    getQuestions: async () => qs(),
    log: async (e) => { const a = LS.get('cds_events', []); a.push(e); LS.set('cds_events', a); return true; },
    askAI: async (q) => {
      await sleep(900);
      const wrong = Math.random() < cfg().ai.simulatedErrorRate;
      let idx = q.correct;
      if (wrong) { const o = [0, 1, 2, 3].filter((i) => i !== q.correct); idx = o[Math.floor(Math.random() * o.length)]; }
      return { ok: true, letter: LET[idx], explanation: 'Resposta gerada em modo de teste (IA simulada).', latencyMs: 900, source: 'simulado' };
    },
    adminStatus: async () => ({ configured: !!LS.get('cds_pw', null), authed }),
    adminSetup: async (pw) => {
      if (LS.get('cds_pw', null)) return { ok: false, error: 'A senha já foi criada.' };
      if (typeof pw !== 'string' || pw.length < 6) return { ok: false, error: 'A senha precisa ter pelo menos 6 caracteres.' };
      LS.set('cds_pw', pw); authed = true; return { ok: true };
    },
    adminLogin: async (pw) => {
      if (pw === LS.get('cds_pw', null)) { authed = true; return { ok: true }; }
      await sleep(300); return { ok: false, error: 'Senha incorreta.' };
    },
    adminLogout: async () => { authed = false; return { ok: true }; },
    adminChangePassword: need(async (o, n) => {
      if (o !== LS.get('cds_pw', null)) return { ok: false, error: 'Senha atual incorreta.' };
      if (typeof n !== 'string' || n.length < 6) return { ok: false, error: 'A nova senha precisa ter pelo menos 6 caracteres.' };
      LS.set('cds_pw', n); return { ok: true };
    }),
    adminGetConfig: need(async () => ({ ok: true, config: pub() })),
    adminSaveConfig: need(async (p) => {
      const next = merge(cfg(), p || {});
      if (next.ai) delete next.ai.apiKey;
      LS.set('cds_cfg', next); return { ok: true, config: pub() };
    }),
    adminSaveQuestions: need(async (arr) => {
      if (!Array.isArray(arr) || !arr.length) return { ok: false, error: 'Inclua pelo menos uma pergunta.' };
      LS.set('cds_q', arr); return { ok: true, questions: arr };
    }),
    adminResetQuestions: need(async () => { LS.del('cds_q'); return { ok: true, questions: clone(window.QUESTIONS) }; }),
    adminReadEvents: need(async () => ({ ok: true, events: LS.get('cds_events', []) })),
    adminClearEvents: need(async () => { LS.del('cds_events'); return { ok: true, archived: null }; }),
    adminSaveCsv: need(async (text) => {
      const b = new Blob(['﻿' + text], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = 'corrida-do-saber-dados.csv'; a.click();
      return { ok: true };
    }),
    adminOpenData: need(async () => ({ ok: true }))
  };
})();
