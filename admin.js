// Área do administrador: métricas, editor de perguntas, tema/ajustes e conta.
// Toda a proteção real fica no processo principal (main.js): sem login, ele recusa as chamadas.
window.Admin = (() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LET = ['A', 'B', 'C', 'D'];
  const TABS = [['metrics', 'Métricas'], ['questions', 'Perguntas'], ['settings', 'Aparência e ajustes'], ['account', 'Conta']];
  const THEME_FIELDS = [
    ['bg', 'Fundo da janela'], ['card', 'Cartões'], ['ink', 'Texto'], ['muted', 'Texto secundário'],
    ['line', 'Bordas'], ['accent', 'Cor principal (botões)'], ['warn', 'Alerta'], ['stageBg', 'Fundo da pista'],
    ['playerBody', 'Personagem'], ['playerPack', 'Mochila do personagem'], ['rock', 'Pedras'], ['drone', 'Drones']
  ];
  const PRESETS = {
    'Claro (padrão)': null,
    'Escuro': { bg: '#161a21', card: '#222833', ink: '#e8eaee', muted: '#9aa3b2', line: '#37404f', accent: '#4fb383', warn: '#f08a4b', stageBg: '#1b2029', playerBody: '#4fb383', playerPack: '#f2b84b', rock: '#8791a3', drone: '#f08a4b' },
    'Alto contraste': { bg: '#ffffff', card: '#ffffff', ink: '#000000', muted: '#333333', line: '#000000', accent: '#0b3d91', warn: '#b00020', stageBg: '#ffffff', playerBody: '#0b3d91', playerPack: '#c77700', rock: '#444444', drone: '#b00020' },
    'Oceano': { bg: '#eaf3f8', card: '#ffffff', ink: '#1b2a38', muted: '#5b6b7a', line: '#c5d6e2', accent: '#0f6e8c', warn: '#c2410c', stageBg: '#f4fafd', playerBody: '#0f6e8c', playerPack: '#e8a33d', rock: '#7d8b99', drone: '#c2410c' }
  };

  let X = null, root = null, tab = 'metrics';
  let qs = [], qSel = 0, qDirty = false, qSearch = '';
  let draftCfg = null, cfgDirty = false;

  // ---------- entrada e saída ----------
  function open(ctx) {
    X = ctx;
    root = $('adminRoot');
    root.classList.remove('hidden');
    tab = 'metrics';
    qDirty = false; cfgDirty = false;
    gate();
  }
  async function exit() {
    if (!leaveOk()) return;
    try { await X.api.adminLogout(); } catch (_) {}
    root.classList.add('hidden');
    root.innerHTML = '';
    X.onExit();
  }
  function leaveOk() {
    if (qDirty || cfgDirty) return confirm('Há alterações não salvas. Sair mesmo assim e descartá-las?');
    return true;
  }

  // ---------- login ----------
  async function gate() {
    const st = await X.api.adminStatus();
    if (st.authed) return shell();
    const setup = !st.configured;
    root.innerHTML = `
      <div class="adm-login"><div class="card">
        <h1>Área do administrador</h1>
        <p>${setup ? 'Primeiro acesso: crie a senha do administrador (mínimo de 6 caracteres) e guarde-a em local seguro.' : 'Digite a senha para continuar.'}</p>
        <label for="aPw">Senha</label>
        <input type="password" id="aPw" autocomplete="off">
        ${setup ? '<label for="aPw2">Repita a senha</label><input type="password" id="aPw2" autocomplete="off">' : ''}
        <div class="err" id="aErr"></div>
        <div class="row">
          <button class="primary" id="aGo">${setup ? 'Criar senha e entrar' : 'Entrar'}</button>
          <button id="aBack">Voltar ao jogo</button>
        </div>
      </div></div>`;
    const go = async () => {
      const pw = $('aPw').value;
      const err = $('aErr');
      err.textContent = '';
      if (setup && pw !== $('aPw2').value) { err.textContent = 'As senhas não coincidem.'; return; }
      $('aGo').disabled = true;
      const r = setup ? await X.api.adminSetup(pw) : await X.api.adminLogin(pw);
      $('aGo').disabled = false;
      if (r && r.ok) shell(); else err.textContent = (r && r.error) || 'Não foi possível entrar.';
    };
    $('aGo').onclick = go;
    root.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }));
    $('aBack').onclick = () => { root.classList.add('hidden'); root.innerHTML = ''; X.onExit(); };
    $('aPw').focus();
  }

  // ---------- estrutura ----------
  function shell() {
    root.innerHTML = `
      <div class="adm">
        <header class="adm-top">
          <strong>Administração</strong>
          <nav>${TABS.map(([k, l]) => `<button class="tab ${k === tab ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</nav>
          <button id="aOut">Sair do modo administrador</button>
        </header>
        <section class="adm-body" id="aBody"></section>
      </div>`;
    root.querySelectorAll('.tab').forEach((b) => (b.onclick = () => {
      if (b.dataset.t === tab) return;
      if (!leaveOk()) return;
      if (cfgDirty) { X.reloadAll(); cfgDirty = false; }
      qDirty = false;
      tab = b.dataset.t;
      shell();
    }));
    $('aOut').onclick = exit;
    ({ metrics: renderMetrics, questions: renderQuestions, settings: renderSettings, account: renderAccount })[tab]();
  }

  const body = () => $('aBody');
  const denied = (r) => r && r.error === 'Acesso negado.';
  async function guardFail(r) {
    if (denied(r)) { alert('Sessão expirada. Entre novamente.'); gate(); return true; }
    return false;
  }

  // ======================================================================
  // MÉTRICAS
  // ======================================================================
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);
  const fp = (v) => (v == null ? '–' : v + '%');
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const secs = (ms) => (ms == null ? '–' : (ms / 1000).toFixed(1) + ' s');
  const bar = (v) => `<div class="mbar"><i style="width:${v == null ? 0 : v}%"></i></div>`;

  function summarize(answers) {
    const n = answers.length;
    return {
      n,
      acc: pct(answers.filter((a) => a.correct === true || a.correct === 'true').length, n),
      time: avg(answers.map((a) => Number(a.answerMs)).filter((x) => x > 0))
    };
  }

  function compute(all, fPart, fGroup) {
    const ev = all.filter((e) => (!fPart || e.participant === fPart) && (!fGroup || e.group === fGroup));
    const ans = ev.filter((e) => e.event === 'answer').sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    const own = ans.filter((a) => a.mode === 'own');
    const ai = ans.filter((a) => a.mode === 'ai');
    const choices = ev.filter((e) => e.event === 'mode_choice');
    const dists = ev.map((e) => Number(e.distance)).filter((x) => Number.isFinite(x) && x > 0);
    const aiWithTruth = ai.filter((a) => typeof a.aiCorrect === 'boolean');
    const followed = (a) => a.answer === a.aiLetter;
    const aiRight = aiWithTruth.filter((a) => a.aiCorrect);
    const aiWrong = aiWithTruth.filter((a) => !a.aiCorrect);

    // por participante
    const parts = {};
    ans.forEach((a) => { (parts[a.participant] = parts[a.participant] || { group: a.group, list: [] }).list.push(a); });
    const perPart = Object.keys(parts).sort().map((p) => {
      const l = parts[p].list;
      const o = l.filter((x) => x.mode === 'own');
      const i = l.filter((x) => x.mode === 'ai');
      const iw = i.filter((x) => x.aiCorrect === false);
      return {
        id: p, group: parts[p].group || '', n: l.length,
        aiShare: pct(i.length, l.length),
        accOwn: pct(o.filter((x) => x.correct).length, o.length),
        accAi: pct(i.filter((x) => x.correct).length, i.length),
        wrongFollowed: iw.length ? iw.filter(followed).length + '/' + iw.length : '–',
        seq: l.slice(-30)
      };
    });

    // por tema
    const topics = {};
    ans.forEach((a) => { (topics[a.topic] = topics[a.topic] || []).push(a); });
    const perTopic = Object.keys(topics).sort().map((t) => {
      const l = topics[t];
      return { t, n: l.length, acc: pct(l.filter((x) => x.correct).length, l.length), aiShare: pct(l.filter((x) => x.mode === 'ai').length, l.length) };
    });

    // evolução: blocos de 3 atividades por participante
    const buckets = [];
    Object.keys(parts).forEach((p) => {
      parts[p].list.forEach((a, idx) => {
        const b = Math.min(Math.floor(idx / 3), 7);
        (buckets[b] = buckets[b] || []).push(a);
      });
    });
    const evo = [];
    for (let b = 0; b < buckets.length; b++) {
      const l = buckets[b] || [];
      evo.push({
        label: b === 7 ? 'Atividades 22+' : 'Atividades ' + (b * 3 + 1) + '–' + (b * 3 + 3),
        n: l.length,
        aiShare: pct(l.filter((x) => x.mode === 'ai').length, l.length),
        acc: pct(l.filter((x) => x.correct).length, l.length)
      });
    }

    return {
      participants: new Set(ev.filter((e) => e.participant).map((e) => e.participant)).size,
      sessions: ev.filter((e) => e.event === 'session_start').length,
      runs: ev.filter((e) => e.event === 'run_start').length,
      activities: ans.length,
      aiChoiceShare: pct(choices.filter((c) => c.mode === 'ai').length, choices.length),
      maxDist: dists.length ? Math.max.apply(null, dists) : null,
      own: summarize(own), ai: summarize(ai),
      readTime: avg(ev.filter((e) => e.event === 'reading_done').map((e) => Number(e.readMs)).filter((x) => x > 0)),
      aiErrors: ev.filter((e) => e.event === 'ai_error').length,
      reliance: {
        n: aiWithTruth.length,
        aiAccuracy: pct(aiRight.length, aiWithTruth.length),
        followedRight: aiRight.length ? pct(aiRight.filter(followed).length, aiRight.length) : null,
        followedWrong: aiWrong.length ? pct(aiWrong.filter(followed).length, aiWrong.length) : null,
        nWrong: aiWrong.length,
        changed: pct(ai.filter((a) => a.changedAfterAI === true).length, ai.filter((a) => typeof a.changedAfterAI === 'boolean').length)
      },
      perPart, perTopic, evo
    };
  }

  async function renderMetrics(keep) {
    const b = body();
    b.innerHTML = '<p class="muted">Carregando…</p>';
    const r = await X.api.adminReadEvents();
    if (await guardFail(r)) return;
    const all = (r && r.events) || [];
    const parts = Array.from(new Set(all.map((e) => e.participant).filter(Boolean))).sort();
    const groups = Array.from(new Set(all.map((e) => e.group).filter(Boolean))).sort();
    const fPart = (keep && keep.p) || '';
    const fGroup = (keep && keep.g) || '';
    const m = compute(all, fPart, fGroup);

    b.innerHTML = `
      <div class="toolbar">
        <div><label for="fP">Participante</label><select id="fP"><option value="">Todos</option>${parts.map((p) => `<option ${p === fPart ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>
        <div><label for="fG">Turma</label><select id="fG"><option value="">Todas</option>${groups.map((g) => `<option ${g === fGroup ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
        <button id="mRef">Atualizar</button>
        <button id="mCsv">Exportar CSV</button>
        <button id="mDir">Abrir pasta de dados</button>
        <button id="mClr" class="danger">Arquivar e zerar dados</button>
      </div>
      ${!all.length ? '<div class="panel">Ainda não há dados registrados. Eles aparecem aqui assim que alguém jogar.</div>' : ''}
      <div class="kpis">
        <div class="kpi"><span>Participantes</span><strong>${m.participants}</strong></div>
        <div class="kpi"><span>Sessões</span><strong>${m.sessions}</strong></div>
        <div class="kpi"><span>Corridas</span><strong>${m.runs}</strong></div>
        <div class="kpi"><span>Atividades respondidas</span><strong>${m.activities}</strong></div>
        <div class="kpi"><span>Escolheram IA</span><strong>${fp(m.aiChoiceShare)}</strong></div>
        <div class="kpi"><span>Maior distância</span><strong>${m.maxDist == null ? '–' : m.maxDist + ' m'}</strong></div>
      </div>
      <div class="cols2">
        <div class="panel">
          <h3>Sozinho(a) × com IA</h3>
          <table class="t">
            <tr><th>Modo</th><th>Respostas</th><th>Acerto</th><th></th><th>Tempo médio</th></tr>
            <tr><td>Sozinho(a)</td><td>${m.own.n}</td><td>${fp(m.own.acc)}</td><td>${bar(m.own.acc)}</td><td>${secs(m.own.time)}</td></tr>
            <tr><td>Com IA</td><td>${m.ai.n}</td><td>${fp(m.ai.acc)}</td><td>${bar(m.ai.acc)}</td><td>${secs(m.ai.time)}</td></tr>
          </table>
          <p class="muted">Tempo médio de leitura do texto: ${secs(m.readTime)} · Falhas ao consultar a IA: ${m.aiErrors}</p>
        </div>
        <div class="panel">
          <h3>Dependência da IA</h3>
          <table class="t">
            <tr><td>Vezes em que a IA acertou</td><td><strong>${fp(m.reliance.aiAccuracy)}</strong></td></tr>
            <tr><td>Seguiu a IA quando ela acertou</td><td><strong>${fp(m.reliance.followedRight)}</strong></td></tr>
            <tr><td>Seguiu a IA quando ela errou (${m.reliance.nWrong} ${m.reliance.nWrong === 1 ? 'caso' : 'casos'})</td><td><strong>${fp(m.reliance.followedWrong)}</strong></td></tr>
            <tr><td>Mudou a resposta depois de ver a IA</td><td><strong>${fp(m.reliance.changed)}</strong></td></tr>
          </table>
          <p class="muted">Calculado sobre ${m.reliance.n} respostas com IA. “Seguiu a IA quando ela errou” indica confiança sem checagem.</p>
        </div>
      </div>
      <div class="panel">
        <h3>Evolução ao longo das atividades (todos os participantes)</h3>
        ${m.evo.length ? `<table class="t"><tr><th>Bloco</th><th>Respostas</th><th>Uso da IA</th><th></th><th>Acerto</th><th></th></tr>
          ${m.evo.map((e) => `<tr><td>${e.label}</td><td>${e.n}</td><td>${fp(e.aiShare)}</td><td>${bar(e.aiShare)}</td><td>${fp(e.acc)}</td><td>${bar(e.acc)}</td></tr>`).join('')}</table>` : '<p class="muted">Sem dados.</p>'}
      </div>
      <div class="panel">
        <h3>Por participante</h3>
        <div class="scroll-x">${m.perPart.length ? `<table class="t"><tr><th>Código</th><th>Turma</th><th>Respostas</th><th>Uso da IA</th><th>Acerto sozinho(a)</th><th>Acerto com IA</th><th>Seguiu IA errada</th><th>Últimas respostas</th></tr>
          ${m.perPart.map((p) => `<tr><td><strong>${esc(p.id)}</strong></td><td>${esc(p.group)}</td><td>${p.n}</td><td>${fp(p.aiShare)}</td><td>${fp(p.accOwn)}</td><td>${fp(p.accAi)}</td><td>${p.wrongFollowed}</td>
          <td><div class="seq">${p.seq.map((s) => `<span class="sq ${s.correct ? 'y' : 'n'}" title="${esc(s.topic)} · ${s.mode === 'ai' ? 'com IA' : 'sozinho(a)'} · ${s.correct ? 'acertou' : 'errou'}">${s.mode === 'ai' ? 'I' : 'S'}</span>`).join('')}</div></td></tr>`).join('')}</table>` : '<p class="muted">Sem dados.</p>'}</div>
        <div class="legend">Cada quadrado é uma resposta, da mais antiga para a mais recente: <b>S</b> = sozinho(a), <b>I</b> = com IA; verde = acertou, vermelho = errou.</div>
      </div>
      <div class="panel">
        <h3>Por tema</h3>
        ${m.perTopic.length ? `<table class="t"><tr><th>Tema</th><th>Respostas</th><th>Acerto</th><th></th><th>Uso da IA</th></tr>
          ${m.perTopic.map((t) => `<tr><td>${esc(t.t)}</td><td>${t.n}</td><td>${fp(t.acc)}</td><td>${bar(t.acc)}</td><td>${fp(t.aiShare)}</td></tr>`).join('')}</table>` : '<p class="muted">Sem dados.</p>'}
      </div>
      <p class="muted" id="mMsg"></p>`;

    const rerender = () => renderMetrics({ p: $('fP').value, g: $('fG').value });
    $('fP').onchange = rerender;
    $('fG').onchange = rerender;
    $('mRef').onclick = rerender;
    $('mCsv').onclick = async () => {
      const res = await X.api.adminSaveCsv(X.toCsv(all));
      if (await guardFail(res)) return;
      $('mMsg').textContent = res && res.ok ? 'Arquivo exportado.' : '';
    };
    $('mDir').onclick = async () => { const res = await X.api.adminOpenData(); await guardFail(res); };
    $('mClr').onclick = async () => {
      if (!confirm('Arquivar e zerar todos os dados registrados?\n\nO arquivo atual será guardado como cópia (.bak.jsonl) na pasta de dados, mas o painel ficará vazio.')) return;
      const res = await X.api.adminClearEvents();
      if (await guardFail(res)) return;
      renderMetrics();
    };
  }

  // ======================================================================
  // PERGUNTAS
  // ======================================================================
  const blankQ = () => ({ id: 'q' + Date.now().toString(36), topic: '', grade: '', title: '', text: '', question: '', options: ['', '', '', ''], correct: 0, explanation: '' });

  async function renderQuestions() {
    const b = body();
    b.innerHTML = '<p class="muted">Carregando…</p>';
    qs = JSON.parse(JSON.stringify(await X.api.getQuestions()));
    qSel = 0; qDirty = false; qSearch = '';
    drawQuestions();
  }

  function qLabel(q, i) {
    return `<button class="qitem ${i === qSel ? 'on' : ''}" data-i="${i}"><b>${esc(q.topic || '(sem tema)')}</b><small>${esc((q.question || '(sem enunciado)').slice(0, 70))}</small></button>`;
  }

  function drawQuestions() {
    const b = body();
    b.innerHTML = `
      <div class="toolbar">
        <button id="qNew">+ Nova pergunta</button>
        <button id="qDup">Duplicar</button>
        <button id="qDel" class="danger">Excluir</button>
        <button id="qReset">Restaurar perguntas originais</button>
        <span style="flex:1"></span>
        <button id="qDiscard">Descartar alterações</button>
        <button id="qSave" class="primary">Salvar alterações</button>
      </div>
      <div id="qMsg" class="err"></div>
      <div class="qlayout">
        <div class="panel">
          <input type="text" id="qFind" placeholder="Buscar por tema ou enunciado" value="${esc(qSearch)}">
          <div class="qlist" id="qList" style="margin-top:10px"></div>
          <p class="muted" id="qCount"></p>
        </div>
        <div class="panel" id="qForm"></div>
      </div>`;
    drawList();
    drawForm();

    $('qFind').oninput = (e) => { qSearch = e.target.value; drawList(); };
    $('qNew').onclick = () => { qs.push(blankQ()); qSel = qs.length - 1; qDirty = true; qSearch = ''; $('qFind').value = ''; drawList(); drawForm(); };
    $('qDup').onclick = () => {
      if (!qs[qSel]) return;
      const c = JSON.parse(JSON.stringify(qs[qSel]));
      c.id = 'q' + Date.now().toString(36);
      c.title = c.title + ' (cópia)';
      qs.splice(qSel + 1, 0, c);
      qSel += 1; qDirty = true; drawList(); drawForm();
    };
    $('qDel').onclick = () => {
      if (!qs[qSel]) return;
      if (qs.length === 1) { $('qMsg').textContent = 'É preciso manter pelo menos uma pergunta.'; return; }
      if (!confirm('Excluir esta pergunta? (O histórico de respostas dela é mantido nas métricas.)')) return;
      qs.splice(qSel, 1);
      qSel = Math.max(0, qSel - 1); qDirty = true; drawList(); drawForm();
    };
    $('qReset').onclick = async () => {
      if (!confirm('Substituir TODAS as perguntas pelas 12 originais? Suas alterações e perguntas próprias serão perdidas.')) return;
      const r = await X.api.adminResetQuestions();
      if (await guardFail(r)) return;
      qs = r.questions; qSel = 0; qDirty = false; await X.reloadAll(); drawQuestions();
      $('qMsg').className = 'ok'; $('qMsg').textContent = 'Perguntas originais restauradas.';
    };
    $('qDiscard').onclick = () => { if (!qDirty || confirm('Descartar as alterações não salvas?')) renderQuestions(); };
    $('qSave').onclick = saveQuestions;
  }

  function drawList() {
    const term = qSearch.trim().toLowerCase();
    const items = qs.map((q, i) => [q, i]).filter(([q]) => !term || (q.topic + ' ' + q.question + ' ' + q.title).toLowerCase().includes(term));
    $('qList').innerHTML = items.map(([q, i]) => qLabel(q, i)).join('') || '<p class="muted">Nenhuma pergunta encontrada.</p>';
    $('qCount').textContent = qs.length + ' pergunta(s)' + (qDirty ? ' · alterações não salvas' : '');
    $('qList').querySelectorAll('.qitem').forEach((el) => (el.onclick = () => { qSel = Number(el.dataset.i); drawList(); drawForm(); }));
  }

  function drawForm() {
    const q = qs[qSel];
    const f = $('qForm');
    if (!q) { f.innerHTML = '<p class="muted">Crie uma pergunta.</p>'; return; }
    f.innerHTML = `
      <div class="grid3">
        <div><label for="fTopic">Tema</label><input type="text" id="fTopic" maxlength="60" value="${esc(q.topic)}"></div>
        <div><label for="fGrade">Ano/série (opcional)</label><input type="text" id="fGrade" maxlength="20" value="${esc(q.grade)}"></div>
      </div>
      <label for="fTitle">Título do texto</label><input type="text" id="fTitle" maxlength="120" value="${esc(q.title)}">
      <label for="fText">Texto de leitura</label><textarea id="fText" rows="6" maxlength="3000">${esc(q.text)}</textarea>
      <label for="fQuestion">Enunciado da pergunta</label><textarea id="fQuestion" rows="2" maxlength="500">${esc(q.question)}</textarea>
      <label>Alternativas (marque a correta)</label>
      ${[0, 1, 2, 3].map((i) => `<div class="optrow"><input type="radio" name="fCorrect" value="${i}" ${q.correct === i ? 'checked' : ''} aria-label="Alternativa ${LET[i]} é a correta"><span>${LET[i]}</span><input type="text" data-opt="${i}" maxlength="300" value="${esc(q.options[i])}"></div>`).join('')}
      <label for="fExp">Explicação mostrada após responder</label><textarea id="fExp" rows="3" maxlength="1000">${esc(q.explanation)}</textarea>
      <p class="muted">Código interno: ${esc(q.id)}</p>`;
    const touch = () => { qDirty = true; const c = $('qCount'); if (c) c.textContent = qs.length + ' pergunta(s) · alterações não salvas'; };
    const bind = (id, key) => { $(id).oninput = (e) => { q[key] = e.target.value; touch(); updateItem(); }; };
    bind('fTopic', 'topic'); bind('fGrade', 'grade'); bind('fTitle', 'title'); bind('fText', 'text'); bind('fQuestion', 'question'); bind('fExp', 'explanation');
    f.querySelectorAll('[data-opt]').forEach((el) => (el.oninput = (e) => { q.options[Number(el.dataset.opt)] = e.target.value; touch(); }));
    f.querySelectorAll('input[name=fCorrect]').forEach((el) => (el.onchange = () => { q.correct = Number(el.value); touch(); }));
  }

  function updateItem() {
    const el = $('qList').querySelector(`.qitem[data-i="${qSel}"]`);
    if (el) el.outerHTML = qLabel(qs[qSel], qSel);
    const again = $('qList').querySelector(`.qitem[data-i="${qSel}"]`);
    if (again) again.onclick = () => { qSel = Number(again.dataset.i); drawList(); drawForm(); };
  }

  function validateQs() {
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i], n = i + 1;
      if (!q.topic.trim()) return [i, 'Pergunta ' + n + ': informe o tema.'];
      if (!q.title.trim()) return [i, 'Pergunta ' + n + ': informe o título do texto.'];
      if (!q.text.trim()) return [i, 'Pergunta ' + n + ': informe o texto de leitura.'];
      if (!q.question.trim()) return [i, 'Pergunta ' + n + ': informe o enunciado.'];
      if (q.options.some((o) => !o.trim())) return [i, 'Pergunta ' + n + ': preencha as 4 alternativas.'];
      if (new Set(q.options.map((o) => o.trim())).size !== 4) return [i, 'Pergunta ' + n + ': as alternativas devem ser diferentes entre si.'];
    }
    return null;
  }

  async function saveQuestions() {
    const msg = $('qMsg');
    msg.className = 'err'; msg.textContent = '';
    const bad = validateQs();
    if (bad) { qSel = bad[0]; drawList(); drawForm(); msg.textContent = bad[1]; return; }
    const r = await X.api.adminSaveQuestions(qs);
    if (await guardFail(r)) return;
    if (!r.ok) { msg.textContent = r.error || 'Não foi possível salvar.'; return; }
    qs = r.questions; qDirty = false;
    await X.reloadAll();
    drawList(); drawForm();
    msg.className = 'ok'; msg.textContent = 'Perguntas salvas. Já valem para os próximos jogadores.';
  }

  // ======================================================================
  // APARÊNCIA E AJUSTES
  // ======================================================================
  async function renderSettings() {
    const b = body();
    b.innerHTML = '<p class="muted">Carregando…</p>';
    const r = await X.api.adminGetConfig();
    if (await guardFail(r)) return;
    draftCfg = JSON.parse(JSON.stringify(r.config));
    cfgDirty = false;
    const c = draftCfg;
    b.innerHTML = `
      <div class="toolbar"><span style="flex:1"></span><button id="sSave" class="primary">Salvar ajustes</button></div>
      <div id="sMsg" class="err"></div>
      <div class="panel">
        <h3>Tema e aparência</h3>
        <div class="toolbar">
          <div style="flex:1;min-width:240px"><label for="tTitle">Nome do jogo (título da janela e do menu)</label><input type="text" id="tTitle" maxlength="40" value="${esc(c.theme.appTitle)}"></div>
          <div>${Object.keys(PRESETS).map((k) => `<button data-preset="${esc(k)}">${esc(k)}</button>`).join(' ')}</div>
        </div>
        <div class="colors">${THEME_FIELDS.map(([k, l]) => `<div><label for="c_${k}">${l}</label><input type="color" id="c_${k}" data-k="${k}" value="${esc(c.theme[k])}"></div>`).join('')}</div>
        <p class="muted">As cores são aplicadas na hora para você conferir. Só valem para todos depois de “Salvar ajustes”.</p>
      </div>
      <div class="panel">
        <h3>Corrida</h3>
        <div class="grid3">
          <div><label for="sRun">Duração da corrida até a energia acabar (s)</label><input type="number" id="sRun" min="5" max="300" step="1" value="${c.runSeconds}"></div>
          <div><label for="sSp">Velocidade inicial</label><input type="number" id="sSp" min="150" max="900" step="10" value="${c.speedBase}"></div>
          <div><label for="sGr">Aumento de velocidade por segundo</label><input type="number" id="sGr" min="0" max="20" step="0.5" value="${c.speedGrowth}"></div>
        </div>
        <div class="grid3">
          <div><label for="mOk">Ritmo após acertar sozinho(a) (×)</label><input type="number" id="mOk" min="0.3" max="3" step="0.05" value="${c.mult.autonomousCorrect}"></div>
          <div><label for="mNo">Ritmo após errar sozinho(a) (×)</label><input type="number" id="mNo" min="0.3" max="3" step="0.05" value="${c.mult.autonomousWrong}"></div>
          <div><label for="mAi">Ritmo após usar a IA (×)</label><input type="number" id="mAi" min="0.3" max="3" step="0.05" value="${c.mult.ai}"></div>
        </div>
        <label class="chk"><input type="checkbox" id="oRe" ${c.showTextDuringQuestion ? 'checked' : ''}> Permitir reler o texto durante a pergunta</label>
        <label class="chk"><input type="checkbox" id="oDis" ${c.showAIDisclaimer ? 'checked' : ''}> Mostrar o aviso “A IA pode errar” junto da sugestão</label>
      </div>
      <div class="panel">
        <h3>Inteligência Artificial</h3>
        <div class="grid3">
          <div><label for="aProv">Fonte da resposta da IA</label>
            <select id="aProv"><option value="simulado" ${c.ai.provider === 'simulado' ? 'selected' : ''}>Simulada (testes, sem internet)</option><option value="anthropic" ${c.ai.provider === 'anthropic' ? 'selected' : ''}>IA real (API da Anthropic, com internet)</option></select></div>
          <div><label for="aModel">Modelo</label><input type="text" id="aModel" maxlength="80" value="${esc(c.ai.model)}"></div>
          <div><label for="aErr">Erro proposital na IA simulada (%)</label><input type="number" id="aErr" min="0" max="100" step="5" value="${Math.round(c.ai.simulatedErrorRate * 100)}"></div>
        </div>
        <label for="aKey">Chave da API ${c._hasKey ? '(já há uma chave salva — deixe em branco para mantê-la)' : '(nenhuma chave salva)'}</label>
        <input type="password" id="aKey" autocomplete="off" placeholder="${c._hasKey ? '••••••••••••' : 'cole a chave aqui'}">
        <label class="chk"><input type="checkbox" id="aClear"> Remover a chave salva</label>
        <div class="row" style="justify-content:flex-start"><button id="aTest" style="flex:0 0 auto">Testar a IA (usa os ajustes já salvos)</button></div>
        <div id="aTestMsg" class="muted" style="margin-top:8px"></div>
        <p class="muted">A chave fica guardada neste computador e nunca é mostrada de volta.</p>
      </div>`;

    const touch = () => { cfgDirty = true; };
    const readTheme = () => {
      const t = { appTitle: $('tTitle').value };
      THEME_FIELDS.forEach(([k]) => { t[k] = $('c_' + k).value; });
      return t;
    };
    const preview = () => { touch(); X.applyTheme(readTheme()); };
    $('tTitle').oninput = preview;
    THEME_FIELDS.forEach(([k]) => { $('c_' + k).oninput = preview; });
    b.querySelectorAll('[data-preset]').forEach((btn) => (btn.onclick = () => {
      const p = PRESETS[btn.dataset.preset] || DEFAULT_CONFIG.theme;
      THEME_FIELDS.forEach(([k]) => { $('c_' + k).value = p[k]; });
      preview();
    }));
    b.querySelectorAll('input,select').forEach((el) => el.addEventListener('input', touch));

    $('aTest').onclick = async () => {
      const out = $('aTestMsg');
      out.textContent = 'Consultando…';
      const q = (await X.api.getQuestions())[0];
      const res = await X.api.askAI({ id: q.id, text: q.text, question: q.question, options: q.options, correct: q.correct });
      out.textContent = res && res.ok
        ? 'Funcionou: a IA (' + res.source + ') respondeu a alternativa ' + res.letter + ' em ' + res.latencyMs + ' ms.'
        : 'Falhou: ' + ((res && res.error) || 'sem resposta') + '. Verifique a internet e a chave.';
    };

    $('sSave').onclick = async () => {
      const msg = $('sMsg');
      msg.className = 'err'; msg.textContent = '';
      const patch = {
        runSeconds: Number($('sRun').value), speedBase: Number($('sSp').value), speedGrowth: Number($('sGr').value),
        mult: { autonomousCorrect: Number($('mOk').value), autonomousWrong: Number($('mNo').value), ai: Number($('mAi').value) },
        showTextDuringQuestion: $('oRe').checked, showAIDisclaimer: $('oDis').checked,
        ai: { provider: $('aProv').value, model: $('aModel').value, simulatedErrorRate: Number($('aErr').value) / 100, apiKey: $('aKey').value, clearKey: $('aClear').checked },
        theme: readTheme()
      };
      if (patch.ai.provider === 'anthropic' && !patch.ai.apiKey.trim() && (!c._hasKey || patch.ai.clearKey)) {
        msg.textContent = 'Para usar a IA real, informe a chave da API.'; return;
      }
      const r = await X.api.adminSaveConfig(patch);
      if (await guardFail(r)) return;
      if (!r.ok) { msg.textContent = r.error || 'Não foi possível salvar.'; return; }
      cfgDirty = false;
      await X.reloadAll();
      renderSettings();
      setTimeout(() => { const m = $('sMsg'); if (m) { m.className = 'ok'; m.textContent = 'Ajustes salvos.'; } }, 50);
    };
  }

  // ======================================================================
  // CONTA
  // ======================================================================
  function renderAccount() {
    body().innerHTML = `
      <div class="panel" style="max-width:520px">
        <h3>Alterar senha do administrador</h3>
        <label for="pOld">Senha atual</label><input type="password" id="pOld" autocomplete="off">
        <label for="pNew">Nova senha (mínimo de 6 caracteres)</label><input type="password" id="pNew" autocomplete="off">
        <label for="pNew2">Repita a nova senha</label><input type="password" id="pNew2" autocomplete="off">
        <div id="pMsg" class="err"></div>
        <div class="row"><button class="primary" id="pGo">Alterar senha</button></div>
        <p class="muted">Se esquecer a senha, feche o jogo e apague o arquivo <b>admin.json</b> da pasta de dados (veja o README); na próxima vez será pedido para criar uma nova. As perguntas e os dados não são afetados.</p>
      </div>`;
    $('pGo').onclick = async () => {
      const m = $('pMsg');
      m.className = 'err'; m.textContent = '';
      if ($('pNew').value !== $('pNew2').value) { m.textContent = 'As novas senhas não coincidem.'; return; }
      const r = await X.api.adminChangePassword($('pOld').value, $('pNew').value);
      if (await guardFail(r)) return;
      if (r.ok) { m.className = 'ok'; m.textContent = 'Senha alterada.'; ['pOld', 'pNew', 'pNew2'].forEach((i) => ($(i).value = '')); }
      else m.textContent = r.error || 'Não foi possível alterar.';
    };
  }

  return { open };
})();
