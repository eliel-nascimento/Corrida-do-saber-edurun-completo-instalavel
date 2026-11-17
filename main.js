const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const DEFAULTS = require('./defaults.js');

// ---------- caminhos (no Windows: %APPDATA%\Corrida do Saber) ----------
const userDir = () => app.getPath('userData');
const cfgPath = () => path.join(userDir(), 'config.json');
const logPath = () => path.join(userDir(), 'events.jsonl');
const adminPath = () => path.join(userDir(), 'admin.json');
const questionsPath = () => path.join(userDir(), 'questions.json');
const ensureDir = () => fs.mkdirSync(userDir(), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- configuração ----------
function merge(base, extra) {
  const out = JSON.parse(JSON.stringify(base));
  for (const k of Object.keys(extra || {})) {
    if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && out[k] && typeof out[k] === 'object') {
      out[k] = Object.assign({}, out[k], extra[k]);
    } else {
      out[k] = extra[k];
    }
  }
  return out;
}

function loadConfig() {
  let user = {};
  try {
    user = JSON.parse(fs.readFileSync(cfgPath(), 'utf8'));
  } catch (_) {
    user = {};
  }
  return merge(DEFAULTS, user);
}

function publicConfig() {
  const cfg = loadConfig();
  const pub = JSON.parse(JSON.stringify(cfg));
  pub._aiLive = cfg.ai.provider === 'anthropic' && !!cfg.ai.apiKey;
  pub._hasKey = !!cfg.ai.apiKey;
  delete pub.ai.apiKey; // a chave nunca vai para a interface
  return pub;
}

function sanitizeConfig(p, cur) {
  const out = JSON.parse(JSON.stringify(cur));
  const num = (v, min, max, d) => {
    v = Number(v);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
  };
  p = p || {};
  if (p.runSeconds !== undefined) out.runSeconds = num(p.runSeconds, 5, 300, cur.runSeconds);
  if (p.speedBase !== undefined) out.speedBase = num(p.speedBase, 150, 900, cur.speedBase);
  if (p.speedGrowth !== undefined) out.speedGrowth = num(p.speedGrowth, 0, 20, cur.speedGrowth);
  if (p.mult) {
    for (const k of ['autonomousCorrect', 'autonomousWrong', 'ai']) {
      if (p.mult[k] !== undefined) out.mult[k] = num(p.mult[k], 0.3, 3, cur.mult[k]);
    }
  }
  if (p.showTextDuringQuestion !== undefined) out.showTextDuringQuestion = !!p.showTextDuringQuestion;
  if (p.showAIDisclaimer !== undefined) out.showAIDisclaimer = !!p.showAIDisclaimer;
  if (p.ai) {
    const a = p.ai;
    if (['simulado', 'anthropic'].includes(a.provider)) out.ai.provider = a.provider;
    if (typeof a.model === 'string' && a.model.trim()) out.ai.model = a.model.trim().slice(0, 80);
    if (a.simulatedErrorRate !== undefined) out.ai.simulatedErrorRate = num(a.simulatedErrorRate, 0, 1, cur.ai.simulatedErrorRate);
    if (typeof a.apiKey === 'string' && a.apiKey.trim()) out.ai.apiKey = a.apiKey.trim().slice(0, 300);
    if (a.clearKey) out.ai.apiKey = '';
  }
  if (p.theme) {
    const t = p.theme;
    if (typeof t.appTitle === 'string' && t.appTitle.trim()) out.theme.appTitle = t.appTitle.trim().slice(0, 40);
    for (const k of Object.keys(DEFAULTS.theme)) {
      if (k !== 'appTitle' && typeof t[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(t[k])) out.theme[k] = t[k].toLowerCase();
    }
  }
  return out;
}

// ---------- perguntas ----------
function bundledQuestions() {
  const code = fs.readFileSync(path.join(__dirname, 'questions.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  return JSON.parse(JSON.stringify(sandbox.window.QUESTIONS));
}

function loadQuestions() {
  try {
    const arr = JSON.parse(fs.readFileSync(questionsPath(), 'utf8'));
    if (Array.isArray(arr) && arr.length) return arr;
  } catch (_) {}
  return bundledQuestions();
}

function cleanQuestions(arr) {
  if (!Array.isArray(arr) || !arr.length) throw new Error('Inclua pelo menos uma pergunta.');
  const ids = new Set();
  const s = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  return arr.map((q, i) => {
    q = q || {};
    const n = i + 1;
    const o = {
      id: s(q.id, 40) || 'q' + Date.now().toString(36) + i,
      topic: s(q.topic, 60),
      grade: s(q.grade, 20),
      title: s(q.title, 120),
      text: s(q.text, 3000),
      question: s(q.question, 500),
      options: (Array.isArray(q.options) ? q.options : []).slice(0, 4).map((x) => s(x, 300)),
      correct: Number(q.correct),
      explanation: s(q.explanation, 1000)
    };
    if (!o.topic) throw new Error('Pergunta ' + n + ': informe o tema.');
    if (!o.title) throw new Error('Pergunta ' + n + ': informe o título do texto.');
    if (!o.text) throw new Error('Pergunta ' + n + ': informe o texto de leitura.');
    if (!o.question) throw new Error('Pergunta ' + n + ': informe o enunciado.');
    if (o.options.length !== 4 || o.options.some((x) => !x)) throw new Error('Pergunta ' + n + ': preencha as 4 alternativas.');
    if (new Set(o.options).size !== 4) throw new Error('Pergunta ' + n + ': as alternativas devem ser diferentes entre si.');
    if (![0, 1, 2, 3].includes(o.correct)) throw new Error('Pergunta ' + n + ': marque a alternativa correta.');
    if (ids.has(o.id)) o.id = o.id + '_' + i;
    ids.add(o.id);
    return o;
  });
}

// ---------- administrador ----------
const authed = new Set(); // ids das janelas autenticadas
let failures = 0;

function hashPw(pw, saltHex) {
  return crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), 64).toString('hex');
}
function adminConfigured() {
  try {
    const a = JSON.parse(fs.readFileSync(adminPath(), 'utf8'));
    return !!(a.salt && a.hash);
  } catch (_) {
    return false;
  }
}
function checkPw(pw) {
  try {
    const a = JSON.parse(fs.readFileSync(adminPath(), 'utf8'));
    const got = Buffer.from(hashPw(pw, a.salt), 'hex');
    const want = Buffer.from(a.hash, 'hex');
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  } catch (_) {
    return false;
  }
}
function savePw(pw) {
  ensureDir();
  const salt = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(adminPath(), JSON.stringify({ salt, hash: hashPw(pw, salt) }));
}

const guard = (fn) => async (e, ...args) => {
  if (!authed.has(e.sender.id)) return { ok: false, error: 'Acesso negado.' };
  try {
    return await fn(e, ...args);
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
};

function readEvents() {
  try {
    return fs.readFileSync(logPath(), 'utf8').split('\n').filter(Boolean).map((l) => {
      try { return JSON.parse(l); } catch (_) { return null; }
    }).filter(Boolean);
  } catch (_) {
    return [];
  }
}

// ---------- janela ----------
function createWindow() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    title: 'Corrida do Saber',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged
    }
  });
  const id = win.webContents.id;
  win.webContents.once('destroyed', () => authed.delete(id));
  win.loadFile('index.html');
}

