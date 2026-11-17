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
Grafo de salas conectadas por portas (N/S/L/O), o minimapa mostra toda sala
comum do andar como silhueta até ela ser visitada ou revelada (desde
2026-11-06; a sala secreta nunca aparece), até 3 monstros por sala lutando juntos (4 a partir
do andar de força 30, desde 2026-11-06) (luta em grupo,
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
  fora da vaga dos recrutas; desde 2026-11-10 (doc do Breno) o esqueleto de
  pé segue o herói de sala em sala com a vida que tiver, e some ao cair, na
  volta à cidade (`entrarNaCidade`) ou na derrota; o site mostra a equipe num
  cartão na tela da luta. Desde 2026-11-12 (pedido do usuário) o esqueleto
  tem a metade da vida e do ataque de antes, o poder custa 18 de mana (era
  14), e no app a equipe de pé (os recrutas e os esqueletos) anda em fila
  atrás do herói (`SalaEmCena.Seguidores.cs`: só desenho, com o mini
  boneco; o recruta com a raça dele e a roupa de baixo, o esqueleto com o
  corpo do Morto-vivo, sem roupa; o site continua só com o cartão). O atributo no teto de 99 não gasta mais o ponto
  (`ATRIBUTO_MAXIMO`), e o Guia do app no PC abre com as teclas.

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
  O menu RPG Legend > Build do app (Windows) (desde 2026-11-06) builda o app
  de PC em Mono na pasta `Builds/AppWindows/RPG Legend`, apontando para
  produção (`-api <url>` no executável aponta para outra), abre numa janela
  por 10 s e confere o log, e junta a pasta no instalador
  `Builds/AppWindows/RPG Legend - Instalação.exe` (é ele que se manda) com o
  Inno Setup (`apps/unity/Instalador/RPGLegend.iss`, UTF-8 com BOM; o AppId
  dele não muda nunca; instala por usuário, sem administrador). A Unity
  grava o tamanho da janela da conferência no registro, então ela devolve a
  chave do jogo (`HKCU\Software\DefaultCompany\RPG Legend`) ao que era. No
  PC o menu tem o SAIR (no celular fica escondido), e fechar a janela com
  mudança por gravar segura, grava e fecha (`Application.wantsToQuit` na
  `TelaDeJogo`; se a gravação falhar, avisa, e fechar de novo sai); no
  celular, ir pro fundo já grava (`OnApplicationPause`).
  O ícone do app (celular, PC e instalador, desde 2026-11-06) é o brasão do
  menu, o mesmo da aba do site: o menu RPG Legend > Atualizar ícone do app
  gera de `UI/Imagens/logo.png` o padrão (o do executável), o adaptável do
  Android (o brasão no círculo seguro, sobre o fundo `--ink` das telas) e o
  `Instalador/icone.ico`, e os põe nas configurações. Logo nova → rodar de novo.
  O app de PC se atualiza sozinho (desde 2026-11-11, `Game/App/Atualizacao.cs`):
  ao abrir, ele lê o `versao-pc.txt` do release mais novo do repositório no
  GitHub (`releases/latest/download/`) e, se a versão for mais nova que a
  dele (`Application.version`, que o build grava igual à do instalador: a
  data e a hora), mostra na porta e no menu o ATUALIZAR, que baixa o
  instalador, roda ele em silêncio e fecha; o instalador reabre o jogo
  (`Check: WizardSilent` no `.iss`). **Publicar uma versão do PC**: o build do
  Windows e depois `node apps/unity/Instalador/publicar.mjs` (`--conferir` só
  mostra; usa a credencial do git). O release vale na hora pra todo mundo:
  só publicar com o que já está no `main` e conferido. Com a Unity fechada,
  o build sai por `-executeMethod RPGLegend.EditorTools.WindowsAppBuild.PelaLinhaDeComando`.
  O celular não tem isso (a loja dele é que atualiza; hoje é APK na mão).
- Atributos e habilidades pelo uso (2026-11-10, **site e app**, doc do Breno
  decidido com o usuário; substitui os 2 pontos por nível): cada ação anota um
  uso no atributo dela (`hero/treino.ts`, `anotarUso`: Força no golpe corpo a
  corpo e no poder físico; Destreza no tiro, na esquiva e na fuga;
  Inteligência no golpe e no poder mágico e na invocação; Sabedoria na cura,
  no apoio e na poção; Carisma no serviço de NPC, na compra e na venda), e o
  XP de cada abate se reparte por esses usos (`treinarComXp`, em
  `pagarAbate`): um ponto custa o XP do nível ÷ 1,5 (`custoDoPonto`), então o
  ritmo fica perto do de antes. A Constituição sobe 1 por nível (`gainXP`).
  Os pontos guardados de antes (`attrPoints`) não se gastam mais: 2 por
  abate viram XP do personagem (25% do nível cada), aos poucos por causa do
  teto de +5 níveis por save da API. Cada poder conta os usos
  (`hero.usosDePoder`): 10 níveis (5, 15, 30… usos), +4% de dano e cura e
  −2% de mana por nível, dentro de `castPower` e `powerManaCost`. O cartão
  de guilda mostra a barrinha do treino e o nível de cada poder.
- O herói no mapa (2026-11-10, **site e app**, arte do Breno decidida com o
  usuário): é o mini boneco, 31 × 32 (uma casa do mapa dele, desenhado na
  escala do chão), com a raça, o cabelo e o que tem arte mini (placas, robe e
  escudo; o resto fica com a roupa de baixo), de frente ao descer e pros
  lados (espelhado; não há arte de lado) e de costas ao subir. As camadas
  saem de `lib/paperdoll/mini.ts` (`montarMini`; no app, `Paperdoll.Mini`),
  e a arte mora em `img/mini/<frente|costas>/` e `Art/Jogo/Resources/Mini`,
  com os nomes do paperdoll grande: arte nova → rodar
  `packages/shared/scripts/copia-mini-boneco.mjs <pasta do Drive>` (a roupa
  de baixo de costas é a de frente, emprestada). Raça sem mini (o anão)
  fica com o emoji. De costas o escudo vai atrás de tudo (doc do Breno de
  2026-11-13); de frente, por cima.
- Jogar pelo app (etapa 4, desde 2026-10-16): o JOGAR do cartão abre a
  partida (`Game/Jogo`): `Partida` é o espelho sem desenho da tela-jogo.tsx
  (estado, avisos, diário, sala secreta, quando gravar), `TelaDeJogo` liga
  ela à UI e à `SalaEmCena` (a sala desenhada numa textura, andar solto por
  teclado ou joystick). Grava na nuvem como o site (2,5 s, teto de 10 s,
  `baseSignature`). Desde a etapa 5.4, a sala de monstro abre a luta em tempo
  real (`luta/arena.ts`, no C# `Arenas`): a `Partida` troca o combate por
  turnos pela arena, e só se sai vencendo ou caindo. De 2026-10-17 a
  2026-11-11 o golpe se desviava com o coração do Undertale numa caixa;
  hoje a sala é a arena (ver "A sala é a arena").
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
  área da luta (a caixa e os botões) continua na proporção 9 × 7 em que foi
  afinada (`area-da-luta`). Desde 2026-10-30 a camada de cima (as copas, a
  parede da frente, os pilares da Torre) fica meio transparente quando cobre
  o herói, como as construções da cidade (`cobreOHeroiNaSala`): o `cobre` de
  cada camada diz as casas em que ela esconde alguém, e sai da arte com
  `packages/shared/scripts/cobertura-das-salas.ts` (arte nova → rodar o
  script e colar).
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
  ficam até a resposta). Na masmorra a câmera segue o herói pelas salas
  emendadas; na luta os botões descem em coluna.
- Salas emendadas e luta no mapa (2026-10-30, **site e app**, pedido do
  Breno): as salas da masmorra ficam coladas e o herói passa de uma pra
  outra andando, com a câmera junto (`continuarNaVizinha`: o chão além de
  uma porta aberta é o vão da vizinha, e a saída conta com o centro dele
  fora da sala; `salasEmVolta`: o 3 × 3 em volta, e a vizinha ainda não
  visitada fica na sombra, sem o que tem dentro). A luta é na própria sala,
  no lugar da primeira pessoa (decisão do usuário, que desfaz a de
  2026-10-17): os monstros em pé nas casas de `lugaresNaLuta`, o herói um
  passo pra dentro da porta (`heroiNaLuta`), a câmera enquadrando a sala, e
  embaixo uma faixa própria. No site, as placas (tocar escolhe o alvo), a
  caixa e o menu, com a sala congelada (a derrota leva o estado pra cidade
  antes do "Continuar"); no app, os botões, com as placas numa coluna ao
  lado da sala (a caixa do coração saiu em 2026-11-11). A sala secreta continua uma cena à
  parte, e a cidade não muda. Desde 2026-11-06 (doc novo do Breno, decidido
  com o usuário): a câmera tem zoom de 1,5× no herói, na cidade e na
  masmorra (`ZOOM` no site, `Zoom` no app), e só a luta enquadra a sala
  inteira; em volta das salas (o void e a sala secreta) fica o fundo do
  lugar, a cor da borda das paredes da arte (`fundo` do tema); e a luta do
  site fecha sozinha 1 s depois do último golpe, sem o "Continuar" (o
  resultado vira o aviso da sala), menos a tela de quem zera a masmorra.
- A sala é a arena (2026-11-11, **só no app**, doc do Breno decidido com o
  usuário; o site continua por turnos): na luta em tempo real o herói anda
  pela sala (`arena.heroi`, com o `walkTick` de sempre, as portas fechadas
  e cada monstro de pé tomando a casa em que está) e desvia andando. O
  golpe do monstro atravessa a sala: o círculo cai onde o herói estava, a
  investida sai de onde o monstro está em linha reta até a parede, a bola
  do mágico sai dele. Desde 2026-11-12 (pedido do usuário) **quem investe
  fica onde a investida acabou** (`corpoX`/`corpoY` do monstro na arena: na
  parede, ou encostado no herói que levou o golpe), e o alcance, a colisão
  e o próximo golpe dele contam dali. Os monstros **andam atrás do herói**
  e o alcance é o da classe: ver o doc de 2026-11-15 logo abaixo, que
  desfez o "ficam parados, um por vez" e o `ALCANCE_CORPO_A_CORPO` daqui.
  No app, o
  `PalcoDaLuta` desenha os avisos no chão da sala (`TintaDaSala`), a cena
  move o herói (`SalaEmCena.MoverNaLuta`), o evento da arma fica na parte
  de cima da sala, e no fim o herói fica onde estava (se for em cima do que
  apareceu na sala, volta pro lugar em que a luta começou). Os números
  (raio do herói, alcance, tamanhos) ainda não passaram por ajuste fino com
  gente jogando.
- Efeitos da luta (2026-11-13, **só no app**, pedido do usuário): folhas de
  quadros em `Art/Jogo/Resources/Efeitos` (com o `efeitos.json`), lidas por
  `Game/Jogo/Efeitos.cs`. Cada efeito é código no formato da pixelfx
  (github.com/patch-gg/pixelfx, MIT; a skill `pixelfx` está instalada) em
  `apps/unity/Efeitos~/fx`, desenhado **no estilo do Breno** (formas
  gordas, poucos tons chapados, as cores dele) — decisão do usuário: nada do
  estilo próprio da biblioteca. `node apps/unity/Efeitos~/exporta.mjs`
  desenha com a pixelfx (um checkout fora do repo, ao lado dele:
  `Documents/projetos/pixelfx`, no commit da tag `versao-rpglegend`), põe o
  contorno escuro (#1a0b09) em volta do que é sólido e grava as folhas;
  `--ver` só gera as folhas de conferência. A lista e as cores ficam em
  `Efeitos~/efeitos.mjs`, e as formas em comum (chama em gota, bola de
  fumaça, estilhaço, nota, seta, caveirinha, caracol) em `fx/_comum.js`.
  São 32 folhas: o golpe, o crítico e o golpe no herói; um efeito por
  elemento (fogo, gelo, luz, sombra, veneno, raio, som, sangue, e o fogo e o
  gelo pequenos das runas); o poder físico; a queda; o esqueleto surgindo;
  a cura e o roubo de vida; os reforços (força, precisão, esquiva, escudo,
  crítico, canção); atordoado e lento; o desvio e o escudo do vigor
  apanhando; e dos monstros, a poeira do golpe que cai (a grande do
  Devastador), a onda do Rugido e o estouro da bola. Onde tocam
  (`TelaDeJogo.Luta.cs`): cada número da luta pelo ícone no começo dele
  (o poder usa "ícone -dano"; as runas, ⚡ 🔥 ❄️ 🩸; os estados, 💫 e 🐌;
  `EfeitosDoDano`), os reforços pelo aviso do poder (`EfeitosDosReforcos`),
  o esqueleto pela equipe (`EfeitosDaEquipe`), e o fim dos golpes dos
  monstros pela tinta do chão (`TintaDaSala.AoGolpe`: o círculo que cai, a
  investida que para, a bola que some). O corpo do monstro é peça da tela
  por cima da sala, então o que vai em cima de um monstro de pé e no herói
  apanhando vai pro palco (`PalcoDaLuta.TocarEfeito`); o resto, e o que vai
  num monstro que caiu (a luta pode acabar com ele), vai pra sala
  (`SalaEmCena.TocarEfeito`, em unidades da sala, na escala da arte).
- Doc do Breno de 2026-11-15 (combate e classes), decidido com o usuário.
  **O site é o TCC do usuário e fica na versão básica, por turnos; o
  combate e as classes novas são só da luta em tempo real do app.** O que
  já entrou (rodada 1, a base):
  - **Tabela das classes** (`hero/classes-de-luta.ts` ↔
    `Engine/Hero/ClassesDeLuta.cs`): alcance em blocos, e vida, dano e
    velocidade em % (baixo: vida −20%, dano −15%, velocidade −20%, Paladino
    −40%; "padrão/baixo" −8%; alto: vida +30%, dano +10%). **A vida da
    classe vale em todo lugar** (`vidaComAClasse` no `derived`, site, app e
    API); o dano (`danoDaClasse` em `resolve-attack`/`use-power`) e a
    velocidade (`velocidadeNaArena`) só na arena.
  - **Alcance por classe** (`alcanceNaArena`): do pé do herói ao meio da
    casa do monstro; o Bárbaro muda com a arma (`ALCANCE_DO_BARBARO`), e
    arco/cajado sem classe valem 7. Os poderes acertam de qualquer lugar.
  - **Mira**: no PC, no cursor do mouse, numa área de 3 casas de largura
    (`AREA_DA_MIRA`, `EntradaDaLuta.cursor`, `PalcoDaLuta.CursorNaSala`);
    sem monstro ali, o golpe cai no chão (`golpeNoChao`). No celular, o
    monstro mais perto (ou o escolhido na placa).
  - **Barra de vida em cima de cada monstro**, só no app.
  - **Monstros andam atrás do herói** (`aproximar`, `JeitoDeLutar.passo` e
    `.distancia`, todos mais lentos que o herói), até a distância do golpe
    deles; **até três golpeiam juntos** (`ATACANDO_DE_UMA_VEZ`), cada um
    com o respiro dele (`RESPIRO_DO_MONSTRO`); os lacaios aparecem na casa
    deles sem rearrumar a sala. Números por afinar.
  - **Membro quebrado pesa na luta**: perna quebrada anda mais devagar na
    arena, e o Brutamontes e os chefes têm 15% de quebrar um membro.
  - **A maça é do Paladino e o Monge luta com as mãos**
    (`weaponTemplate: null`, afinidade `maos`, `ataqueDasMaos`: 3 + 1 a
    cada 2 níveis). Quem já era Paladino de espada ou Monge de maça fica
    sem a maestria até trocar.
  - **Poder mágico pede o evento** (`pedirPoder`, `eventoDoPoder`): dano
    mágico e cura (`TIPOS_DE_PODER_MAGICO`) abrem as letras no PC e o
    desenho com o dedo no celular; a força do acerto multiplica o efeito, e
    errando sai com metade (`FORCA_DO_PODER_ERRADO`). A mana só sai no fim.
  Rodada 2, **amigos, chat e co-op em tempo real no app** (2026-11-16/17,
  decidido com o usuário; o site continua com o co-op por turnos):
  - **Conexão própria**: `Game/App/SocketIo.cs` é um cliente pequeno de
    socket.io v4 só com websocket (decisão do usuário: sem pacote de
    terceiros), e `Rede.cs` é a sessão estática (o espelho de
    `lib/rede/sala.ts`): liga no menu, se identifica pelo `auth` com o
    token, volta sozinha depois de cair (`rejoin`) e desliga ao sair da
    conta. Zera no `SubsystemRegistration`, porque o Editor entra no Play
    sem recarregar o domínio.
  - **AMIGOS** no menu (`TelaDeAmigos`): as mesmas rotas e conversas do
    site. **JOGAR JUNTO** (`TelaDeMultiplayer`): personagem (Aprendiz não
    entra), criar sala, código, salas públicas, convite.
  - **Salas do app separadas das do site**: o `create`/`join`/`rejoin` do
    app manda `app: true`, a sala guarda isso, quem é do outro cliente
    recebe recado e não entra, e o site esconde as salas do app da vitrine.
    Evento novo **`tempo-real`**: o servidor só repassa pro parceiro, só em
    sala do app, com teto de tamanho; nada dele é guardado.
  - **Partida em sala** (`TelaDeJogo.Coop.cs`, `Coop.cs`): só quem conduz
    manda o estado (o herói que vale é sempre o local); quem acompanha anda
    livre na mesma sala, mas não passa por porta nem encosta em nada. Cada
    um diz onde está ~10×/s (`"p"`, com a chave da sala e se caiu) e o outro
    desenha o mini boneco (`SalaEmCena.Parceiro.cs`). **Cada um grava o
    próprio herói** (`Partida.ParaGravar`: quem entrou acompanhando grava
    herói, mochila e equipe por cima do save com que entrou), diferente do
    site, que não grava a sessão em dupla.
  - **Luta em dupla** (`Dupla` em `luta/arena.ts` ↔ `Arena.cs`): cada app
    cuida do próprio herói e o de quem conduz cuida dos monstros, que vão
    no herói de pé mais perto. Quem acompanha roda um **espelho**: o estado
    dos monstros chega (`espelhoDaLuta`, `"e"`), o golpe que encosta no
    herói daqui acerta ali, e o dano dele não derruba: sai em `danos`
    (`"d"`) e a queda volta de quem conduz. Cada um recebe o XP, o ouro e
    o item da sala. Sem câmera lenta em dupla. Sem dupla, nada muda.
  - **Fantasma e Poção de Reviver** (`jogo/dupla.ts` ↔ `Duplas`): quem cai
    vira fantasma (anda seguindo o parceiro, não age, não apanha, não mexe
    em nada) e a luta segue com o outro; os dois caídos perdem. Só o
    parceiro o levanta, com a **Poção de Reviver** (`pot_reviver`, 250 de
    ouro, `foraDoSorteio`, só o vendedor do app, 12% por estoque), que
    devolve 50% da vida máxima (`"r"`); vai servir pra montaria também. O
    fantasma que fica sem parceiro levanta com 1 de vida, e o save nunca
    guarda herói com 0. O status de morto (2026-11-17) é só da tela: quem
    caiu lê "💀 Morto" embaixo das barras, e o parceiro vê a caveira em
    cima do boneco dele; a regra continua a do fantasma.
  - **Chat da sala** (`TelaDeJogo.ChatDaSala.cs`, `"m"`): o CHAT dos botões
    de cima, sem guardar nada; digitando, o teclado é do campo.
  Rodada 3a, **as classes de corpo a corpo** (2026-11-17, decidido com o
  usuário; regras em `hero/classes-de-luta.ts` ↔ `ClassesDeLuta.cs`, o que
  junta na luta em `Arena.classe`, que some no fim): o **Guerreiro** bate
  +25% colado no alvo (1 bloco), 3 críticos seguidos somam +20% de dano até
  o fim da luta (um acerto sem crítico zera a contagem e guarda o ganho; sem
  teto), e cada 10% de vida que falta dá 5% de resistência; o **Ladino**
  crita 2,25× (o de sempre é 1,6×), e a cada 5 críticos ganha uma
  furtividade (+20% de esquiva até 60%, +10% de ataque, depois +5%; metade
  contra o chefe); o **Bárbaro** junta fúria a cada golpe levado (até 15,
  +13% de dano e +3% de resistência cada, perde 2 a cada 15 s sem
  apanhar), e com arma pesada bate em área, cheio no alvo e **metade nos
  outros** (o machadão corta numa faixa até o alcance e pode atordoar, a
  marreta treme em 5 × 5 em volta dele com +20%, a maça destrói 3 × 3 no
  alvo e pode empurrar); o **Paladino** golpeia avançando até 1 bloco do
  alvo e o empurra 1 bloco, devolve 20% do dano que leva (150% com a
  absorção no teto), junta 10 de absorção por golpe (100 dá 20% de
  resistência, teto 300) e atrai os monstros (conta 30% mais perto na
  escolha da dupla, e puxa 30% dos golpes que iam nos companheiros).
  "Resistência" é a % de dano a menos no golpe levado; os efeitos se somam.
  **A classe refeita perde, na arena, a passiva antiga do site**
  (`classeRefeita`, `CLASSES_REFEITAS`; o site continua com ela). O que a
  classe junta aparece numa linha embaixo das barras, só na luta
  (`textosDaClasse`). No espelho da dupla, o empurrão e o atordoar do
  convidado não passam pro anfitrião (o dano passa).
  Rodada 3b, **as classes de longe e de apoio** (2026-11-17, decidido com o
  usuário; regras em `classes-de-luta.ts`, o que junta na luta em
  `luta/arena.ts`): **o Bardo, o Clérigo e o Druida miram num aliado**
  (`aliadoNaMira`: no PC, o cursor em cima do parceiro ou do próprio herói;
  no celular, as placas "Você" e "Parceiro" no topo da coluna; sozinho,
  mirar em si conta; recrutas e esqueletos ficam de fora). O **Arqueiro**
  bate 30% menos até 2 blocos, sempre, e de 3 em diante, parado há 3 s,
  ganha 12% por bloco até +120% (`danoDaDistancia`, `ContadoresDaClasse.parado`);
  a mira do cursor dele é 2,3× maior (`miraDaClasse`). O **Bardo**, a cada
  golpe que acerta (e a cada apoio), cura 30% da vida que falta e ganha +20%
  de dano por 6 s, nele e no aliado mirado; 5 críticos num aliado sobem a
  **moral do grupo** (até 12; os degraus 1, 3, 5, 8 e 12 se somam:
  velocidade, dano, resistência, osso que não quebra, crítico +0,5 e faixa
  do crítico 50% maior, `efeitosDaMoral`). O **Clérigo é do cajado e ataca
  com a magia do Mago, no site e no app** (catálogo: cajado 100, maça 30;
  `ataquePrincipal: 'magico'`, e `resolverGolpe` olha o ataque principal, não
  o nome da classe); no app, cada golpe cura 15% da vida máxima (nele e no
  aliado mirado), o golpe mágico bate 5× nos mortos-vivos (`MORTOS_VIVOS`:
  esqueleto, zumbi, espectro gelado) e o botão **FÉ** (tecla F) solta o
  Poder da fé uma vez a cada 7 min: em dupla a Comunhão sagrada, sozinho o
  Santo Egoísta (pede a mana cheia); cura 40%, zera a mana (a do parceiro
  também, na Comunhão), apaga os efeitos até acabar e segura a vida em 20%,
  pela duração que sai do dano levado nos últimos 30 s (`duracaoDaFe`). O
  **Druida** acerta com as vinhas o monstro a até 2 blocos de uma parede ou
  de um herói (`nasVinhas`; as salas não têm arbusto), e todo golpe deixa
  lento e envenenado (5% da vida máxima) por 2 turnos; o ataque dele mirado
  num aliado é a **Purificação** (tira o veneno e os ferimentos, cura 10%) e
  deixa o ataque esperando 30 s. **A moral e a recarga da fé ficam só na
  memória do app** (`MemoriaDaLuta`, guardada na `Partida`; a moral some
  fora da masmorra), nunca no save. Em dupla, o apoio vai pela rede
  (`QuadroDaLuta.apoios` → pacote `"a"` → `EntradaDaLuta.apoios`, e o outro
  faz a conta com o herói dele), a moral pelo `"mo"`, e o `"p"` leva o dano
  dos últimos 30 s (`"d"`, pra Comunhão). Desde então todo monstro lento
  também anda mais devagar na arena. No espelho, o lento e o veneno das
  vinhas do convidado não passam pro anfitrião (o dano passa).
  Rodada 4a, **segurar K, o Mago e o Monge** (2026-11-17, decidido com o
  usuário): **segurando K** (a tecla no PC; no celular, o botão 🌀 por cima
  do arco) o herói fica parado e sem atacar — andar ou atacar solta — e o
  Mago e o Necromante puxam 5 de mana por segundo, o Monge junta 10 de ki
  (`canalizar` na arena, `oQueCanaliza`, `passosPorPonto`). O **Mago** paga
  40 de mana pelo disparo na luta do app (`custoDaMagia`; o Clérigo continua
  5, e sem os 40 ele bate com o golpe físico) e guarda **+20% de mana em
  todo lugar** (`ClasseDeLuta.mana`, `manaComAClasse` no `derived`, como a
  vida da classe). O **Monge** junta até 300 de ki; o botão ☯️ (tecla F)
  gasta 300 e o reveste: +40% de dano até o próximo golpe levado, que chega
  30% mais fraco e quebra o revestimento; o 💥 (tecla G) gasta todo o ki e
  bate em quem está a até 2 blocos (o mais perto leva o golpe na força do
  ki, 300 = 1,5×, e os outros o mesmo dano) e empurra 1 bloco. **O ki que
  sobra fica na memória do app** (`MemoriaDaLuta.ki`, como a moral). Com
  três poderes, o arco do Monge abre pra seis botões.
  Rodada 4b, **o Necromante** (2026-11-17, decidido com o usuário; regras em
  `combat/invocacao.ts`, `REGRAS_DO_NECROMANTE`): **os números do Breno só
  no app** — na luta do app o Levantar Esqueleto faz o lacaio com 2× a
  Inteligência de dano e 2× a vida do herói, por 65% da mana máxima, até 3
  (`criarLacaio`, `invocarLacaio` na arena); o site continua com o esqueleto
  de 2026-11-12, e o que já está de pé fica como foi feito. **O lacaio tem
  corpo na arena** (`CompanheiroNaArena.x/y`; os recrutas continuam fora do
  chão): na retaguarda (o estado novo) fica perto do dono e ataca quem chega
  a 3 blocos dele (+10% de dano); no ofensivo vai atrás de qualquer um (+10%
  de resistência); bate pelo jeito da espécie (quem atira, de longe). Os
  monstros vão atrás do lacaio que estiver mais perto (`noLacaio`), e o
  golpe cai nele. A janela LACAIOS (tecla K fora da luta, ou o botão de
  cima) troca o estado (`estadoDoLacaio` no `Companion`). Na luta do
  Necromante, quem cai deixa um **cristal** 💠 no chão (`Arena.cristais`),
  que fica na sala até o herói sair (na `Partida`, fora do save); encostar
  abre a troca de um lacaio por aquele inimigo, com a mesma vida e o mesmo
  dano (`trocarPeloCristal`; o do chefe só acima do nível dele e falha 65%).
  O botão ☠️ **Magia Proibida** (tecla F) levanta o parceiro caído com 50%,
  pelo "r" da Poção de Reviver, com 90% de vida e de mana (só requisito), uma
  vez a cada 14 min (memória do app). O Necromante que cai se levanta sozinho
  com 50% e a magia fica selada até zerar aquela masmorra:
  **`Hero.bloqueioDaMagia`, no save** (o site só guarda; `liberarMagia` em
  `limparSala` a devolve). Em dupla, os lacaios de quem acompanha aparecem
  pro outro (o "p" leva `l`, só desenho), mas os monstros só vão atrás dos
  de quem conduz. O texto da janela evita "fi" minúsculo: nessa fonte vira
  outra letra.
  Rodada 5a, **estilos e mestres: o Guerreiro e o Monge** (2026-11-17,
  decidido com o usuário; regras em `hero/estilos.ts` ↔ `Engine/Hero/Estilos.cs`):
  **o mestre de estilo é uma sala da masmorra, só do app** (`'estilo'`,
  `MestreDeEstilo` na célula), depois de zerar a Floresta na dificuldade do
  personagem: cada andar novo tem a chance da classe (`CHANCE_DO_MESTRE`:
  Guerreiro, Druida e Monge 15%, Mago 10%) se ainda falta estilo, sorteada
  em `mestreDoAndar` depois do professor (o rng só gasta quando pode
  aparecer), e ele ensina **um estilo sorteado** entre os que faltam (os
  raros com a chance deles). Aprender (`aprenderComMestre`, a tela
  `mestreDeEstilo`) põe o estilo em **`Hero.estilos` e o deixa ativo em
  `Hero.estilo`, no save** (o site só guarda); **a troca é na guilda**
  (`trocarEstiloNaGuilda`, as cartas do app), e as duas recalculam a vida
  (`recomputeDerived`). **O Cavaleiro tem +40% de vida em todo lugar**
  (`vidaComOEstilo` no `derived` e no `sanitize` da sala da API, que
  desde então também conta a mana do Mago); o resto é só da arena: o
  **Espadachim** avança até 3 blocos rumo ao alvo no golpe, com 1 s de
  imunidade, a cada 5 s (colado no alvo, atordoa 2 s em vez de avançar), e
  segurando K junta ki a 3/s pro **Corte Invernal** (botão ❄️, tecla F, 300
  de ki: uma faixa de 3 casas que anda 6 blocos e acerta todo mundo nela, a
  80% do golpe); o **Cavaleiro** crita +30% e desvia 1 em 5; o **Empurrão**
  bate +25% e pega quem está a 1 bloco do alvo, com 25% de empurrar e
  atordoar cada um; o **Dash/chute** alcança 5 blocos avançando até o alvo,
  erra 1 em 10 e crita +40%; a **Concentração** junta uma carga a cada 3 s
  sem golpear (até 3, +50% cada no próximo golpe, que gasta todas) e dá +1
  de alcance. O que o estilo junta mora em `Arena.classe` e aparece na linha
  da classe.
  Falta, nesta ordem: os estilos do Druida (5b) e os elementos do Mago (5c);
  mercadores secretos e itens novos (a arte das armas novas é o Claude que
  desenha, no estilo do Breno); o Caçador.
- Doc do Breno de 2026-11-13 (aba "arrumar"), decidido com o usuário:
  **empilhamento só na tela**, no site e no app: as peças iguais da mochila
  (e da venda da loja) viram uma carta "×5" (`empilhar`/`mesmaPeca` em
  `inventory/inventory.ts`, portados com os casos de teste; igual é igual em
  tudo menos `uid`, `foundFloor` e `equipped`, e o vestido nunca empilha);
  no save cada peça continua a dela, usar, vender ou descartar gasta a
  primeira, e a ficha passa pra próxima igual. **As configurações dentro do
  jogo, só no app**: o CONFIG dos botões de cima abre a tela do menu
  (`TelaDeConfiguracoes.Abrir(doJogo)`) por cima da partida, com a janela
  "config" (o herói não anda e a luta pausa). **Créditos no menu, no site e
  no app**, "o mais discreto possível": um "créditos" miúdo no canto de
  baixo (no site à esquerda, longe do gato; no app à direita), que abre uma
  janelinha com a arte (Breno), o jogo (Kingdark17), as fontes e a pixelfx.
  O texto mora em dois lugares, `app/menu/creditos.tsx` e `App.uxml`
  (`janela-de-creditos`): mudou um, mudar o outro.
- O andar (2026-11-06, **site e app**, doc do Breno decidido com o
  usuário): não há mais sala de saída em todo andar. Só o andar em que se
  entra pelo portão (o 1 ou o de um totem, e o save sem mapa) sai pela sala
  de início, que vira a saída (`generateDungeonFloor`, `entrada`). Nos
  andares de chefe (a cada 5) a escada fica numa ponta logo atrás da sala
  dele (o andar é uma árvore: a sala mais distante é uma ponta, e a de antes
  dela vira o covil); vencê-lo não desce mais sozinho: ele deixa a "chave"
  (a escada, trancada com o chefe vivo, abre), e no covil fica o pilar de
  volta à cidade (`ICONE_DO_PILAR`, arte provisória), que pergunta antes de
  acender. Os totens de 20, 40, 60 e 80 continuam.
- Dificuldade por personagem e "mais difícil" (2026-11-06, **site e app**,
  doc do Breno decidido com o usuário): a dificuldade (Normal, Difícil,
  Pesadelo) é escolhida na criação do personagem e vale pra sempre e pras
  três masmorras, como o modo de um mundo do Minecraft (`dificuldade` no
  save; quem é de antes é Normal, e a API recusa save que a troque). Ela não
  sobe mais a escada de força (cada masmorra começa onde o Normal dela
  começa): só multiplica a vida e o dano dos monstros (`peso` em
  `DIFFICULTIES`: 1, 1,25 e 1,6), sem pagar mais. O portão só a mostra, e a
  masmorra seguinte pede a anterior zerada na mesma dificuldade. Por cima
  disso, pra todos ("o Moderado"): monstros com 30% mais vida e dano
  (`ENDURECIMENTO`), chefes mais 30% (`ENDURECIMENTO_DO_CHEFE`), grupos de 2
  e 3 mais comuns e de 4 a partir do andar de força 30, a poção 50% mais
  cara na loja e em metade dos baús pequenos, e a taverna cobrando 5 de
  ouro por nível.
- Armadilhas e ferimentos (2026-11-06, **site e app**, doc do Breno decidido
  com o usuário): armadilhas escondidas no chão de salas sorteadas (20%, nunca
  no início, na saída, na escada nem no covil; `dungeon/armadilhas.ts`)
  disparam ao pisar (`armadilhaSob` a cada passo, `pisarNaArmadilha`):
  espinhos (dano e sangramento), dardo (veneno) e pedras (podem quebrar um
  membro); disparada fica à vista, e quem tem Sabedoria às vezes vê o brilho
  antes. O dano nunca mata (para em 1). Os ferimentos moram no herói
  (`hero.ferimentos`, `hero/ferimentos.ts`): braço quebrado bate 30% mais
  fraco, perna quebrada anda a 60% e tira 4 da fuga, veneno e sangramento
  tiram vida a cada sala e passam sozinhos; o golpe de chefe que acerta tem
  15% de quebrar um membro. A taverna sara tudo, e a tala (consumível novo,
  arte provisória em `img/potions/tala.png`) conserta os membros.
- Mecânicas de chefe (2026-11-06, **site e app**, doc do Breno; o usuário
  quis as duas coisas): todo chefe de andar 5 (menos o final, que tem as
  fases dele) ganha a mecânica da masmorra na metade da vida, a segunda fase
  (a Floresta chama 2 lobos; a Caverna apaga a luz, e a zona da mira some;
  a Torre ergue um escudo elemental que reveza físico e mágico a cada 2
  golpes dele e segura 70% do dano daquele tipo), e uma ou duas sorteadas
  na geração (`monsters/mecanicas-do-chefe.ts`): invocar (2 ajudantes na
  metade), barreira (segura 20% da vida antes do dano), golpe carregado (o
  Devastador com aviso a cada 4 golpes), cura (25% uma vez, com 30% da
  vida) e fúria (com 30%, mais dano e velocidade). Tudo passa por
  `ferirMonstro` (`jogo/chefe-final.ts`); a placa mostra `marcasDoChefe`, e o
  golpe que o derrubaria de cima da metade para nela.
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
