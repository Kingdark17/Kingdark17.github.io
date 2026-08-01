# RPG Legend

> Esta é a edição **Multiplayer Beta**. Duas pessoas podem controlar a mesma
> aventura em turnos alternados. Consulte `MULTIPLAYER.md` para testar em duas
> abas ou iniciar o servidor para computadores diferentes.

Um RPG de exploração, progressão e combate rodando 100% no navegador —
HTML, CSS e JavaScript puro, sem frameworks, sem build, sem servidor.

## Como jogar

Abra `index.html` diretamente no navegador (duplo-clique ou arraste para
uma aba). Não precisa de internet, exceto para carregar as fontes do
Google Fonts (o jogo funciona normalmente sem elas, só troca a tipografia).

## O que já está implementado

- **Menu principal**: Novo Jogo, Continuar (lê o `localStorage`),
  Configurações (liga/desliga som) e Créditos.
- **Criação de personagem**: nome, raça, classe, até 2 poderes e 1 fraqueza
  (debuff), modo solo ou em equipe (2 companheiros gerados). No modo equipe,
  os companheiros possuem habilidades próprias, atacam automaticamente,
  podem ser alvos dos monstros e aceitam posturas de combate (equilibrada,
  agressiva, defensiva ou suporte).
- **Cidade explorável**: vendedor, ferreiro, taverna (descanso restaura
  vida/mana), quadro de missões, NPCs com diálogo e o portão da masmorra.
- **Masmorra com andares sem limite**: cada andar tem mais monstros e
  monstros mais fortes que o anterior (vida, velocidade e dano escalam
  com a profundidade). A cada 5 andares aparece um mini-chefe, a cada 10
  um chefe principal — ambos com nomes e atributos próprios.
- **Mapa em salas conectadas (estilo Binding of Isaac)**: cidade e
  masmorra são um grafo de salas ligadas por portas (Norte/Sul/Leste/
  Oeste), não mais corredores de tiles. O minimapa mostra a "silhueta"
  de qualquer sala vizinha a uma sala já visitada (contorno apagado,
  sem revelar o conteúdo), e só mostra o ícone real quando o jogador
  entra nela. Salas fora desse alcance ficam totalmente escondidas.
- **Movimento por direção absoluta**: os botões (e o WASD/setas) são
  fixos — Norte/Sul/Leste/Oeste sempre apontam pro mesmo lugar, sem
  "frente/esquerda/direita" relativos a uma direção que o personagem
  está olhando. Só aparece botão para a direção que realmente tem porta
  na sala atual.
- **Salas com mais de uma coisa dentro**: uma sala de monstro pode conter
  vários inimigos em sequência (o combate encadeia automaticamente para o
  próximo assim que o anterior cai) e, em algumas dessas salas, um
  tesouro bônus que só é liberado depois que todos os monstros da sala
  forem derrotados. Chefes (mini-chefe a cada 5 andares, chefe principal
  a cada 10) usam essa mesma estrutura de sala.
- **Exploração em texto + minimapa**: uma única caixa narrativa no centro
  da tela mostra a descrição ambientada do local (varia entre cidade e
  masmorra, com pistas nas portas disponíveis) e também serve como área
  de diálogo — ao falar com um NPC ou disparar um evento (baú, taverna,
  combate), o mesmo espaço vira a conversa/interação, com o retrato do
  NPC e os botões de Continuar/Encerrar aparecendo ali. Cada sala
  especial pede confirmação (Sim/Não) antes de entrar.
- **Combate**: ao encontrar um inimigo, veja Vida, dano, velocidade,
  habilidade, fraqueza, resistência e recompensas antes de escolher Enfrentar
  ou Fugir.
  Fugir exige uma rolagem de d20 (com bônus se a Destreza do herói for
  maior que a velocidade do monstro); falhar inicia o combate forçado.
  O combate substitui o mapa por uma cena própria, com dano flutuante,
  crítico, e a criatura contra-ataca quando o jogador erra.
