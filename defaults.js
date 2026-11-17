// Configuração padrão. Usada pelo processo principal (Electron) e pela interface.
// Tudo aqui pode ser alterado dentro do jogo, na Área do administrador.
(function (g) {
  const d = {
    // Duração da corrida (segundos) até a energia acabar
    runSeconds: 30,
    // Velocidade base (pixels/segundo) e crescimento ao longo da corrida
    speedBase: 360,
    speedGrowth: 4,
    // Multiplicadores de velocidade aplicados após cada atividade
    mult: {
      autonomousCorrect: 1.0, // respondeu sozinho(a) e acertou
      autonomousWrong: 0.85,  // respondeu sozinho(a) e errou
      ai: 1.3                 // pediu ajuda da IA
    },
    // Mostrar o texto de apoio (reler) durante a questão
    showTextDuringQuestion: true,
    // Mostrar aviso neutro "a IA pode errar" junto da resposta da IA
    showAIDisclaimer: true,
    ai: {
      // 'simulado' (para testes, sem internet) ou 'anthropic' (API real)
      provider: 'simulado',
      apiKey: '',
      model: 'claude-sonnet-5-5',
      // Só no modo simulado: chance da IA sugerir uma alternativa errada
      simulatedErrorRate: 0.2,
      timeoutMs: 20000
    },
    theme: {
      appTitle: 'Corrida do Saber',
      bg: '#f4f1ea',
      card: '#ffffff',
      ink: '#2b2f36',
      muted: '#6b7280',
      line: '#d9d4c7',
      accent: '#2f6f4f',
      warn: '#c2410c',
      stageBg: '#fbfaf6',
      playerBody: '#2f6f4f',
      playerPack: '#e8a33d',
      rock: '#8a8f98',
      drone: '#c2410c'
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = d;
  else g.DEFAULT_CONFIG = d;
})(typeof globalThis !== 'undefined' ? globalThis : this);
