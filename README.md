# Corrida do Saber

Jogo educacional de Ciências (produto do mestrado): o personagem corre, a energia acaba e, para continuar, o estudante lê um texto e responde uma questão, escolhendo entre **tentar sozinho(a)** ou **pedir ajuda da IA**. Cada escolha muda o ritmo da corrida e é registrada para a pesquisa.

Aplicativo de desktop para **Windows 10 (64 bits)**, instalado no computador. Tudo (jogo, perguntas, tema e métricas) é gerenciado dentro do próprio app, na **Área do administrador**.

## 1. Gerar o instalador (.exe)

O instalador precisa ser gerado em um Windows (ou na nuvem, opção B). Escolha uma opção:

**A) No seu Windows**
1. Instale o [Node.js](https://nodejs.org) (versão LTS).
2. Dê dois cliques em `gerar-instalador.bat` (precisa de internet na primeira vez).
3. O instalador `Corrida-do-Saber-Setup-1.0.0.exe` aparece na pasta `dist`.

**B) Na nuvem, sem instalar nada (GitHub Actions)**
1. Crie um repositório no GitHub e envie esta pasta (inclusive `.github`).
2. Abra a aba *Actions* → *Gerar instalador Windows* → *Run workflow* (também roda a cada envio).
3. Ao terminar, baixe o arquivo em *Artifacts* (`Corrida-do-Saber-Setup`).

**Instalando:** dê dois cliques no `.exe`. A instalação é por usuário (não pede administrador do Windows), permite escolher a pasta e cria atalhos na Área de Trabalho e no Menu Iniciar.

> O instalador não é assinado digitalmente. No primeiro uso o Windows pode mostrar “O Windows protegeu o computador” (SmartScreen): clique em *Mais informações* → *Executar assim mesmo*. Para evitar o aviso é preciso um certificado de assinatura de código (pago).

## 2. Área do administrador

No menu inicial do jogo, clique em **Área do administrador** (link discreto no rodapé do cartão).

- **Primeiro acesso:** o app pede para criar a senha (mínimo de 6 caracteres). Ela é guardada apenas como hash (scrypt), nunca em texto.
- **Métricas:** painel com participantes, sessões, corridas, atividades respondidas, comparação sozinho(a) × com IA (acerto e tempo), **dependência da IA** (quanto o estudante seguiu a IA quando ela acertou e quando ela errou), evolução ao longo das atividades, tabela por participante com a sequência de respostas, e por tema. Filtros por participante e turma. Botões para exportar CSV, abrir a pasta de dados e arquivar/zerar os dados (o arquivo antigo é guardado como cópia `.bak.jsonl`).
- **Perguntas:** criar, editar, duplicar, excluir e buscar perguntas (tema, texto de leitura, enunciado, 4 alternativas, gabarito e explicação). Valida os campos antes de salvar. Há botão para restaurar as 12 perguntas originais.
- **Aparência e ajustes:** nome do jogo, 12 cores (com prévia na hora e predefinições Claro, Escuro, Alto contraste e Oceano); duração da corrida, velocidades e o multiplicador de ritmo de cada situação (acertou sozinho, errou sozinho, usou IA); opções de reler o texto e do aviso “A IA pode errar”; escolha entre IA simulada e IA real, com campo da chave de API e botão de teste.
- **Conta:** alterar a senha.

Ao sair do modo administrador, o acesso é encerrado. As telas de administração só funcionam com login: o processo principal do app recusa qualquer chamada sem autenticação.

### Esqueci a senha
Feche o jogo e apague o arquivo `admin.json` em `%APPDATA%\Corrida do Saber`. Na próxima vez, o app pede para criar uma nova senha. Perguntas e dados não são afetados.

## 3. Onde ficam os dados

`%APPDATA%\Corrida do Saber` (abra pelo painel: *Métricas → Abrir pasta de dados*):

| Arquivo | Conteúdo |
|---|---|
| `events.jsonl` | todos os eventos de jogo (um por linha) |
| `questions.json` | perguntas editadas (se não existir, valem as originais) |
| `config.json` | ajustes e tema |
| `admin.json` | senha (hash) |

Desinstalar o app **não apaga** esses arquivos. Para fazer backup da pesquisa, copie essa pasta ou use *Exportar CSV*.

Eventos registrados: `session_start`, `run_start`, `rest_start`, `reading_done`, `mode_choice`, `ai_request`, `ai_response`, `ai_error`, `mode_switch`, `answer`, `run_resume`, `run_end`. Em cada resposta: participante, turma, sessão, nº da corrida, questão, tema, modo (`own`/`ai`), alternativa sugerida pela IA, se a IA acertou (`aiCorrect`), latência da IA, resposta, acerto, se mudou a resposta após a IA, tempos de leitura e de resposta, multiplicador e distância. O participante é identificado só por um código informado por ele.

## 4. IA real e internet

Por padrão a IA é **simulada** (funciona offline, errando em 20% dos casos). Para usar a IA real, em *Aparência e ajustes → Inteligência Artificial* escolha “IA real”, cole a chave da API e salve. Só o texto da questão é enviado à IA, e só quando o estudante pede ajuda; sem internet, o jogo avisa e o estudante pode tentar sozinho(a).

**Atenção:** a chave fica salva no computador onde foi cadastrada (em `config.json`). Em computadores compartilhados com estudantes, prefira cadastrá-la só nas máquinas necessárias; para uso em larga escala, o ideal é um pequeno servidor seu guardando a chave (a função `ai:ask` em `main.js` é o único ponto a alterar).

## 5. Estrutura

`main.js` (janela, IA, arquivos, login e regras do administrador) · `preload.js` (ponte segura) · `index.html` / `style.css` · `game.js` (motor, telas, tema e registro) · `admin.js` (painel do administrador) · `questions.js` (perguntas originais) · `defaults.js` (padrões) · `browser-api.js` (só para testar abrindo o `index.html` no navegador; não é usado no app) · `build/` (ícone) · `.github/workflows` (gerador na nuvem)

Para rodar em desenvolvimento: `npm install` e `npm start`.
