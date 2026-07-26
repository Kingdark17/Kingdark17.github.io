# RPG Legend

Um RPG de exploracao, progressao e combate rodando 100% no navegador —
HTML, CSS e JavaScript puro, sem frameworks, sem build, sem servidor.

## Como jogar

Abra `index.html` diretamente no navegador (duplo-clique ou arraste para
uma aba). Nao precisa de internet, exceto para carregar as fontes do
Google Fonts (o jogo funciona normalmente sem elas, so troca a tipografia).

## O que ja esta implementado

- **Menu principal**: Novo Jogo, Continuar (le o `localStorage`),
  Configuracoes (liga/desliga som) e Creditos.
- **Criacao de personagem**: nome, raca, classe, ate 2 poderes e 1 fraqueza
  (debuff), modo solo ou em equipe (2 companheiros gerados).
- **Cidade exploravel**: vendedor, ferreiro, taverna (descanso restaura
  vida/mana), quadro de missoes, NPCs com dialogo e o portao da masmorra.
- **Masmorra com andares sem limite**: cada andar tem mais monstros e
  monstros mais fortes que o anterior (vida, velocidade e dano escalam
  com a profundidade). A cada 5 andares aparece um mini-chefe, a cada 10
  um chefe principal — ambos com nomes e atributos proprios.
- **Neblina de guerra**: so o caminho ja percorrido fica visivel; o
  conteudo de uma sala (NPC, monstro, bau...) so aparece quando o jogador
  se aproxima dela.
- **Movimento por direcao relativa**: Frente / Esquerda / Direita / Voltar,
  com suporte a WASD e setas do teclado. Cada sala especial pede
  confirmacao (Sim/Nao) antes de entrar.
- **Combate**: ao encontrar um inimigo, escolha Enfrentar ou Fugir.
  Fugir exige uma rolagem de d20 (com bonus se a Destreza do heroi for
  maior que a velocidade do monstro); falhar jogar o combate forcado.
  O combate substitui o mapa por uma cena propria, com dano flutuante,
  critico, e a criatura contra-ataca quando o jogador erra.
- **Mesa de dados**: d4, d6, d8, d10, d12, d20 e d100, com animacao de
  rolagem 3D.
- **Ouro e comercio**: bolsa de moedas visivel na ficha; vendedor (itens
  gerais/consumiveis) e ferreiro (armas/armaduras/acessorios) com
  estoque aleatorio que pode ser renovado, compra e venda de itens.
- **Itens com raridade**: Comum, Incomum, Raro, Epico, Lendario e Mitico,
  cada uma com cor propria e multiplicador de atributos/valor. Os itens
  sao gerados proceduralmente a partir de "moldes" (arma, armadura,
  acessorio, consumivel, material).
- **Inventario por categoria**: abas (Todos/Armas/Armaduras/Acessorios/
  Consumiveis/Materiais), equipar, desequipar, usar (pocoes) e descartar.
- **XP e nivel**: ganha experiencia ao derrotar monstros e completar
  missoes; sobe de nivel automaticamente, aumentando vida, mana e
  atributos.
- **Missoes simples**: matar N monstros, alcancar um andar, coletar itens
  — sempre 2 disponiveis no quadro, renovadas ao serem resgatadas.
- **Efeitos**: dano flutuante, tremida ao levar dano, flash ao subir de
  nivel, efeitos sonoros curtos gerados via Web Audio API (sem arquivos
  de audio externos).
- **Salvamento automatico**: heroi, equipe, inventario, ouro, XP, andar,
  missoes e preferencia de som ficam salvos no `localStorage` a cada
  acao relevante (mover, comprar, vender, evoluir, etc).

## Estrutura de arquivos

```
rpg-legend/
  index.html          tela unica que referencia todos os modulos
  css/
    style.css          tema visual, layout, HUD, modais
    animations.css      keyframes (dados, dano flutuante, level up...)
  js/
    items.js            catalogo de itens + raridade + geracao aleatoria
    monsters.js          especies de monstros + escala por andar + chefes
    player.js             racas, classes, poderes, debuffs, XP/nivel, equipamento
    map.js                 geracao de corredores, neblina, direcoes/rotacao
    city.js                  mapa da cidade inicial
    dungeon.js                mapa de cada andar da masmorra
    combat.js                  mesa de dados + fugir/enfrentar + resolucao do combate
    inventory.js                 modal da mochila (abas, equipar, vender, descartar)
    shop.js                       comerciante e ferreiro (compra/venda/estoque)
    quests.js                      quadro de missoes
    effects.js                      som (Web Audio) + dano flutuante + animacoes
    save.js                          leitura/escrita do localStorage
    ui.js                              cola tudo: ficha, mapa, dialogo, controles
    main.js                             menu principal e inicializacao
```

Cada arquivo se anexa a um unico objeto global `RPG` (ex: `RPG.Items`,
`RPG.Combat`, `RPG.UI`...) — nao usamos `import`/`export` de modulos ES
de proposito, porque isso quebra ao abrir o arquivo direto do disco
(`file://`) na maioria dos navegadores. Assim o jogo funciona so com
duplo-clique, sem precisar subir um servidor local.

## Limitacoes conhecidas / proximos passos

Por serem itens grandes o suficiente para merecer uma fase propria, o
que segue **nao** esta nesta primeira entrega:

- **Sprites em pixel art / personagens e monstros animados** — hoje tudo
  usa icones (emoji). Eu nao gero sprite sheets prontos; da para evoluir
  para SVGs desenhados a mao, mas e um trabalho separado.
- **Musica ambiente** — os efeitos sonoros curtos (golpe, ouro, level up...)
  ja existem via Web Audio, mas trilha sonora de fundo nao foi incluida
  (eu nao anexo arquivos de audio prontos).
- **Arvore de habilidades / especializacao por classe** — os "poderes"
  escolhidos na criacao sao flavor/identidade do personagem por enquanto;
  eles ainda nao alteram numeros no combate.
- **50+ especies unicas de monstro** — em vez disso, 10 especies-base
  ganham prefixos ("Corrompido", "Ancestral", "Amaldicoado", "Lendario")
  conforme o andar, o que da a sensacao de variedade sem precisar de
  50 comportamentos de IA diferentes.
- **Layout do mapa nao e salvo** — o save guarda todo o progresso do
  personagem (nivel, itens, ouro, missoes, andar), mas ao continuar o
  jogo o mapa daquele local e regenerado do zero (o andar certo, so que
  com um layout novo).
- **Tiles variados (grama, agua, lava, pontes...)** — o mapa hoje usa um
  unico estilo de "corredor" para cidade e masmorra; dar mais variedade
  visual ao terreno e outra fase possivel.

Cada um desses pontos e um bom proximo passo, mas nenhum bloqueia o
jogo funcionar — a base (personagem, exploracao, combate, comercio,
progressao e save) esta completa e jogavel de ponta a ponta.
