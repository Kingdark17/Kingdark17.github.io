# RPG Legend — Contexto do Projeto

Jogo RPG/roguelike no navegador, estilo Binding of Isaac (JS vanilla, sem framework).

## Estrutura dos repositórios

- **Kingdark17.github.io** (este repo) — cliente do jogo, hospedado via GitHub Pages
  em `kingdark17.github.io/rpg-legend/`. Todo o jogo mora em `rpg-legend/`.
- **RPG-Legend-Server** — servidor autoritativo Node.js do modo multiplayer (`ws` +
  `pg` para Postgres). Rodado separado do GitHub Pages.

## Estrutura de `rpg-legend/`

- `index.html` — shell da página, todos os `<script src="js/*.js?v=...">` ficam
  aqui (ver seção "Cache-busting" abaixo).
- `js/items.js` — catálogo de todos os itens (armas, armaduras, acessórios,
  consumíveis, materiais), com `id`, `name`, `icon`, `category`, `desc`, `base`
  (atributos), `value`, e `proc` (efeito de arma: queimadura, atordoar, etc).
- `js/inventory.js` — renderização do modal "Mochila".
- `js/player.js` — classes, atributos, afinidade de arma por classe.
- `js/pets.js` — sistema de pets do perfil (sprite normal/coração no dragão
  filhote, por exemplo).
- `js/combat.js`, `js/dungeon.js`, `js/map.js`, `js/monsters.js` — geração de
  salas, combate encadeado, mapa estilo Binding of Isaac (portas N/S/L/O).
- `js/account.js` — contas de usuário, save na nuvem, loja de cosméticos.
- `js/multiplayer.js`, `js/multiplayer-config.js` — cliente do multiplayer.
- `js/admin-panel.js` — painel ADM (editar vida/mana/ouro/atributos na hora).
- `img/weapons/`, `img/armor/`, `img/accessories/`, `img/potions/`,
  `img/scrolls/`, `img/materials/`, `img/pets/` — pixel art dos itens (todo o
  inventário já está em pixel art, sem emoji).

## Convenções importantes

### Ícones de item
Todo item usa `icon: '<img src="img/CATEGORIA/arquivo.png" class="weapon-icon-img" alt="...">'`
em vez de emoji. Ao adicionar item novo ou trocar arte, seguir esse padrão —
`class="weapon-icon-img"` já cuida do tamanho/pixelização via CSS.
Novos sprites gerados devem ter contorno escuro (~`rgb(26,11,9)`) pra combinar
com o resto do set, fundo transparente, e usar `image-rendering:pixelated`.

### Cache-busting — MUITO IMPORTANTE
Todo `<script src="js/arquivo.js?v=XXXXXXXXx">` e `<link href="css/arquivo.css?v=...">`
em `index.html` tem um parâmetro de versão manual. **Sempre que editar um `.js`
ou `.css`, bumpar o `?v=` correspondente no mesmo commit** (ex: `?v=20260809a`).
Esquecer isso faz o navegador de todo mundo continuar servindo a versão antiga
em cache, mesmo com o deploy funcionando — já aconteceu e confundiu bastante.

### Deploy do GitHub Pages
O repo usa o modo **legacy** de Pages (`build_type: legacy`, deploy automático
direto da branch `main`, sem precisar de workflow customizado). **Não
recriar** um `.github/workflows/*.yml` de deploy — já existiu um e ele
competia com o deploy automático pelo mesmo slot, causando falhas
intermitentes (removido em `bb9417b`). Se o site parecer desatualizado depois
de um push, primeiro checar se o deploy automático rodou com sucesso (aba
Actions do GitHub) antes de suspeitar de cache.

### Push para o repositório
Não há CI/CD de testes obrigatório. `node --check arquivo.js` é suficiente
pra pegar erro de sintaxe antes de commitar. `tests/smoke.js` tem uma falha
pré-existente (`falha ao salvar`) não relacionada a edições de conteúdo —
não é sinal de regressão.

## Sistema de progressão (resumo)
- Atributos com efeito real: FOR/DES/CON/INT/SAB/CAR.
- Level up manual: 2 pontos livres por nível (sem auto-incremento).
- Poder de assinatura fixo por classe + até 2 escolhidos pelo jogador.
- Afinidade de arma por classe: sem bloqueio, só eficiência variável.
- Poder único por tipo de arma (queimadura, atordoar, sangramento, etc).

