(() => {
  'use strict';

  // ---------- utilidades ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rand = (a, b) => a + Math.random() * (b - a);
  const LET = ['A', 'B', 'C', 'D'];
  const COLS = ['ts', 'participant', 'group', 'session', 'event', 'runIndex', 'questionId', 'topic', 'mode',
    'aiSource', 'aiLetter', 'aiLatencyMs', 'answer', 'correct', 'changedAfterAI', 'readMs', 'answerMs',
    'speedMult', 'distance', 'aiCorrect', 'extra'];

  let cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  let QS = window.QUESTIONS || [];

  const api = window.api || window.__browserApi;

  // ---------- estado ----------
  const cv = $('game');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, GROUND = 250, GRAV = 2700, JUMP_V = 860;

  const S = {
    state: 'menu', // menu | running | rest | over
    participant: '', group: '', session: '',
    run: 0, t: 0, energy: 1, dist: 0, speedMult: 1, paceLabel: 'normal',
    obs: [], since: 0, gap: 600, groundX: 0,
    clouds: [{ x: 120, y: 50 }, { x: 460, y: 80 }, { x: 760, y: 40 }],
    used: new Set()
  };
  const P = { x: 70, yOff: 0, vy: 0, duck: false };
  let A = null; // atividade em andamento

  // ---------- registro de dados ----------
  function log(event, data) {
    const e = Object.assign({
      ts: new Date().toISOString(), participant: S.participant, group: S.group,
      session: S.session, event, runIndex: S.run
    }, data || {});
    return api.log(e);
  }

  function toCsv(rows) {
    const q = (v) => {
      if (v === undefined || v === null) return '';
      const s = String(v);
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [COLS.join(',')];
    for (const r of rows) {
      const extra = {};
      for (const k of Object.keys(r)) if (!COLS.includes(k)) extra[k] = r[k];
      const row = Object.assign({}, r, { extra: Object.keys(extra).length ? JSON.stringify(extra) : '' });
      lines.push(COLS.map((c) => q(row[c])).join(','));
    }
    return lines.join('\n');
  }

  // ---------- jogo ----------
  function startRun() {
    S.run += 1;
    S.t = 0; S.energy = 1; S.dist = 0; S.speedMult = 1; S.paceLabel = 'normal';
    S.obs = []; S.since = 0; S.gap = 700;
    P.yOff = 0; P.vy = 0; P.duck = false;
    S.state = 'running';
    hideOverlay();
    log('run_start');
  }

  function currentSpeed() {
    const grow = Math.min(cfg.speedGrowth * S.t, cfg.speedBase);
    return (cfg.speedBase + grow) * S.speedMult;
  }

  function spawn() {
    if (S.t > 10 && Math.random() < 0.25) {
      S.obs.push({ type: 'drone', x: W + 20, w: 46, h: 26, y: GROUND - 70 });
    } else {
      const count = 1 + Math.floor(Math.random() * 3);
      const unit = rand(18, 26), h = rand(36, 56);
      S.obs.push({ type: 'rock', x: W + 20, w: unit * count, unit, count, h, y: GROUND - h });
    }
  }

  function playerBox() {
    const ducking = P.duck && P.yOff === 0;
    const w = ducking ? 52 : 40, h = ducking ? 30 : 52;
    return { x: P.x + 4, y: GROUND - P.yOff - h + 4, w: w - 8, h: h - 6 };
  }

  function hit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function update(dt) {
    S.t += dt;
    const sp = currentSpeed();
    S.dist += (sp * dt) / 40;
    S.energy -= dt / cfg.runSeconds;

    if (P.yOff > 0 || P.vy > 0) {
      P.vy -= GRAV * (P.duck ? 2 : 1) * dt;
      P.yOff += P.vy * dt;
      if (P.yOff <= 0) { P.yOff = 0; P.vy = 0; }
    }

    S.since += sp * dt;
    if (S.since >= S.gap) {
      spawn();
      S.since = 0;
      S.gap = sp * rand(1.0, 1.9) + 80;
    }
    for (const o of S.obs) o.x -= sp * dt;
    S.obs = S.obs.filter((o) => o.x + o.w > -20);
    S.groundX = (S.groundX + sp * dt) % 40;
    for (const c of S.clouds) { c.x -= sp * dt * 0.1; if (c.x < -60) { c.x = W + 40; c.y = rand(30, 100); } }

    const pb = playerBox();
    for (const o of S.obs) {
      if (hit(pb, { x: o.x + 3, y: o.y + 3, w: o.w - 6, h: o.h - 6 })) { gameOver(); return; }
    }
    if (S.energy <= 0) { S.energy = 0; startRest(); }
  }

  function gameOver() {
    S.state = 'over';
    log('run_end', { reason: 'collision', distance: Math.round(S.dist), speedMult: S.speedMult });
    overlay(`
      <div class="card">
        <span class="tag">Fim da corrida</span>
        <h1>Você tropeçou!</h1>
        <div class="stat"><span>Distância</span><strong>${Math.round(S.dist)} m</strong></div>
        <div class="stat"><span>Corrida nº</span><strong>${S.run}</strong></div>
        <div class="row">
          <button class="primary" id="again">Correr de novo</button>
          <button id="toMenu">Menu</button>
        </div>
      </div>`);
    $('again').onclick = startRun;
    $('toMenu').onclick = showMenu;
  }

  // ---------- desenho ----------
  const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
  const shade = (h, f) => '#' + hex2rgb(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');
  const lum = (h) => { const c = hex2rgb(h); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; };
  let T = Object.assign({}, DEFAULT_CONFIG.theme);
  let C = {};
  function applyTheme(t) {
    T = Object.assign({}, DEFAULT_CONFIG.theme, t || {});
    const st = document.documentElement.style;
    st.setProperty('--bg', T.bg); st.setProperty('--card', T.card); st.setProperty('--ink', T.ink);
    st.setProperty('--muted', T.muted); st.setProperty('--line', T.line); st.setProperty('--accent', T.accent);
    st.setProperty('--warn', T.warn); st.setProperty('--stage', T.stageBg);
    st.setProperty('--accent-ink', lum(T.accent) > 0.6 ? '#111111' : '#ffffff');
    C = { body: T.playerBody, dark: shade(T.playerBody, 0.65), visor: '#a5d8ff', pack: T.playerPack, rock: T.rock, rock2: shade(T.rock, 0.7), drone: T.drone };
    document.title = T.appTitle;
  }
  async function reloadAll() {
    try { cfg = await api.getConfig(); } catch (_) {}
    try { const q = await api.getQuestions(); if (Array.isArray(q) && q.length) QS = q; } catch (_) {}
    applyTheme(cfg.theme);
  }
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  function drawPlayer() {
    const bx = P.x, g = GROUND - P.yOff;
    const ducking = P.duck && P.yOff === 0;
    const step = S.state === 'running' && P.yOff === 0 ? Math.floor(S.t * 12) % 2 : 0;
    if (ducking) {
      R(bx, g - 24, 40, 16, C.body);
      R(bx + 30, g - 34, 22, 18, C.body);
      R(bx + 42, g - 28, 10, 7, C.visor);
      R(bx - 6, g - 22, 8, 12, C.pack);
      R(bx + 6 + step * 6, g - 8, 8, 8, C.dark);
      R(bx + 26 - step * 6, g - 8, 8, 8, C.dark);
    } else {
      R(bx + 2, g - 34, 32, 22, C.body);
      R(bx + 16, g - 52, 24, 20, C.body);
      R(bx + 30, g - 46, 10, 8, C.visor);
      R(bx - 6, g - 32, 8, 16, C.pack);
      R(bx + 6 + step * 4, g - 12, 8, 12, C.dark);
      R(bx + 22 - step * 4, g - 12, 8, 12, C.dark);
    }
    if (S.state === 'rest') {
      ctx.fillStyle = T.muted;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('z z z', bx + 30, g - 64);
    }
  }

  function drawObstacle(o) {
    if (o.type === 'rock') {
      for (let i = 0; i < o.count; i++) {
        const x = o.x + i * o.unit, h = o.h * (i % 2 ? 0.8 : 1);
        ctx.fillStyle = C.rock;
        ctx.beginPath();
        ctx.moveTo(x, GROUND);
        ctx.lineTo(x + o.unit * 0.5, GROUND - h);
        ctx.lineTo(x + o.unit, GROUND);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = C.rock2;
        ctx.beginPath();
        ctx.moveTo(x + o.unit * 0.5, GROUND - h);
        ctx.lineTo(x + o.unit, GROUND);
        ctx.lineTo(x + o.unit * 0.5, GROUND);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      const flap = Math.floor(S.t * 14) % 2;
      R(o.x, o.y + 8, o.w, 14, C.drone);
      R(o.x + 6, o.y + 22, o.w - 12, 4, C.dark);
      R(o.x + 4, o.y + (flap ? 0 : 3), 14, 3, T.ink);
      R(o.x + o.w - 18, o.y + (flap ? 0 : 3), 14, 3, T.ink);
    }
  }

  function draw() {
    R(0, 0, W, H, T.stageBg);
    for (const c of S.clouds) { R(c.x, c.y, 46, 10, T.line); R(c.x + 10, c.y - 8, 26, 10, T.line); }
    R(0, GROUND, W, 2, T.ink);
    ctx.fillStyle = T.muted;
    for (let x = -S.groundX; x < W; x += 40) ctx.fillRect(Math.round(x), GROUND + 10, 10, 2);
    for (let x = -S.groundX * 0.5; x < W; x += 70) ctx.fillRect(Math.round(x), GROUND + 24, 6, 2);
    for (const o of S.obs) drawObstacle(o);
    drawPlayer();
    if (S.state === 'running' && S.energy < 0.2 && Math.floor(S.t * 4) % 2 === 0) {
      ctx.fillStyle = T.warn;
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Energia acabando…', W / 2 - 70, 30);
    }
  }

  function updateHud() {
    const f = $('energyFill');
    f.style.width = Math.max(0, S.energy * 100) + '%';
    f.classList.toggle('low', S.energy < 0.2);
    $('dist').textContent = Math.round(S.dist) + ' m';
    $('pace').textContent = S.paceLabel;
    $('runInfo').textContent = S.run ? '#' + S.run : '-';
  }

  let last = 0;
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    if (S.state === 'running') update(dt);
    draw();
    updateHud();
    requestAnimationFrame(frame);
  }

  // ---------- entrada ----------
  window.addEventListener('keydown', (e) => {
    if (S.state !== 'running') return;
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (P.yOff === 0) { P.vy = JUMP_V; P.duck = false; }
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      P.duck = true;
    }
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'ArrowDown') P.duck = false; });

  // ---------- telas (overlay) ----------
  function overlay(html) { const o = $('overlay'); o.innerHTML = html; o.classList.remove('hidden'); }
  function hideOverlay() { $('overlay').classList.add('hidden'); }

  function showMenu() {
    S.state = 'menu';
    overlay(`
      <div class="card">
        <h1>${esc(T.appTitle)}</h1>
        <p>Corra o máximo que puder! Quando a energia acabar, você precisará ler um texto de Ciências e responder uma questão para voltar a correr.</p>
        <label for="pid">Código do participante</label>
        <input type="text" id="pid" maxlength="30" autocomplete="off" value="${esc(S.participant)}">
        <label for="grp">Turma (opcional)</label>
        <input type="text" id="grp" maxlength="30" autocomplete="off" value="${esc(S.group)}">
        <div class="row">
          <button class="primary" id="go">Jogar</button>
        </div>
        <div class="row"><button class="link" id="adm">Área do administrador</button></div>
      </div>`);
    $('go').onclick = () => {
      const id = $('pid').value.trim();
      if (!id) { $('pid').focus(); return; }
      S.participant = id;
      S.group = $('grp').value.trim();
      S.session = Date.now().toString(36);
      S.run = 0;
      log('session_start', { aiLive: !!cfg._aiLive });
      startRun();
    };
    $('adm').onclick = () => Admin.open({ api, toCsv, applyTheme, reloadAll, onExit: async () => { await reloadAll(); showMenu(); } });
  }

  function pickQuestion() {
    const all = QS;
    let pool = all.filter((q) => !S.used.has(q.id));
    if (!pool.length) { S.used.clear(); pool = all.slice(); }
    const q = pool[Math.floor(Math.random() * pool.length)];
    S.used.add(q.id);
    return q;
  }

  function startRest() {
    S.state = 'rest';
    const q = pickQuestion();
    A = { q, mode: null, ai: null, tRest: performance.now(), tRead: 0, tQuestion: 0, aiTries: 0 };
    log('rest_start', { questionId: q.id, topic: q.topic, distance: Math.round(S.dist) });
    showReading();
  }

  function showReading() {
    const q = A.q;
    overlay(`
      <div class="card wide">
        <span class="tag">${esc(q.topic)}</span>
        <p><strong>Sua energia acabou!</strong> Leia o texto para continuar.</p>
        <h2>${esc(q.title)}</h2>
        <div class="readtext">${esc(q.text)}</div>
        <div class="row"><button class="primary" id="read">Li o texto, ir para a pergunta</button></div>
      </div>`);
    $('read').onclick = () => {
      A.tRead = performance.now();
      log('reading_done', { questionId: q.id, topic: q.topic, readMs: Math.round(A.tRead - A.tRest) });
      showModeChoice();
    };
  }

  function showModeChoice() {
    const q = A.q;
    overlay(`
      <div class="card wide">
        <span class="tag">${esc(q.topic)}</span>
        <h2>${esc(q.question)}</h2>
        <p>Como você quer enfrentar esta questão?</p>
        <div class="row">
          <button class="big" id="own"><strong>Vou tentar sozinho(a)</strong><small>Usar o que li e o que já sei.</small></button>
          <button class="big" id="ai"><strong>Pedir ajuda da IA</strong><small>Consultar uma ferramenta de Inteligência Artificial.</small></button>
        </div>
      </div>`);
    $('own').onclick = () => chooseMode('own');
    $('ai').onclick = () => chooseMode('ai');
  }

  function chooseMode(mode) {
    A.mode = mode;
    A.tQuestion = performance.now();
    log('mode_choice', { questionId: A.q.id, topic: A.q.topic, mode });
    showQuestion();
    if (mode === 'ai') requestAI();
  }

  function showQuestion() {
    const q = A.q;
    const reread = cfg.showTextDuringQuestion
      ? `<details><summary>Reler o texto</summary><div class="readtext">${esc(q.text)}</div></details>` : '';
    overlay(`
      <div class="card wide">
        <span class="tag">${esc(q.topic)} · ${A.mode === 'ai' ? 'com ajuda da IA' : 'sozinho(a)'}</span>
        <h2>${esc(q.question)}</h2>
        ${reread}
        <div id="aiBox"></div>
        <div class="opts" id="opts">
          ${q.options.map((o, i) => `<button class="opt" data-i="${i}" ${A.mode === 'ai' ? 'disabled' : ''}><b>${LET[i]}</b><span>${esc(o)}</span></button>`).join('')}
        </div>
        <div class="row"><button class="primary" id="confirm" disabled>Confirmar resposta</button></div>
      </div>`);
    A.sel = null;
    document.querySelectorAll('.opt').forEach((b) => {
      b.onclick = () => {
        A.sel = Number(b.dataset.i);
        document.querySelectorAll('.opt').forEach((x) => x.classList.toggle('selected', x === b));
        $('confirm').disabled = false;
      };
    });
    $('confirm').onclick = confirmAnswer;
  }

  async function requestAI() {
    const q = A.q, box = $('aiBox');
    A.aiTries += 1;
    box.className = 'aibox';
    box.textContent = 'Consultando a IA…';
    log('ai_request', { questionId: q.id, topic: q.topic, mode: 'ai', tries: A.aiTries });
    const res = await api.askAI({ id: q.id, text: q.text, question: q.question, options: q.options, correct: q.correct });
    if (!document.getElementById('aiBox') || A.mode !== 'ai') return;
    if (res && res.ok) {
      A.ai = res;
      log('ai_response', { questionId: q.id, topic: q.topic, mode: 'ai', aiSource: res.source, aiLetter: res.letter, aiLatencyMs: res.latencyMs });
      box.className = 'aibox';
      box.textContent = '';
      const t1 = document.createElement('div');
      t1.innerHTML = '<strong>A IA sugere a alternativa ' + esc(res.letter) + '.</strong>';
      const t2 = document.createElement('div');
      t2.textContent = res.explanation;
      box.appendChild(t1);
      box.appendChild(t2);
      if (cfg.showAIDisclaimer) {
        const t3 = document.createElement('div');
        t3.className = 'muted';
        t3.textContent = 'A IA pode errar. A decisão final é sua.';
        box.appendChild(t3);
      }
      document.querySelectorAll('.opt').forEach((b) => (b.disabled = false));
    } else {
      log('ai_error', { questionId: q.id, topic: q.topic, mode: 'ai', error: res && res.error });
      box.className = 'aibox err';
      box.innerHTML = 'Não foi possível consultar a IA agora (verifique a internet).<div class="row"><button id="retry">Tentar de novo</button><button id="solo">Responder sozinho(a)</button></div>';
      $('retry').onclick = requestAI;
      $('solo').onclick = () => {
        A.mode = 'own';
        log('mode_switch', { questionId: q.id, topic: q.topic, mode: 'own', reason: 'ai_unavailable' });
        showQuestion();
      };
    }
  }

  function confirmAnswer() {
    const q = A.q;
    const correct = A.sel === q.correct;
    const answerMs = Math.round(performance.now() - A.tQuestion);
    let mult, pace;
    if (A.mode === 'ai') { mult = cfg.mult.ai; pace = 'com IA'; }
    else if (correct) { mult = cfg.mult.autonomousCorrect; pace = 'autônomo'; }
    else { mult = cfg.mult.autonomousWrong; pace = 'autônomo (errou)'; }
    const data = {
      questionId: q.id, topic: q.topic, mode: A.mode, answer: LET[A.sel], correct, answerMs,
      readMs: Math.round(A.tRead - A.tRest), speedMult: mult
    };
    if (A.mode === 'ai' && A.ai) {
      data.aiSource = A.ai.source;
      data.aiLetter = A.ai.letter;
      data.aiLatencyMs = A.ai.latencyMs;
      data.changedAfterAI = LET[A.sel] !== A.ai.letter;
      data.aiCorrect = A.ai.letter === LET[q.correct];
    }
    log('answer', data);
    S.speedMult = mult;
    S.paceLabel = pace;
    showFeedback(correct, mult);
  }

  function showFeedback(correct, mult) {
    const q = A.q;
    overlay(`
      <div class="card wide">
        <span class="tag">${correct ? 'Resposta correta' : 'Resposta incorreta'}</span>
        <h2>${correct ? 'Muito bem!' : 'Não foi dessa vez.'}</h2>
        <div class="opts">
          ${q.options.map((o, i) => `<div class="opt ${i === q.correct ? 'correct' : (i === A.sel ? 'wrong' : '')}"><b>${LET[i]}</b><span>${esc(o)}</span></div>`).join('')}
        </div>
        <p>${esc(q.explanation)}</p>
        <div class="stat"><span>Energia</span><strong>recuperada</strong></div>
        <div class="stat"><span>Ritmo de corrida</span><strong>×${mult.toFixed(2)}</strong></div>
        <div class="row"><button class="primary" id="resume">Continuar correndo</button></div>
      </div>`);
    $('resume').onclick = resume;
  }

  function resume() {
    log('run_resume', { questionId: A.q.id, speedMult: S.speedMult, distance: Math.round(S.dist) });
    S.energy = 1;
    S.obs = [];
    S.since = 0;
    S.gap = 700;
    P.yOff = 0; P.vy = 0; P.duck = false;
    S.state = 'running';
    hideOverlay();
  }

  // ---------- início ----------
  (async () => {
    await reloadAll();
    showMenu();
    requestAnimationFrame(frame);
  })();
})();
