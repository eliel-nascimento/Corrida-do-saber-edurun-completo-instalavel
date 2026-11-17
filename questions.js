// Banco de atividades. Para adicionar conteúdos, copie um bloco e altere os campos.
// correct = índice (0 a 3) da alternativa correta.
window.QUESTIONS = [
  {
    id: 'bio01', topic: 'Fotossíntese', grade: '6º-7º',
    title: 'Como as plantas produzem alimento',
    text: 'As plantas fabricam o próprio alimento por meio da fotossíntese. Nas folhas, a clorofila absorve a luz do Sol. Com essa energia, a planta transforma a água retirada do solo e o gás carbônico (CO₂) do ar em glicose, um tipo de açúcar. Nesse processo, a planta libera oxigênio (O₂) para a atmosfera.',
    question: 'Qual gás a planta absorve do ar para realizar a fotossíntese?',
    options: ['Oxigênio', 'Gás carbônico (CO₂)', 'Nitrogênio', 'Hidrogênio'],
    correct: 1,
    explanation: 'A planta absorve gás carbônico e libera oxigênio. A glicose produzida é usada como fonte de energia e matéria para o crescimento.'
  },
  {
    id: 'ter01', topic: 'Ciclo da água', grade: '6º-7º',
    title: 'A água em movimento',
    text: 'A água da Terra circula continuamente entre oceanos, atmosfera e continentes. Com o calor do Sol, a água líquida de rios, lagos e mares passa para o estado gasoso. Esse vapor sobe, esfria e forma as nuvens. Depois, a água volta à superfície na forma de chuva, granizo ou neve.',
    question: 'Como se chama a passagem da água do estado líquido para o gasoso causada pelo calor do Sol?',
    options: ['Condensação', 'Precipitação', 'Evaporação', 'Infiltração'],
    correct: 2,
    explanation: 'Evaporação é a mudança do estado líquido para o gasoso. A condensação é o caminho inverso, que forma as nuvens.'
  },
  {
    id: 'bio02', topic: 'Células', grade: '7º-8º',
    title: 'A usina de energia da célula',
    text: 'As células possuem estruturas chamadas organelas, cada uma com uma função. As mitocôndrias realizam a respiração celular: utilizam o oxigênio para transformar a glicose em energia que a célula consegue usar. Por isso, células que gastam muita energia, como as musculares, costumam ter muitas mitocôndrias.',
    question: 'Qual organela é responsável por liberar a energia que a célula usa?',
    options: ['Núcleo', 'Mitocôndria', 'Ribossomo', 'Parede celular'],
    correct: 1,
    explanation: 'As mitocôndrias fazem a respiração celular, liberando a energia contida na glicose.'
  },
  {
    id: 'ast01', topic: 'Terra e Sol', grade: '6º-7º',
    title: 'Por que existem dia e noite',
    text: 'A Terra realiza dois movimentos principais. No movimento de rotação, ela gira em torno do próprio eixo, o que leva cerca de 24 horas. No movimento de translação, ela percorre sua órbita ao redor do Sol, o que leva cerca de 365 dias. Como a Terra é esférica, apenas uma parte dela recebe luz do Sol de cada vez.',
    question: 'Qual movimento da Terra é responsável pela sucessão de dias e noites?',
    options: ['Translação', 'Eclipse', 'Rotação', 'Fases da Lua'],
    correct: 2,
    explanation: 'A rotação, em cerca de 24 horas, faz cada região ficar voltada para o Sol (dia) e depois para o lado oposto (noite).'
  },
  {
    id: 'eco01', topic: 'Cadeias alimentares', grade: '6º-7º',
    title: 'Quem faz o quê em um ecossistema',
    text: 'Em uma cadeia alimentar, os produtores (como as plantas) fabricam seu alimento pela fotossíntese. Os consumidores se alimentam de outros seres vivos. Os decompositores, como fungos e bactérias, atuam sobre restos de seres vivos mortos e excretas, transformando a matéria orgânica em nutrientes que voltam ao solo e podem ser usados novamente pelos produtores.',
    question: 'Qual é o papel dos fungos e bactérias decompositores em uma cadeia alimentar?',
    options: [
      'Produzir alimento pela fotossíntese',
      'Caçar os consumidores',
      'Decompor matéria orgânica e devolver nutrientes ao ambiente',
      'Fornecer luz solar às plantas'
    ],
    correct: 2,
    explanation: 'Os decompositores reciclam a matéria orgânica, devolvendo nutrientes ao ambiente.'
  },
  {
    id: 'qui01', topic: 'Misturas', grade: '6º-7º',
    title: 'Misturas homogêneas e heterogêneas',
    text: 'Uma mistura reúne duas ou mais substâncias. Quando a mistura apresenta uma única fase, ou seja, parece uma coisa só a olho nu, ela é homogênea, como a água com sal dissolvido. Quando é possível ver duas ou mais fases, ela é heterogênea, como a água com areia.',
    question: 'Qual das opções é uma mistura heterogênea?',
    options: ['Água com sal totalmente dissolvido', 'Água e óleo', 'Álcool e água', 'Ar atmosférico filtrado'],
    correct: 1,
    explanation: 'Água e óleo não se misturam e formam duas fases visíveis, por isso a mistura é heterogênea.'
  },
  {
    id: 'fis01', topic: 'Eletricidade', grade: '8º-9º',
    title: 'Condutores e isolantes',
    text: 'Materiais condutores permitem a passagem da corrente elétrica com facilidade. Os metais, como o cobre, são bons condutores. Já os isolantes dificultam muito essa passagem. Borracha, plástico e vidro são exemplos. Por isso os fios elétricos têm o metal por dentro e uma capa de plástico por fora.',
    question: 'Qual dos materiais abaixo é um isolante elétrico?',
    options: ['Cobre', 'Alumínio', 'Borracha', 'Ferro'],
    correct: 2,
    explanation: 'A borracha dificulta a passagem da corrente elétrica, enquanto cobre, alumínio e ferro são metais condutores.'
  },
  {
    id: 'qui02', topic: 'Ácidos e bases', grade: '8º-9º',
    title: 'A escala de pH',
    text: 'O pH indica se uma solução é ácida, neutra ou básica. A escala vai de 0 a 14. Valores menores que 7 indicam soluções ácidas, como o suco de limão. O valor 7 indica solução neutra, como a água pura. Valores maiores que 7 indicam soluções básicas, como a água com sabão.',
    question: 'Uma solução com pH igual a 3 é:',
    options: ['Ácida', 'Neutra', 'Básica', 'Salgada'],
    correct: 0,
    explanation: 'Todo pH menor que 7 indica solução ácida.'
  },
  {
    id: 'sau01', topic: 'Vacinas', grade: '8º-9º',
    title: 'Como as vacinas protegem',
    text: 'As vacinas contêm versões enfraquecidas ou partes de microrganismos, ou instruções para produzi-las, sem causar a doença. Ao receber a vacina, o sistema imunológico reconhece esse material e produz anticorpos. Ele também forma células de memória, que permitem uma resposta mais rápida caso a pessoa entre em contato com o microrganismo real no futuro.',
    question: 'O que uma vacina estimula no corpo humano?',
    options: [
      'A produção de antibióticos pelo corpo',
      'A memória imunológica e a produção de anticorpos',
      'O crescimento de bactérias úteis',
      'A eliminação de vitaminas'
    ],
    correct: 1,
    explanation: 'A vacina treina o sistema imunológico, que passa a reconhecer e combater mais rápido o microrganismo.'
  },
  {
    id: 'amb01', topic: 'Fontes de energia', grade: '6º-9º',
    title: 'Energias renováveis',
    text: 'Fontes de energia renováveis se regeneram em um tempo curto na escala humana ou não se esgotam. São exemplos a energia solar, a eólica (dos ventos) e a hidráulica. Já o carvão mineral, o petróleo e o gás natural são combustíveis fósseis, formados ao longo de milhões de anos e, por isso, considerados não renováveis.',
    question: 'Qual das fontes de energia abaixo é renovável?',
    options: ['Carvão mineral', 'Petróleo', 'Eólica', 'Gás natural'],
    correct: 2,
    explanation: 'A energia eólica usa a força dos ventos, que se renovam. Os demais são combustíveis fósseis.'
  },
  {
    id: 'ter02', topic: 'Placas tectônicas', grade: '6º-9º',
    title: 'Por que a Terra treme',
    text: 'A crosta terrestre é dividida em grandes blocos chamados placas tectônicas, que se movem lentamente sobre o manto. Quando duas placas se chocam, se afastam ou deslizam uma ao lado da outra, a energia acumulada pode ser liberada de uma vez. Essa liberação provoca tremores conhecidos como terremotos.',
    question: 'Qual é a principal causa dos terremotos?',
    options: ['Chuvas fortes', 'Movimento das placas tectônicas', 'Fases da Lua', 'Ventos fortes'],
    correct: 1,
    explanation: 'Os terremotos acontecem principalmente pela liberação de energia acumulada no movimento das placas tectônicas.'
  },
  {
    id: 'bio03', topic: 'Genética', grade: '8º-9º',
    title: 'Onde está o material genético',
    text: 'O DNA guarda as informações genéticas dos seres vivos. Em células animais e vegetais, a maior parte do DNA fica dentro do núcleo, organizado em estruturas chamadas cromossomos. Essas informações determinam características herdadas dos pais e orientam o funcionamento da célula.',
    question: 'Em uma célula animal, onde fica a maior parte do DNA?',
    options: ['No núcleo', 'Na parede celular', 'Solto fora da célula', 'Na membrana plasmática'],
    correct: 0,
    explanation: 'O núcleo contém a maior parte do DNA, organizado em cromossomos. (Células animais não têm parede celular.)'
  }
];