## Mapa (resumo)
Grafo de salas conectadas por portas (N/S/L/O), neblina revela só a silhueta
das salas vizinhas, até 3 monstros por sala lutando juntos (luta em grupo,
2026-10-17: o jogador escolhe o alvo, um monstro ataca por rodada revezando
entre os de pé, derrubar um não encerra a rodada, fuga e esquiva contra o
mais rápido de pé, o da vez atordoado perde o ataque; o chefe final do
andar 100 chama 4 lacaios, e o palco chega a 5), tesouro bônus ao limpar a
sala, movimento em direção absoluta fixa.

---

# Preferências de trabalho (registradas 2026-08-11)

## Como conduzir o trabalho
- **Consultar antes de decidir.** Toda decisão de arquitetura, biblioteca ou
  escopo passa por pergunta explícita, com as alternativas e o trade-off de
  cada uma. Não assumir "o óbvio" sem falar.
- **Toda dúvida vira pergunta.** Se houver ambiguidade real, perguntar em vez
  de escolher sozinho e seguir.
- **Pensar até ter certeza antes de agir.** Levantar os fatos no código antes
  de opinar. Recomendação sem leitura prévia do arquivo relevante não vale.
- **Dizer o que não dá.** Se algo pedido não existe ou não é possível, falar
  na hora em vez de entregar uma aproximação disfarçada.
- Sempre que ajudar no desempenho ou na qualidade da entrega, usar as skills
  disponíveis em vez de fazer na mão.

## Migração em andamento (fase 0 concluída)
O jogo está sendo migrado de JS vanilla para um monorepo. Decisões fechadas:

| Camada | Escolha |
|---|---|
| Front | Next.js (App Router) na Vercel |
| Backend | NestJS |
| Tempo real | socket.io (substitui `ws` cru) |
| Banco | Drizzle ORM |
| Cache/estado | Redis (salas, sessões, rate limit, presença) |
| Engine | TypeScript puro, **fora do React**, em `packages/shared` |
| Personagem 2D | PixiJS, paperdoll com equipamento |
| Animação de UI | Motion via `LazyMotion` (~6 KB), só na UI React |
| Infra final | Supabase (Postgres + Storage); auth próprio permanece |

**Regras que decorrem disso:**
- A engine em `packages/shared` não importa React, DOM nem Node — é o que
  permite o Nest validar jogada com o mesmo código do cliente.
- O fluxo do jogo (o que junta as peças: sala, combate, mochila, loja,
  missões, extras, co-op, narração) também mora na engine, em
  `packages/shared/src/jogo`, com os nomes em português de antes. Veio de
  `apps/web/lib/jogo` em 2026-10-16, para o app ter as mesmas regras. No
  site, `lib/jogo` guarda só o que é tela: desenho da sala, figuras, arte do
  minimapa, teclado e o relógio da barra de mira.
- Não propor Zustand/Redux para lógica de jogo: a engine é fora do React de
  propósito.
- Não propor Supabase Auth: os hashes são scrypt e não importam pra lá;
  forçar reset de senha de todo mundo foi descartado.
- Loops decorativos continuam em CSS. Motion não entra dentro do PixiJS.
- `rpg-legend/` continua servido pelo GitHub Pages a partir da raiz e **não
  entra no workspace pnpm** enquanto a migração acontece.

Ordem das fases: 0 monorepo → 1 engine shared → 2 Nest (ainda no Neon) →
3 front Next → 4 paperdoll PixiJS → 5 Neon→Supabase → 6 otimização completa.

## Cliente Unity (`apps/unity`)
Cliente baixável em Unity 6 (2D URP), ao lado do web, que continua. Não tem
`package.json`, então fica fora do workspace pnpm e do turbo.

- Alvo: **PC e celular**, com a **mesma conta e os mesmos personagens do web**
  (o mesmo save na nuvem, então o app lê e grava o mesmo JSON que o web).