// ---------- IPC públicos (jogo) ----------
ipcMain.handle('config:get', () => publicConfig());
ipcMain.handle('questions:get', () => loadQuestions());
ipcMain.handle('log:append', (_e, evt) => {
  try {
    if (!evt || typeof evt !== 'object') return false;
    const line = JSON.stringify(evt);
    if (line.length > 5000) return false;
    ensureDir();
    fs.appendFileSync(logPath(), line + '\n');
    return true;
  } catch (_) {
    return false;
  }
});

ipcMain.handle('ai:ask', async (_e, q) => {
  const cfg = loadConfig();
  const t0 = Date.now();
  try {
    const letters = ['A', 'B', 'C', 'D'];
    if (cfg.ai.provider === 'anthropic' && cfg.ai.apiKey) {
      const prompt =
        'Texto de apoio:\n' + q.text + '\n\nQuestão: ' + q.question + '\n' +
        q.options.map((o, i) => letters[i] + ') ' + o).join('\n') +
        '\n\nResponda somente com JSON no formato {"resposta":"A|B|C|D","explicacao":"até 3 frases"}.';
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), cfg.ai.timeoutMs || 20000);
      let res;
      try {
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: ctrl.signal,
          headers: {
            'content-type': 'application/json',
            'x-api-key': cfg.ai.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: cfg.ai.model,
            max_tokens: 400,
            system:
              'Você é um assistente de estudos de Ciências para estudantes do ensino fundamental. ' +
              'Responda em português do Brasil, de forma curta e clara.',
            messages: [{ role: 'user', content: prompt }]
          })
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const txt = (data.content && data.content[0] && data.content[0].text) || '';
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('Resposta da IA fora do formato esperado');
      const j = JSON.parse(m[0]);
      const letter = String(j.resposta || '').trim().toUpperCase().charAt(0);
      if (!letters.includes(letter)) throw new Error('Alternativa inválida');
      return { ok: true, letter, explanation: String(j.explicacao || ''), latencyMs: Date.now() - t0, source: 'anthropic' };
    }
    // Modo simulado (sem chave/sem internet): útil para testes
    await sleep(800 + Math.random() * 700);
    const wrong = Math.random() < (cfg.ai.simulatedErrorRate || 0);
    let idx = q.correct;
    if (wrong) {
      const others = [0, 1, 2, 3].filter((i) => i !== q.correct);
      idx = others[Math.floor(Math.random() * others.length)];
    }
    return {
      ok: true,
      letter: letters[idx],
      explanation: 'Resposta gerada em modo de teste (IA simulada).',
      latencyMs: Date.now() - t0,
      source: 'simulado'
    };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err), latencyMs: Date.now() - t0 };
  }
});