- **Rolagem de dados com animação 3D**: usada no ataque em combate, na
  tentativa de fuga e na negociação com comerciantes — não existe mais
  um "menu de dados" solto sem função; toda rolagem agora tem um efeito
  real no jogo.
- **Ouro e comércio**: bolsa de moedas visível na ficha; vendedor (itens
  gerais/consumíveis) e ferreiro (armas/armaduras/acessórios) com
  estoque aleatório que pode ser renovado por um custo crescente, compra e venda de itens. Em
  qualquer um dos dois, dá para rolar um d20 (uma vez por visita) para
  tentar conseguir um desconto de 5% a 30% nas compras.
- **Itens com raridade**: Comum, Incomum, Raro, Épico, Lendário e Mítico,
  cada uma com cor própria e multiplicador de atributos/valor. Os itens
  são gerados proceduralmente a partir de "moldes" (arma, armadura,
  acessório, consumível, material).
- **Inventário por categoria**: abas (Todos/Armas/Armaduras/Acessórios/
  Consumíveis/Materiais), equipar, desequipar, usar (poções) e descartar.
  Ao selecionar um equipamento, a ficha compara seus atributos com o item
  atualmente equipado e destaca o que aumenta ou diminui.
- **XP e nível**: ganha experiência ao derrotar monstros e completar
  missões; sobe de nível automaticamente, e cada nível concede 2
  pontos de atributo livres (nenhum atributo sobe sozinho).
- **Atributos com efeito real**: FOR (dano físico), DES (esquiva e
  crítico), CON (vida máxima), INT (mana máxima e dano mágico), SAB
  (bônus de cura e resistência mágica) e CAR (desconto em lojas) —
  a ficha mostra o benefício exato de cada ponto, e um botão [+]
  aparece ao lado do atributo sempre que houver pontos disponíveis.
- **Poder de assinatura por classe + escolha do jogador**: toda classe
  já nasce com 1 poder próprio e automático (ex: Guerreiro sempre tem
  Golpe Poderoso), e o jogador escolhe mais até 2 poderes da lista
  geral na criação — dando espaço para builds híbridas (ex.: um
  Guerreiro que também escolhe Cura Menor). Poderes agora têm efeito real
  em combate (dano, cura ou um buff temporário) e custam mana; um
  botão "Usar Poder" aparece na cena de combate para cada um.
- **Afinidade de arma por classe**: nenhuma arma é bloqueada para
  nenhuma classe, mas cada uma tem uma % de eficiência diferente por
  tipo de arma (ex: Guerreiro bate forte com espada/machado, fraco
  com cajado). Usar uma arma de baixa afinidade reduz a parte do dano
  que vem da própria arma. A ficha da mochila mostra essa % quando
  o item selecionado é uma arma.
- **Poder único por tipo de arma**: cada tipo de arma (espada, machado,
  adaga, cajado, maça) tem uma chance de ativar um efeito próprio ao
  acertar — queimadura, atordoar, sangramento, recuperar mana ou curar
  de leve — mostrado tanto na mochila quanto no log de combate quando
  ativa. O arco, em vez de proc, dá bônus fixo de crítico.
- **Missões simples**: matar N monstros, alcançar um andar, coletar itens
  — sempre 2 disponíveis no quadro, renovadas ao serem resgatadas.
- **Monstros com comportamento próprio**: criaturas ágeis podem esquivar,
  defensivas resistem a dano físico, venenosas aplicam veneno, mágicas drenam
  mana e criaturas agressivas ou lentas possuem golpes especiais. Chefes têm
  uma mecânica adicional de fúria ou golpe devastador.
- **Eventos de atributo**: salas com aventureiros feridos, altares e portas
  lacradas oferecem escolhas de FOR, INT e SAB, com riscos e recompensas.
- **NPCs funcionais**: além do diálogo, NPCs podem tratar ferimentos, conceder
  bênçãos para 3 combates, trocar materiais por poções, revelar salas próximas
  ou recrutar um companheiro temporário. Cada serviço pode ser usado uma vez
  por encontro.