- A ideia é o app ter mais coisas que o web. **Conteúdo só do app mora na
  engine TS** (decisão de 2026-10-17): regras e catálogo em `packages/shared`,
  passados para o C# pelos casos de teste como o resto, e o site só não
  oferece o caminho para conseguir. O site precisa conhecer tudo o que pode
  estar no save, porque o mesmo personagem é jogado nos dois: hoje ele quebra
  com item de modelo desconhecido (`itemTemplate` joga erro) e, ao gravar,
  some com o campo de save que não conhece. Vale para o que vier depois,
  salvo decisão contrária. Primeiro conteúdo assim (fila de 2026-10-17, depois
  da etapa 5): runas (pedras raras de baú e de chefe que dão habilidade à
  arma, como a runa elétrica que dá choque), encantamentos (fortificação, como
  resistência a ataque mágico) e materiais por tipo de peça somando com a raridade
  (metal: ferro → aço → aço mágico; madeira: carvalho → ébano → madeira
  élfica; couro: couro → couro reforçado → couro de dragão; tecido: linho →
  seda → seda arcana), com arte nova do Breno por material. O poder do
  necromante que levanta um esqueleto aliado é **do site e do app**.
  O caminho para "só o app consegue" é o parâmetro `app` de quem cria coisa
  (`randomItem`, `generateDungeonFloor`, `rollStock`, `limparSala`,
  `interagir`, `entrarNaMasmorra`…): a `Partida` do app passa `app: true`, a
  arena sempre passa, e o site não passa nada — o sorteio dele fica igual, sem
  um número a mais do rng. Os materiais (`items/materiais.ts`, desde
  2026-10-17) são os primeiros: o item guarda só o `degrau` (2 ou 3; ausente
  é o primeiro), +25% na base antes da raridade, chance crescendo com o andar
  (o chefe dobra), e a loja do app vende até o degrau 2. As runas
  (`items/runas.ts`, desde 2026-10-17) vieram depois: o item da runa guarda o
  `tierDaRuna`, a arma guarda `runas` (`{runa, tier}`), e só a arena do app as
  aplica — no site a arma vale só pelos atributos, e a runa só aparece na
  mochila para descartar. Os encantamentos (`items/encantamentos.ts` e a
  tela `jogo/encantadora.ts`, desde 2026-10-18) vêm da Encantadora, uma sala
  da cidade na pracinha a leste do caminho do portão (`withEncantadora`
  acerta as cidades gravadas antes dela; no site a porta fica fechada): a
  armadura guarda `encantamento` (`{tipo, nivel}`), e só a arena passa as
  defesas ao golpe no herói (`landHitOnHero(..., defesas)`) e ergue o escudo
  do vigor. O esqueleto do necromante (`combat/invocacao.ts`, desde
  2026-10-23) é do site e do app: o poder `levantar_esqueleto` (tipo
  `invocar`) põe na equipe um companheiro marcado `invocado`, até 3 de pé e
  fora da vaga dos recrutas; ele some no fim da luta (vitória, derrota ou
  fuga), e o site mostra a equipe num cartão na tela da luta.

- `Assets/RPGLegend/Engine/` é um **port de `packages/shared` para C#**, com
  paridade exata: mesma entrada → mesmo resultado e a mesma sequência de
  sorteios do rng. As regras do port estão em `Assets/RPGLegend/PORTING.md`.
- O contrato entre as duas engines são os casos de `packages/shared/fixtures`
  (`cd packages/shared && pnpm dlx tsx scripts/gen-fixtures.ts`). **Mudou a
  engine TS → regenerar os casos e rodar os testes da Unity** (Test Runner →
  EditMode, ou `bash apps/unity/Assets/RPGLegend/Tools~/run-tests.sh`, que
  usa o .NET 8 SDK e, sem um instalado, o que vem com a Unity). O que falhar é
  o que falta portar para o C#.
- O jogo carrega as tabelas de uma cópia de `packages/shared/fixtures/data` em
  `Assets/RPGLegend/Resources/GameData` (é ela que vai no build). **Mudaram as
  tabelas do TS → rodar na Unity o menu RPG Legend > Atualizar tabelas do jogo**
  (copia só o que mudou, apaga o que sumiu). O teste `GameDataCopyTests` falha
  enquanto a cópia estiver diferente da origem.
- Build: Mono, Windows 64 (o IL2CPP do Windows não está instalado). O menu RPG
  Legend > Build de teste (Windows) builda a cena `EngineSmoke` em
  `apps/unity/Builds/Smoke` (fora do git), roda o .exe em batchmode e confere o
  relatório dele contra o do Editor; o resultado sai no Console e em
  `Builds/Smoke/smoke-report.txt`.
- Celular exige IL2CPP. O módulo Android está instalado (iOS não: iPhone fica
  para depois e precisa de Mac). O menu RPG Legend > Build de teste (Android)
  builda a mesma cena em IL2CPP/ARM64, instala no celular pelo cabo (depuração
  USB), roda o smoke e todos os casos de fixtures no aparelho e compara o
  logcat com o Editor. Passou em 2026-10-11 num Samsung Galaxy A30s: as 24
  linhas do smoke e os 2.237 casos, idênticos ao Editor. Os casos e o código
  que os roda (`Fixtures/`, `DeviceTests/`) só entram nesse build de teste
  (símbolo `RPG_DEVICE_TESTS`); o jogo de verdade não leva.
  O identificador definitivo do app (o da Play Store, que não muda depois de
  publicado) ainda não foi escolhido: o build de teste usa
  `br.com.rpglegend.smoke` só durante o build.