// ---------- IPC do administrador ----------
ipcMain.handle('admin:status', (e) => ({ configured: adminConfigured(), authed: authed.has(e.sender.id) }));

ipcMain.handle('admin:setup', (e, pw) => {
  if (adminConfigured()) return { ok: false, error: 'A senha já foi criada.' };
  if (typeof pw !== 'string' || pw.length < 6) return { ok: false, error: 'A senha precisa ter pelo menos 6 caracteres.' };
  savePw(pw);
  authed.add(e.sender.id);
  return { ok: true };
});

ipcMain.handle('admin:login', async (e, pw) => {
  if (!adminConfigured()) return { ok: false, error: 'Nenhuma senha criada ainda.' };
  if (checkPw(pw)) {
    failures = 0;
    authed.add(e.sender.id);
    return { ok: true };
  }
  failures += 1;
  await sleep(Math.min(failures, 5) * 700); // atrasa tentativas seguidas
  return { ok: false, error: 'Senha incorreta.' };
});

ipcMain.handle('admin:logout', (e) => {
  authed.delete(e.sender.id);
  return { ok: true };
});

ipcMain.handle('admin:changePassword', guard((_e, oldPw, newPw) => {
  if (!checkPw(oldPw)) return { ok: false, error: 'Senha atual incorreta.' };
  if (typeof newPw !== 'string' || newPw.length < 6) return { ok: false, error: 'A nova senha precisa ter pelo menos 6 caracteres.' };
  savePw(newPw);
  return { ok: true };
}));

ipcMain.handle('admin:config:get', guard(() => ({ ok: true, config: publicConfig() })));

ipcMain.handle('admin:config:save', guard((_e, patch) => {
  const next = sanitizeConfig(patch, loadConfig());
  ensureDir();
  fs.writeFileSync(cfgPath(), JSON.stringify(next, null, 2));
  return { ok: true, config: publicConfig() };
}));

ipcMain.handle('admin:questions:save', guard((_e, arr) => {
  const clean = cleanQuestions(arr);
  ensureDir();
  fs.writeFileSync(questionsPath(), JSON.stringify(clean, null, 2));
  return { ok: true, questions: clean };
}));

ipcMain.handle('admin:questions:reset', guard(() => {
  try { fs.unlinkSync(questionsPath()); } catch (_) {}
  return { ok: true, questions: bundledQuestions() };
}));

ipcMain.handle('admin:events:read', guard(() => ({ ok: true, events: readEvents() })));

ipcMain.handle('admin:events:clear', guard(() => {
  // Arquiva em vez de apagar: o arquivo antigo fica na pasta de dados.
  let archived = null;
  if (fs.existsSync(logPath())) {
    archived = 'events-' + new Date().toISOString().replace(/[:.]/g, '-') + '.bak.jsonl';
    fs.renameSync(logPath(), path.join(userDir(), archived));
  }
  return { ok: true, archived };
}));

ipcMain.handle('admin:csv:save', guard(async (_e, text) => {
  const r = await dialog.showSaveDialog({
    title: 'Exportar dados',
    defaultPath: 'corrida-do-saber-dados.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (r.canceled || !r.filePath) return { ok: false, error: 'cancelado' };
  fs.writeFileSync(r.filePath, '﻿' + String(text), 'utf8');
  return { ok: true, path: r.filePath };
}));

ipcMain.handle('admin:data:open', guard(async () => {
  ensureDir();
  await shell.openPath(userDir());
  return { ok: true };
}));

// ---------- ciclo de vida ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
  });
  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}
app.on('window-all-closed', () => {
  app.quit();
});