- **Efeitos**: dano flutuante, tremida ao levar dano, flash ao subir de
  nível, efeitos sonoros curtos gerados via Web Audio API (sem arquivos
  de áudio externos). A ficha também exibe veneno, bênçãos e bônus temporários
  ativos, com sua duração.
- **Salvamento automático**: herói, equipe, inventário, ouro, XP, andar,
  missões, mapa, salas já visitadas, posição exata e preferência de som ficam
  salvos no `localStorage` a cada
  ação relevante (mover, combater, comprar, vender, equipar, usar itens,
  resgatar missões e evoluir).

## Verificação rápida

Com Node.js instalado, execute `node tests/smoke.js`. O teste confirma os
bônus de Vida/Mana dos equipamentos, os atributos de combate dos companheiros
e a presença de chefe, escada e saída nos andares 1 a 100.

## Estrutura de arquivos

```
rpg-legend/
  index.html          tela única que referencia todos os módulos
  css/
    style.css          tema visual, layout, HUD, modais
    animations.css      keyframes (dados, dano flutuante, level up...)
  js/
    items.js            catálogo de itens + raridade + geração aleatória
    monsters.js          espécies de monstros + escala por andar + chefes
    narrator.js           gera a descrição textual do local (com pistas nas 4 direções)
    player.js             raças, classes, poderes, debuffs, XP/nível, equipamento
    map.js                 gerador de grafo de salas (portas N/S/L/O, silhueta)
    events.js               eventos com escolhas baseadas em atributos
    npc-services.js          serviços funcionais oferecidos pelos NPCs
    city.js                  mapa da cidade inicial (salas)
    dungeon.js                mapa de cada andar (salas, grupos de monstros)
    combat.js                  fugir/enfrentar + fila de monstros da sala + dados
    inventory.js                 modal da mochila (abas, equipar, vender, descartar)
    shop.js                       comerciante e ferreiro (compra/venda/estoque)
    quests.js                      quadro de missões
    effects.js                      som (Web Audio) + dano flutuante + animações
    save.js                          leitura/escrita do localStorage
    ui.js                              cola tudo: ficha, mapa, diálogo, controles
    main.js                             menu principal e inicialização
```

Cada arquivo se anexa a um único objeto global `RPG` (ex: `RPG.Items`,
`RPG.Combat`, `RPG.UI`...) — não usamos `import`/`export` de módulos ES
de propósito, porque isso quebra ao abrir o arquivo direto do disco
(`file://`) na maioria dos navegadores. Assim o jogo funciona só com
duplo-clique, sem precisar subir um servidor local.

## Limitações conhecidas / próximos passos

Por serem itens grandes o suficiente para merecer uma fase própria, o
que segue **não** está nesta primeira entrega:

- **Sprites em pixel art / personagens e monstros animados** — hoje tudo
  usa ícones (emoji). Eu não gero sprite sheets prontos; dá para evoluir
  para SVGs desenhados à mão, mas é um trabalho separado.
- **Música ambiente** — os efeitos sonoros curtos (golpe, ouro, level up...)
  já existem via Web Audio, mas trilha sonora de fundo não foi incluída
  (eu não anexo arquivos de áudio prontos).
- **Árvore de habilidades / subclasses** — os poderes já têm efeito
  real em combate (dano, cura, buffs), mas não há uma árvore de
  evolução para eles (não ganham nível/upgrade próprio, só o dano
  cresce indiretamente pelos atributos do herói).
- **50+ espécies únicas de monstro** — em vez disso, 10 espécies-base
  ganham prefixos ("Corrompido", "Ancestral", "Amaldiçoado", "Lendário")
  conforme o andar, o que dá a sensação de variedade sem precisar de
  50 comportamentos de IA diferentes.
- **Formas de sala variadas** — hoje toda sala é um mesmo "quadrado" no
  grafo, só o ícone/cor mudam por tipo; salas com formato ou tamanho
  próprios (ex: uma câmara de chefe visualmente maior) são outra fase
  possível.

Cada um desses pontos é um bom próximo passo, mas nenhum bloqueia o
jogo funcionar — a base (personagem, exploração, combate, comércio,
progressão e save) está completa e jogável de ponta a ponta.