- Telas do app (2026-10-11): cena `Scenes/App.unity` (a do build). Entrada
  animada estilo Genshin: a câmera se aproxima da porta trancada, o cadeado cai
  e a porta abre quando a pessoa entra; depois menu e lista de personagens
  (com o boneco de cada um; criar e apagar como no site, em
  `TelaDeCriacao`/`AppScreens`). Desde 2026-10-30 o menu também leva às
  Configurações (`TelaDeConfiguracoes`: o som, guardado no aparelho em
  `PreferenciaDeSom`, como o site guarda no navegador) e à Loja de
  cosméticos (`TelaDaLoja`: a compra sai do ouro de um personagem, e
  escolher o que usar continua no site, em Conta e perfil). UI Toolkit para as telas + cena 2D para a
  porta; visual igual ao site; **celular deitado** (só paisagem). A arte da
  porta é **provisória** (o Breno substitui com os mesmos nomes em
  `Art/Entrada`). **Login com Google fica para uma
  rodada própria** (Google Cloud, rota na API, mudança no banco de produção e
  regra para e-mail que já tem conta — planejar com o usuário).
  O menu RPG Legend > Build do app (Android) instala o app de verdade no
  celular pelo cabo, apontando para produção; a variante "API local" aponta
  para a API do computador pelo cabo (`adb reverse`). Ainda com identificador
  de teste (`br.com.rpglegend.teste`) e nome "RPG Legend" só durante o build.
