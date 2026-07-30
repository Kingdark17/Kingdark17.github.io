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
- **Mapa em salas conectadas (estilo Binding of Isaac)**: cidade e
  masmorra sao um grafo de salas ligadas por portas (Norte/Sul/Leste/
  Oeste), nao mais corredores de tiles. O minimapa mostra a "silhueta"
  de qualquer sala vizinha a uma sala ja visitada (contorno apagado,
  sem revelar o conteudo), e so mostra o icone real quando o jogador
  entra nela. Salas fora desse alcance ficam totalmente escondidas.
- **Movimento por direcao absoluta**: os botoes (e o WASD/setas) sao
  fixos — Norte/Sul/Leste/Oeste sempre apontam pro mesmo lugar, sem
  "frente/esquerda/direita" relativos a uma direcao que o personagem
  esta olhando. So aparece botao para a direcao que realmente tem porta
  na sala atual.
- **Salas com mais de uma coisa dentro**: uma sala de monstro pode conter
  varios inimigos em sequencia (o combate encadeia automaticamente pro
  proximo assim que o anterior cai) e, em algumas dessas salas, um
  tesouro bonus que so e liberado depois que todos os monstros da sala
  forem derrotados. Chefes (mini-chefe a cada 5 andares, chefe principal
  a cada 10) usam essa mesma estrutura de sala.
- **Exploracao em texto + minimapa**: uma unica caixa narrativa no centro
  da tela mostra a descricao ambientada do local (varia entre cidade e
  masmorra, com pistas nas portas disponiveis) e tambem serve como area
  de dialogo — ao falar com um NPC ou disparar um evento (bau, taverna,
  combate), o mesmo espaco vira a conversa/interacao, com o retrato do
  NPC e os botoes de Continuar/Encerrar aparecendo ali. Cada sala
  especial pede confirmacao (Sim/Nao) antes de entrar.
- **Combate**: ao encontrar um inimigo, escolha Enfrentar ou Fugir.
  Fugir exige uma rolagem de d20 (com bonus se a Destreza do heroi for
  maior que a velocidade do monstro); falhar jogar o combate forcado.
  O combate substitui o mapa por uma cena propria, com dano flutuante,
  critico, e a criatura contra-ataca quando o jogador erra.
- **Rolagem de dados com animacao 3D**: usada no ataque em combate, na
  tentativa de fuga e na negociacao com comerciantes — nao existe mais
  um "menu de dados" solto sem funcao; toda rolagem agora tem um efeito
  real no jogo.
- **Ouro e comercio**: bolsa de moedas visivel na ficha; vendedor (itens
  gerais/consumiveis) e ferreiro (armas/armaduras/acessorios) com
  estoque aleatorio que pode ser renovado, compra e venda de itens. Em
  qualquer um dos dois, da para rolar um d20 (uma vez por visita) para
  tentar conseguir um desconto de 5% a 30% nas compras.
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
    narrator.js           gera a descricao textual do local (com pistas nas 4 direcoes)
    player.js             racas, classes, poderes, debuffs, XP/nivel, equipamento
    map.js                 gerador de grafo de salas (portas N/S/L/O, silhueta)
    city.js                  mapa da cidade inicial (salas)
    dungeon.js                mapa de cada andar (salas, grupos de monstros)
    combat.js                  fugir/enfrentar + fila de monstros da sala + dados
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
- **Formas de sala variadas** — hoje toda sala e um mesmo "quadrado" no
  grafo, so o icone/cor mudam por tipo; salas com formato ou tamanho
  proprios (ex: uma camara de chefe visualmente maior) sao outra fase
  possivel.

Cada um desses pontos e um bom proximo passo, mas nenhum bloqueia o
jogo funcionar — a base (personagem, exploracao, combate, comercio,
progressao e save) esta completa e jogavel de ponta a ponta.