- Jogar pelo app (etapa 4, desde 2026-10-16): o JOGAR do cartão abre a
  partida (`Game/Jogo`): `Partida` é o espelho sem desenho da tela-jogo.tsx
  (estado, avisos, diário, sala secreta, quando gravar), `TelaDeJogo` liga
  ela à UI e à `SalaEmCena` (a sala desenhada numa textura, andar solto por
  teclado ou joystick). Grava na nuvem como o site (2,5 s, teto de 10 s,
  `baseSignature`). Desde a etapa 5.4, a sala de monstro abre a luta em tempo
  real (`luta/arena.ts`, no C# `Arenas`): a `Partida` troca o combate por
  turnos pela arena, e só se sai vencendo ou caindo. A luta é em primeira
  pessoa, como a do site, com o coração do Undertale numa caixa
  (`PalcoDaLuta`): **decisão do usuário em 2026-10-17**, depois de pedir
  como teste; a versão com a luta dentro da sala ficou no commit 82b03da.
  No PC, o cajado pede letras (U, I, O e P, uma por vez, com um aro
  fechando) em vez do desenho, que fica no celular. As telas de sala
  são as do site, nos mesmos moldes (a carta seleciona, a ficha age):
  conversa, evento, totem, quadro de missões, mestre e guilda em
  `TelaDeJogo.Telas.cs`; mochila (cartão de guilda com o "+" dos pontos,
  boneco com os espaços, ficha com "Se você equipar") e loja/ferreiro em
  arquivos próprios; e mais o guia e a ficha do herói. O pet da conta fica no
  canto da sala, enfeite como no site (`BichoDeEstimacao`). A arte de item, a
  do boneco e a do pet são **cópia** de `apps/web/public/img` (mesmos nomes,
  em `Art/Jogo/Resources/Itens`, `Paperdoll` e `Pets`): arte nova vai nos dois
  lugares.
  O boneco é port de `lib/paperdoll/camadas.ts` (`Paperdoll.cs`), parado. O
  texto da UI usa o emoji do sistema sozinho (Unity 6.6); a cena da sala
  desenha emoji com `EmojiDoSistema` (fonte do sistema → sprite). Atalho de
  teste do Editor: RPG Legend > Jogar direto > Slot N pula porta e menu
  (precisa de sessão salva; combine com o Servidor do jogo local). Os testes
  do app ficam em `Tests/EditMode/App` e só rodam no Test Runner da Unity.
- Cidade desenhada (2026-10-23, **site e app**): a cidade não é mais de salas,
  é o mapa do Breno, um só de 30 × 25 casas (`city/mapa-da-cidade.ts`; arte em
  `img/cidade/` e `Art/Jogo/Resources/Cidade`, uma camada por arquivo). A grade
  de salas da cidade continua no save, intacta: encostar numa porta leva o
  jogador pra sala dela e a aciona (`jogo/cidade.ts`, `entrarNoPonto`), e a
  cena da cidade é uma só (a chave da sala não tem a posição). A planta sai da
  colisão dele (`hitbox.png`) com `packages/shared/scripts/planta-da-cidade.mjs`:
  colisão nova → rodar o script e colar a planta; ele também mede a `caixa`
  de cada camada (arte nova → conferir), que faz a camada do meio ficar
  meio transparente quando cobre o herói (`cobreOHeroi`). A Encantadora atende na
  igreja, o Bram dentro do ferreiro, e cada masmorra tem a entrada dela
  (Floresta ao sul, Caverna ao norte, atrás dos troncos que saem quando a
  Floresta é zerada, e Torre a leste), que abre o portão com ela fixa.
- Sala da Floresta (2026-10-24, **site e app**): a arte do Breno veio em
  9 × 9, e **todas as salas de masmorra passaram a 9 × 9** (eram 9 × 7;
  decisão do usuário). As camadas de cada masmorra com arte estão em
  `dungeon/arte-da-sala.ts` (o chão, um caminho só pras portas que a sala
  tem, e as copas por cima do herói); a arte mora em `img/salas/<masmorra>/`
  e `Art/Jogo/Resources/Salas/<masmorra>`. A Caverna ganhou a dela em
  2026-10-25 (chão, parede de trás com tochas, uma passagem por porta e a
  parede da frente por cima); a colisão dele fecha os quatro cantos de
  dentro (`paredesDaSala`), e o extra gravado num canto anda rumo ao meio.
  A Torre ganhou a dela em 2026-10-30 e é a única sala de outro formato
  (decisão do usuário): 11 × 12, parede de cima de 2 casas e portas de 3
  (`GEOMETRIAS_DAS_SALAS`; as outras usam `GEOMETRIA_PADRAO`). O formato vai
  na planta (`cols`, `rows`, `portas`) e em `roomArrival(lado, geometria)`;
  as camadas `semPorta` fecham o vão de quem não tem porta, e falta a 7 dele
  (a porta de baixo fechada), que a parede inteira dispensa. No site a caixa
  da sala toma a proporção dela, e no app a câmera. A parede rachada se põe
  pelo lado dela (a porta da geometria), e não pela casa gravada. No app a
  luta continua na proporção 9 × 7 em que foi afinada (`area-da-luta`).
- Níveis e chefe final (2026-10-25, **site e app**; o Breno zerou a
  Floresta e achou a batalha final fraca): os monstros ganharam nível
  (`monsterLevel`: 9 em cada 10 andares de força), o degrau da escada
  cresceu pra `FLOORS_PER_DUNGEON` = 77 (a Caverna Normal começa com
  monstros de nível 70 e a Torre com 140, e a entrada pede isso), e o
  chefe do andar 100 de cada masmorra virou o chefe final
  (`jogo/chefe-final.ts`): 30% mais forte, um poder a cada 3 golpes (Golpe
  Devastador ou Rugido), 4 lacaios na metade da vida, imune até eles
  caírem, e furioso depois. Zerar abre a tela de vitória com o baú do
  chefe (uma peça lendária e ouro, abaixo do teto de +5000 da API) e um
  título no cartão de guilda, tirado de `progresso.cleared`
  (`jogo/conquista.ts`). O item único de cada masmorra ainda vai ser
  desenhado.
- Tela do jogo no app (2026-10-23, **só no app**; o site continua com a
  coluna): o mapa na tela toda, com os botões em cima, nome, nível, vida e
  mana embaixo à esquerda, e à direita o minimapa (na masmorra) e o que fala
  do lugar, que aparece na chegada e some sozinho (as perguntas e os recados
  ficam até a resposta). Na masmorra a sala 9 × 7 fica no meio, na altura
  toda, e a luta acontece dentro dela; na luta os botões descem em coluna.
- **API local: nunca com o `apps/api/.env`** — ele aponta para o banco de
  produção e tem a chave do Resend. Subir com `DOTENV_CONFIG_PATH=/nao/existe`,
  a `DATABASE_URL` do `pnpm dev:db` e `RESEND_API_KEY` vazio (receita no
  PORTING.md). No Editor, o menu RPG Legend > Servidor do jogo escolhe
  produção ou local.
- Comportamento estranho do TS se corrige primeiro no TS (regenera os casos e
  porta a correção), nunca só de um lado.
- `Library/`, `Temp/`, `Logs/` e `UserSettings/` são gerados pela Unity e ficam
  fora do git (`apps/unity/.gitignore`).

## Armadilha conhecida
`rpg-legend/server/` neste repo é **cópia desatualizada** do servidor. O real
está em `github.com/Kingdark17/RPG-Legend-Server` (~565 linhas contra as 141
da cópia) e tem salas públicas, amigos, chat, slots e loja de cosméticos que
a cópia não tem. Nunca usar a cópia local como referência.
