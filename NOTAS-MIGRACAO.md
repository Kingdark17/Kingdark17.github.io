# Notas da migração — RPG Legend

Caderno de trabalho da migração pro monorepo. **O que entra aqui:** o que
descobri lendo o servidor real e não está óbvio no código — bugs do
original, desvios conscientes do porte, o que está travado esperando
credencial, armadilhas de deploy e o contrato de rede do multiplayer.

**O que NÃO entra:** decisão de arquitetura fechada (isso é `CLAUDE.md`) e
nada que o código ou o `git log` já contem sozinhos.

Última atualização: 2026-08-16.

---

## Estado por fase

| Fase | Situação |
|---|---|
| 0 — monorepo | pronta |
| 1 — engine em `packages/shared` | pronta (326 testes) |
| 2 — Nest ainda no Neon | porte **completo**, verificado contra Postgres real |
| 3 — front Next | **pronta**: conta, personagem, cidade, masmorra, combate, loja/ferreiro, NPCs, quadro de missões, eventos, mochila, level up manual, perfil/cosméticos, amigos e chat, guia, painel ADM e multiplayer co-op |
| 4 — paperdoll PixiJS | não começou |
| 5 — **Neon → Supabase** | não começou — **reafirmado pelo usuário em 2026-08-13: fazer assim que a migração terminar** |
| 6 — otimização | **em andamento** — JavaScript cortado e medido, foto de perfil fora do JSON, `pnpm lint` verde. Falta o Redis, que depende de onde a API vai rodar |

### Fase 2 — o que já existe no Nest

Todas as rotas do `accounts.js` e todas as mensagens de socket do
`server.js` estão portadas: conta, save na nuvem, cosméticos, amigos,
chat, presença, relay de sala co-op, `/api/rooms`, `/health`,
`/api/account/status`, e-mail/reset de senha.

### Fase 2 — o que falta

1. Rodar contra um `DATABASE_URL` de staging de verdade.
2. Fechar o e-mail com `RESEND_API_KEY`.

### Como os testes de banco funcionam

Os testes de integração sobem **PGlite** (Postgres compilado em WASM)
atrás de um socket que fala o protocolo do Postgres. Nada do código de
produção sabe que está em teste: `getDb()` abre o mesmo `pg.Pool` de
sempre contra uma `DATABASE_URL` normal. Sem Docker, sem credencial.

O banco de teste nasce do **DDL do `init()` do servidor original**
(`src/db/testing/original-ddl.ts`), não de `drizzle-kit generate` a
partir do nosso schema — gerar do próprio schema seria circular.

Isso exige `--experimental-vm-modules` no Node (PGlite usa `import()`
dinâmico), já embutido no script `test`.

**Limite:** é Postgres, mas não é o Neon. Diferença de versão, extensão
ou comportamento do pooler só um `DATABASE_URL` de staging pega.

---

## Bugs encontrados no servidor original

Achados lendo `github.com/Kingdark17/RPG-Legend-Server` pra portar. Os
marcados "corrigido" já estão certos no Nest; os "mantido" continuam
iguais no porte e precisam de decisão sua.

| # | Bug | Situação |
|---|---|---|
| 1 | `{type:'error'}` não leva `room`, e o cliente descarta toda mensagem com `msg.room!==session.room`. Ou seja: **"Sala cheia." e "Sala já existe." nunca apareceram pra ninguém.** | corrigido no Nest |
| 2 | Se o anfitrião sai e o convidado fica sozinho, quem entrar depois **também** vira papel 2. Ninguém conduz a exploração e a sala trava. | **mantido** — promover o novo a papel 1 resolve, mas muda regra de jogo |
| 3 | `clone(room.state.pos)` estoura quando a posição ainda não existe (`JSON.parse(undefined)`), engolido pelo try/catch da mensagem | corrigido no Nest |
| 4 | Reset de senha faz `SELECT` e depois `UPDATE`: duas requisições com o mesmo link podiam passar as duas | corrigido (virou `UPDATE ... WHERE token AND expires_at>now`) |
| 5 | Exceção de rede no envio de e-mail sobe e vira 500 — provedor fora do ar reprovava cadastro | corrigido (vira `false` e loga) |
| 6 | `connected` do `/health` era um flag gravado no boot: continuava `true` depois do banco cair | corrigido (mede na hora com `SELECT 1`) |
| 7 | Rate limit por IP usa o IP visto pelo servidor. Atrás de proxy vira limite global | **mantido** — depende de ligar `trust proxy` no deploy |

### Divergência entre o CLAUDE.md e o jogo de verdade

O `CLAUDE.md` diz "poder de assinatura fixo por classe + **até 2
escolhidos pelo jogador**". O jogo em produção **sorteia** os dois:
`rerollPowers()` em `rpg-legend/js/ui.js`, e o grid de poderes não tem
handler de clique — só raça e classe são clicáveis.

O porte seguiu o código, não a documentação. Mudar isso é decisão de
regra de jogo, não de migração.

### Bug do porte, achado pelos testes de integração

`isUniqueViolation()` só olhava `err.code`, mas o Drizzle embrulha o erro
do driver num `DrizzleQueryError` e põe o original em `cause`. Cadastro
com username repetido responderia **500 em vez de 409**. Passou por
typecheck e por todos os testes de unidade — só apareceu quando uma query
de verdade rodou. É o argumento a favor de ter feito a verificação com
PGlite antes de começar a fase 3.

Fora esses, dois achados de desempenho de sessões anteriores continuam
valendo: avatares em base64 viajando dentro de `/api/friends`, e o estado
inteiro sendo transmitido a cada ação no multiplayer.

---

## Desvios conscientes do original

Tudo isto está comentado no código também, mas aqui fica a lista junta.

| Onde | Desvio | Por quê |
|---|---|---|
| gateway | eventos nomeados de socket.io no lugar do envelope `{type:...}` | decisão fechada no `CLAUDE.md` (socket.io substitui `ws`); o cliente atual em `rpg-legend/js/multiplayer.js` **não fala** com o servidor novo de jeito nenhum |
| gateway | payload montado campo a campo em vez de ecoar o objeto do cliente | o original deixava qualquer campo extra do remetente chegar na tela do parceiro |
| `sanitize.ts` | reusa `equipmentCap`/`equipmentStat`/`xpForLevel` de `packages/shared` | as duas cópias da fórmula de HP/MP já tinham divergido antes da migração |
| `/health` | `connected` medido na hora | ver bug #6 |
| e-mail | erro de rede no envio não sobe | ver bug #5 |
| e-mail | tamanho da senha é validado antes de olhar o token | não gastar o link por causa de senha curta |
| repositórios | `getDb()` só é chamado dentro dos métodos | o app sobe e roteia sem `DATABASE_URL`; só quebra a rota que precisa do banco |
| front (fase 3) | o combate grava a cada ação, não só no fim | fechar a aba no meio de um chefe não devolvia o chefe com vida cheia — o original salva igual |
| front (fase 3) | guardar ou trocar a arma **devolve a peça pra mochila** | a arma inicial nasce só dentro de `hero.equip.arma`, sem entrada na mochila. No jogo antigo, equipar outra arma a apaga pra sempre — isso não é regra, é bug |
| engine | `useConsumable()` virou `consumeItem()` | o `react-hooks` do ESLint trata qualquer `useX()` como Hook e recusa a chamada fora de um componente. Mesmo motivo do `castPower()` |
| front (fase 3) | o pet entra no combate por **parâmetro** (`iniciarEncontro(estado, pet)`) | o original lia o global `RPG.Account.currentUser()` de dentro de `combat.js`. Pet é cosmético da conta: passando por parâmetro ele não entra no save nem viaja pela rede a cada golpe |
| gateway | anfitrião que cai **promove** quem ficou (`role-changed`) | no original a sala travava: só o papel 1 conduz exploração e só o papel 2 pede `boss-advance`, então quem sobrava não conseguia fazer nem um nem outro. Decidido com o dono do projeto em 2026-08-15 |
| relay | o cosmético do parceiro (`publicProfile`) volta a atravessar o relay | o porte só deixava passar `name`/`hero`/`inventory`/`party`, então o cartão de perfil público aparecia sem rosto. Moldura, cor e pet são presos ao catálogo, e o avatar só passa como `https:` ou `data:image/(png\|jpeg\|webp)` |
| front (fase 3) | o modo infinito do ADM só liga no clique | o original chamava `applyGodMode(true)` sozinho toda vez que um admin entrava no jogo, e mandava pra nuvem em seguida. Reescrever o save de alguém sem pedir não dá pra desfazer |
| front (fase 3) | texto com `<b>` da engine vira `<strong>` de verdade, sem `innerHTML` | o original jogava tudo em `innerHTML`; o mapa trafega pela rede e um dia vem de outro jogador no multiplayer |
| front (fase 3) | sem token, `chamarApi` já rejeita no cliente | evita mandar `Bearer ` vazio e tira o `setState` síncrono de dentro do `useEffect` (regra `react-hooks/set-state-in-effect` do lint do Next 16) |
| front (fase 3) | a arte dos itens foi **copiada** de `rpg-legend/img/` pra `apps/web/public/img/` | 240 KB, 28 arquivos. O app na Vercel não pode depender do GitHub Pages pra desenhar um item. Enquanto os dois clientes coexistirem há duas cópias; a do jogo antigo some junto com ele |
| front (fase 6) | a entrada dos cartões do menu é `@keyframes`, não Motion | medido: ~106 KB de JS na primeira página que qualquer pessoa abre, por um fade de cinco cartões. Ver "Fase 6" |
| front (fase 6) | socket.io entra por `import()` dentro de `conectar()` | 41 KB que só quem abre sala ou fica de olho no chat precisa. Quem joga sozinho pagava por ele em `/jogo` sem nunca conectar |
| API (fase 6) | a foto de perfil vira `GET /api/users/:username/avatar`, sem sessão | o original manda base64 dentro do JSON de `/api/friends` e dentro de `state.profiles`, que o relay reemite a cada ação. Ver "Segundo corte" |
| API (fase 6) | corpo de requisição passa por `comoTexto()` em vez de `String()` | `String({})` é `'[object Object]'`: o original aceitava `{"username": {}}` como nome de conta e `{"room": ['A','B']}` como sala `A,B` |

### Fase 3 — o que já dá pra jogar

Criar conta → criar personagem → andar pela cidade → taverna → comprar,
vender e reforjar → **conversar com NPC e usar o serviço dele** → **pegar
missão no quadro** → atravessar o portão → explorar a masmorra → abrir
baú → lutar → **resolver evento de sala** → descer escada → sair pela
saída e voltar pra cidade — **abrindo a mochila a qualquer momento pra
trocar equipamento, beber poção e distribuir os pontos do nível**. Tudo
gravando na nuvem com a assinatura encadeada.

A mochila é a única tela que não é sala: abre por botão na exploração, e
continua acessível com a pergunta "deseja entrar?" na tela — beber uma
poção antes de encarar o monstro é justamente quando ela serve.

Na página da conta dá pra trocar foto, moldura, cor do nome e pet, e
comprar cosmético na loja. O ouro da compra sai do **personagem**, não de
uma carteira da conta — por isso a loja pede o slot antes.

Amigos e conversa têm página própria (`/amigos`): pedir, aceitar,
recusar, remover e trocar mensagem. O histórico vem do banco por REST.

O menu principal (`/`) tomou o lugar da página de fumaça da fase 0.

Painel ADM e Guia do Aventureiro abrem por botão na exploração — o ADM só
aparece pra conta administradora, e quem diz quem é admin é o servidor.
As seis etapas dos Primeiros Passos são marcadas ao andar, abrir a
mochila e entrar em NPC/loja/portão/monstro, com a mesma recompensa de 40
de ouro e uma poção.

Em `/multiplayer` dá pra criar sala (pública ou por código), entrar numa
sala da vitrine, chamar um amigo online e ver o perfil público do
parceiro — o cartão com moldura, cor do nome e pet. Daí vai pro jogo com
`?sala=CODIGO`.

### Onde mora a sessão de tempo real

`apps/web/lib/rede/sala.ts`, **fora do React** — mesma regra da engine. A
conexão é uma por aba e sobrevive à navegação entre páginas; um provider
teria o ciclo de vida errado (o StrictMode monta duas vezes em dev e
conectaria duas vezes). Quem lê assina com `useSyncExternalStore`
(`use-sala.ts`), e o instantâneo imutável decide sozinho se re-renderiza.

O `setEstado` que aplica o pacote do parceiro assina a sessão direto em
vez de olhar o instantâneo a cada render: `setState` dentro de callback
de fonte externa é o caso pra que `useEffect` existe, e é o que a regra
`react-hooks/set-state-in-effect` do Next 16 aceita.

### O que o co-op compartilha, e o que não

Mapa, posição, andar e missões viajam; herói, mochila e equipe ficam em
`profiles[papel]` e voltam pra quem os mandou. `aplicarRemoto` monta o
estado novo com o mapa do parceiro e o **meu** perfil — nunca o dele.

**Em sala, a gravação na nuvem fica desligada** (decidido com o dono do
projeto em 2026-08-15). O mapa da sessão é o do anfitrião; gravá-lo no
slot do convidado substituiria a masmorra dele pela do parceiro só por
ter entrado pra ajudar. O original faz isso — `applyState` chama
`originalSave(s)` a cada sincronização. Ao sair da sala, o save do slot
está como ele deixou.

Consequência aceita: progresso ganho em co-op (ouro, XP, item) não
sobrevive à sessão para o convidado.

### Fase 3 — concluída

Toda tela do cliente antigo tem equivalente no front novo. O chat é
híbrido de propósito: histórico e envio por REST, socket só pro aviso de
mensagem nova — a mesma `SocialService` empurra o aviso quando a mensagem
entra por REST, então mandar por socket não mudaria nada e perderia a
resposta de erro. O botão "Atualizar" continua na tela como saída pra
quando o socket estiver fora do ar.

### Onde o combate ficou dividido, e por quê

A engine (`packages/shared/src/combat/`) tem as peças puras de uma ação:
`resolveAttack`, `castPower`, `applyPartyTurn`, `tickMonsterDot`,
`applyMonsterHit`, `attemptFlee`. Nenhuma delas decide o que vem depois.

A **ordem** delas e o que cada resultado significa pro save (quem entra na
fila, o que cai de recompensa, pra onde o jogador vai) mora em
`apps/web/lib/jogo/combate.ts`, junto de `estado.ts` e `sala.ts`.

Isso deixa uma pergunta em aberto pra quando o Nest for validar jogada:
`estado.ts`/`combate.ts` teriam que ir pra `packages/shared` também,
porque o servidor precisa do mesmo tipo de save e da mesma máquina de
turnos. Não movi agora porque a fase 3 ainda está mexendo neles todo dia —
é decisão pra fase 6.

### Salas com tela própria

`interagir()` devolve `tela: TelaAberta | null` — união discriminada por
`tipo` (`combate`, `loja`, `dialogo`, `missoes`, `evento`). Antes eram
campos opcionais soltos (`combate: Combate | null`, `loja?: Loja | null`)
e ia virar um por tipo de sala; a união deixa a tela só olhar `tipo`.

As três últimas seguem o mesmo padrão de sempre — a engine já tinha tudo
(`npc-services.ts`, `quests.ts`, `events.ts`), e o módulo em
`apps/web/lib/jogo/` só guarda o que é sessão e escreve de volta o que é
save:

- `dialogo.ts` — a fala atual é sessão; `serviceUsed` é save e volta pro
  `cell.npc`, senão dava pra curar de graça saindo e voltando da conversa.
- `missoes.ts` — nada é sessão. O progresso já era atualizado de dentro do
  combate, do baú e da geração de andar.
- `evento.ts` — `resolved` é save e volta pra sala. Os rótulos dos botões
  (`Dar 15 ouro`, `Usar SAB`...) moram aqui porque no original eram string
  de HTML dentro de `js/events.js`.

Uma duplicação apareceu e foi removida no caminho: `comecarCombate` fazia
o consumo da bênção de NPC na mão, com a fórmula copiada. Agora chama
`applyNpcBlessing`, que já estava portada.

### Loja e ferreiro

Mesma divisão do combate: a economia inteira já estava na engine
(`rollStock`, `resolveBuy`, `resolveSell`, `resolveForge`,
`resolveRestock`, `discountForRoll`), e `apps/web/lib/jogo/loja.ts` só
guarda o que é sessão — o desconto da pechincha e quantas renovações já
houve nesta visita, que no original eram variáveis módulo-level zeradas a
cada `open()`.

O **estoque não é sessão**: mora em `cell.forSale`, na própria sala, e vai
pro save — igual `ensureStock()` do original. Sair e voltar não sorteia
estoque novo de graça, senão o botão de renovar (que cobra ouro) não teria
razão de existir. Isso obrigou a acrescentar `forSale?: Item[]` em
`CityCell` na engine, e a fazer `substituirCelulaAtual` funcionar também
na cidade — lá o `map` e o `cityMap` são o mesmo mapa e precisam andar
juntos.

`FORGE_MATERIALS` na engine só guarda custo e probabilidades por
`templateId`; nome e arte do material vêm do catálogo de itens
(`templateById`). O original duplicava as duas coisas.

O d20 é rolado **na tela** e passado como parâmetro pra máquina de turnos.
Foi de propósito: é o número que o jogador vê, e é o que o servidor vai
precisar receber pra conferir a jogada.

`usePower` da engine virou **`castPower`**: o lint do React reserva o
prefixo `use` pra hooks e reprova qualquer `useAlgumaCoisa()` chamado fora
de componente. O nome do original está no comentário do arquivo.

**Verificado contra a API de verdade** (PGlite local, `pnpm --filter api
dev:db`): save de masmorra sobe, volta idêntico (`deepStrictEqual`; a
diferença de string é só ordem de chave do `jsonb`), escada e saída
gravam, e assinatura velha leva **409**. Um andar inteiro de masmorra dá
~6,6 KB de JSON — bem abaixo do limite de 700 KB do corpo, porque monstro
guarda `speciesId` e item guarda `templateId` em vez do catálogo inteiro.

Save **no meio da luta** também: sobe, volta idêntico, e não vaza pro
save nenhum campo que `monsterView()` acrescenta (`species`, `name`,
`icon`...). Era o risco real do combate — sem o `despirView` de
`combate.ts`, o catálogo da espécie inteiro entraria no save e trafegaria
a cada golpe no multiplayer.

Save **com estoque de loja** idem: o `forSale` da sala sobe e volta
idêntico, e o `cityMap` guarda o mesmo estoque. Save com **NPC já
atendido, missões no quadro e evento resolvido** também: os três voltam
idênticos, com o `serviceUsed` gravado dentro do `cityMap`. O item no save continua
sendo só `uid/templateId/rarity/stats/value/equipped` — o catálogo não
entra. E a arte serve de `/img/...` no build do Next (conferido com
`next start` + `curl`, 200 e `image/png`).

---

## Fase 6 — otimização

### Como medir (pra repetir depois)

Não dá pra confiar no relatório do `next build`: ele conta o que é
compartilhado uma vez só. O que interessa é **quanto JavaScript o
navegador baixa antes da página funcionar**, rota por rota:

1. `pnpm build` em `apps/web`.
2. Somar o tamanho de cada `<script src="/_next/static/chunks/...">` do
   HTML da rota. Nas rotas estáticas (`○` no relatório) o HTML já está em
   `.next/server/app/NOME.html`, sem precisar servir nada; nas dinâmicas
   (`ƒ`, hoje só `/jogo`) é `next start` e `curl`.
3. **Descartar o `<script>` marcado `noModule`.** São os polyfills do
   core-js, 110 KB que só navegador velho baixa. Contá-los infla toda
   rota pelo mesmo valor e faz o número parecer bem pior do que é.
4. `grep` por `engine.io` / `motionValue` dentro dos pedaços diz se uma
   biblioteca específica entrou na carga inicial.
5. **Somar também as fontes**, que não aparecem em relatório nenhum: os
   `<link rel="preload" as="font">` do HTML são baixados antes do
   primeiro texto e chegaram a pesar mais que o JS de qualquer rota.

Rota **dinâmica** (`ƒ`) não tem HTML no disco, então o passo 2 não serve.
Pra essas, a lista sai de `.next/build-manifest.json` (`rootMainFiles`)
mais os pedaços citados em
`.next/server/app/<rota>/page_client-reference-manifest.js`. Conferido
contra as rotas estáticas: os dois caminhos dão o mesmo número, ao KB.

### Primeiro corte — o que saiu e quanto foi

Navegador moderno, sem o polyfill `noModule`:

| Rota | Antes | Depois |
|---|---|---|
| `/` | 553 KB | **449 KB** |
| `/jogo` | 624 KB | **584 KB** (e 580 KB depois do terceiro corte) |
| `/multiplayer` | 558 KB | **518 KB** |
| `/amigos` | 494 KB | **454 KB** |

Total dos pedaços gerados no disco: 950 KB → **855 KB** (esse número
inclui tudo que o build produz, o polyfill junto).

Duas coisas, as duas achadas medindo e não chutando:

- **Motion saiu do menu.** Eram ~106 KB de JavaScript na primeira página
  que qualquer pessoa abre, para um fade de cinco cartões que CSS faz com
  `@keyframes` + `animation-delay`. `/` agora é Server Component puro,
  sem uma linha de JS próprio. É a mesma regra que já valia pros loops
  decorativos do jogo (`CLAUDE.md`).
- **socket.io virou `import()` dinâmico** dentro de `conectar()`, em
  `lib/rede/sala.ts`. São 41 KB que só fazem sentido pra quem vai abrir
  uma sala ou ficar de olho no chat; quem joga sozinho nunca baixava
  socket nenhum e mesmo assim pagava por ele em `/jogo`. O pedaço
  continua existindo, agora sob demanda.

O que sobrou é quase todo do Next, não nosso: `react-dom` é o maior
pedaço do build (223 KB) e o runtime do App Router vem logo atrás
(150 KB). A engine aparece em dois pedaços, 76 KB e 61 KB — é o catálogo
de itens/monstros, e é o que faz o jogo existir.

Os 110 KB de core-js continuam sendo gerados, mas só um navegador sem
suporte a `type="module"` os baixa. Encolher isso é mexer no
`browserslist`, ou seja, decidir quais navegadores o jogo ainda atende —
não é otimização, é escopo.

### Segundo corte — a foto de perfil parou de trafegar em base64

O `avatar_url` do banco é ou um `https://` que o jogador digitou, ou um
`data:image/...;base64,...` de até 400 KB. O segundo viajava embutido em
JSON, em dois lugares:

1. **`/api/friends`** devolve amigos + pedidos recebidos + pedidos
   enviados, cada um com a foto inteira. A resposta é `no-store`, então
   abrir `/amigos` e depois `/multiplayer` baixava tudo de novo.
2. **O relay do co-op**, muito pior: `applyState` recalcula
   `state.profiles` a cada `state`, e `state` sai **a cada ação**. A foto
   dos dois jogadores ia junto de cada passo, ataque e poção, nos dois
   sentidos.

Agora existe `GET /api/users/:username/avatar?v=<versão>`, e os dois
lugares mandam esse endereço no lugar da imagem. O `v` é a impressão
digital do conteúdo: trocar de foto muda o endereço, então a resposta
pode ser `immutable` por um ano sem nunca servir foto velha. Quem usa
link externo passa direto, como antes.

**A rota é pública, decidido em 2026-08-16.** Um `<img src>` não manda o
`Bearer` do localStorage; exigir sessão obrigaria a buscar cada foto por
`fetch` e virar blob. A foto já é visível pra qualquer amigo e em
qualquer sala pública.

Duas coisas que o teste guarda porque quebrariam calado:

- O `Cache-Control` do handler **sobrescreve** o `no-store` que o
  `NoStoreInterceptor` põe em tudo que é `/api/*` (o interceptador roda
  antes; `setHeader` substitui). Se isso inverter, o navegador rebaixa a
  foto toda vez e a otimização vira nada, sem nenhum outro teste falhar.
- O caminho que a API devolve é **relativo a ela mesma**. O front prefixa
  com a base da API (`urlDaApi`, em `lib/api/client.ts`) antes de pôr num
  `<img>`, porque os dois moram em domínios diferentes.

**O base64 também parou de sair do banco.** A lista ainda lia
`avatar_url` inteiro do Postgres pra calcular a versão, e o Postgres está
do outro lado da rede: com 20 amigos eram alguns megabytes vindos do Neon
a cada `/amigos`, pra jogar fora em seguida. Agora quem calcula é a
própria consulta (`substr(md5(avatar_url), 1, 12)`) e só o resumo
atravessa.

Isso podia virar regra duplicada em SQL e em JS. Não virou porque o
contrato de `version` é **frouxo de propósito**: qualquer texto que mude
quando a foto muda. Ninguém interpreta o valor, só compara — então o SQL
usa `md5`, o fake dos testes usa `resumoDoAvatar`, e os dois estão
certos. A montagem do endereço, essa sim, continua num lugar só
(`publicAvatarUrl`).

O que o SQL faz sozinho é justamente o que teste de unidade não pega, por
isso o teste de integração com Postgres de verdade troca a foto e
confere que o endereço muda: é disso que o cache de um ano depende.

### Motion, onde ele ganha o lugar — e quanto custa de verdade

Decidido em 2026-08-16: em vez de remover a dependência que tinha ficado
sem uso, usar Motion onde CSS não alcança. Só há um lugar assim no jogo,
e é a **saída** de elemento: o CSS não anima o que já saiu do DOM.

Ficou no **log de combate** (`tela-combate.tsx`). Ele guarda oito linhas;
cada golpe entra embaixo e empurra a mais velha pra fora. Sem animação de
saída, a linha some no mesmo quadro em que a nova aparece e a leitura
vira um pulo. `AnimatePresence` resolve; `@keyframes` não tem como.

Isso obrigou o log a ter **chave estável** (`{id, texto}` em vez de
índice) — com chave por índice o React reaproveita a `<li>` e a saída
nunca chega a rodar. Os ids são atribuídos no manipulador de evento, não
dentro do `setHistorico`: em StrictMode o atualizador roda duas vezes.

**O custo medido, que não bate com o que o `CLAUDE.md` supõe:**

| Arranjo | Total gerado | `/jogo` inicial |
|---|---|---|
| sem Motion | 855 KB | 584 KB |
| `import()` inline dentro da tela | 1097 KB | — |
| `LazyMotion` + `motion/react-m` + arquivo próprio de recursos | 944 KB | **635 KB** |

Duas lições concretas:

- **O `import()` do pacote de recursos precisa de arquivo próprio**
  (`animacoes-do-log.ts`). Chamar `import('motion/react')` de dentro da
  tela que já importa `motion/react` não separa nada — o build acabou com
  **duas cópias** e +242 KB.
- **`LazyMotion` não custa "~6 KB".** Esses 6 KB são o núcleo do `m`
  sozinho. Com `LazyMotion` + `AnimatePresence` + `MotionConfig`, o
  pedaço que `/jogo` baixa de cara é **~50 KB**, mais ~38 KB que chegam
  depois, na primeira animação. É oito vezes o que o `CLAUDE.md` diz.

Os 50 KB depois saíram da carga inicial junto com as outras telas de sala
(ver a seção seguinte), então o custo real ficou sendo só o download
tardio.

### Terceiro corte — as telas de sala saem da carga inicial

`tela-jogo.tsx` importava as sete telas de sala de uma vez. Nenhuma
aparece quando `/jogo` abre: o jogador cai no mapa e só depois entra numa
loja, num combate, no quadro de missões. Todas viraram `next/dynamic` com
`ssr: false` — que é honesto, porque enquanto o save não volta da nuvem a
tela devolve `null` e nada disso renderiza no servidor mesmo.

**`/jogo`: 635 KB → 580 KB.** Abaixo até dos 584 KB de antes do Motion,
que agora viaja no pedaço do combate em vez do inicial.

A de combate é buscada por um `import()` solto assim que a tela monta.
Estar fora do pacote inicial não pode virar espera no momento em que o
monstro aparece — todo mundo abre essa tela, e cedo. As outras carregam
no clique, com um "Abrindo…" que só aparece na primeira vez de cada uma.

### Quarto corte — a engine deixou de vir inteira

Medindo rota a rota apareceu um número que não fazia sentido:
`/multiplayer` e `/conta` carregavam **62 KB de catálogo de itens e
monstros**. As duas telas importam exatamente uma coisa da engine —
`PET_ICONS`, um mapa de id de pet pra emoji.

A causa era o empacotamento: `tsup` juntava `packages/shared` inteiro num
`dist/index.js`, e a granularidade do corte de um bundler é o **módulo**.
Com um módulo só, não há por onde cortar. Marcar `"sideEffects": false`
no `package.json` não resolveu sozinho — foi medido, não mudou um byte.

O que resolveu foi `bundle: false` no `tsup.config.ts`: um arquivo de
saída por arquivo de origem. A fonte já usava import com extensão
explícita (`./pets.js`), que é o que esse modo exige.

| Rota | Antes | Depois |
|---|---|---|
| `/conta` | 516 KB | **456 KB** |
| `/multiplayer` | 519 KB | **459 KB** |
| `/personagens/novo` | 510 KB | **474 KB** |
| `/jogo` | 580 KB | 584 KB |

`/jogo` subiu 4 KB — ele usa a engine quase toda, então perdeu o pouco
que o empacotamento economizava e não ganhou nada em troca. Vale os
60 KB das outras.

O `.cjs` que o Nest consome também virou um arquivo por módulo. Conferido
à mão (`require('./dist/index.cjs')` e `import('./dist/index.js')` fora
do build), e os testes da API resolvem `@rpg-legend/shared` pelo pacote
construído, não pela fonte — os 357 continuam passando.

### Quinto corte — fonte é peso que ninguém mede

Depois que o JavaScript parou de render, o maior arquivo no caminho
crítico não era JavaScript: **eram 149 KB de fonte**, baixados antes de
qualquer texto aparecer, em toda rota.

`next/font/google` gera um arquivo por peso e por estilo, e **pré-carrega
os que o layout declara — em toda rota, mesmo que só uma tela use**. O
`layout.tsx` pedia nove faces; o CSS seleciona seis.

O que estava sendo carregado à toa:

- **Itálico do EB Garamond (48 KB, o maior arquivo pré-carregado de
  todos).** Existe um único `font-style: italic` no projeto, num
  `.placeholder` da criação de personagem. Navegador inclina o normal
  sozinho quando não há itálico de verdade.
- **Cinzel 900.** Nenhuma regra pede peso 800 ou mais.
- **JetBrains Mono 600.** O único `font-weight: 600` do projeto é o
  `.botao`, e nenhum texto monoespaçado mora dentro de um.

| | Antes | Depois |
|---|---|---|
| baixado antes do primeiro texto | 149 KB | **91 KB** |
| total de fonte gerado | 593 KB | **336 KB** |
| arquivos | 22 | 15 |

Vale mais que a maioria dos cortes de JS desta fase, e some do relatório
do `next build`, que só conta JavaScript. **Ao acrescentar peso ou estilo
no `layout.tsx`, conferir se o CSS realmente seleciona aquilo.**

### O piso é o Next, não o jogo

**427 KB são compartilhados por todas as rotas** e não são nossos: é o
`react-dom` (223 KB) mais o runtime do App Router. O código próprio de
cada rota hoje vai de 14 KB (`/`) a 157 KB (`/jogo`, que é o jogo
inteiro). Continuar cortando do nosso lado tem pouco a render — o que
sobrou de grande é framework.

### `pnpm lint` — de 1045 problemas a zero

`pnpm lint` na raiz nunca tinha passado: `apps/api` acusava 898 erros de
formatação e 147 de regra. Dívida da fase 2, não da 6 — os arquivos
apontados não mudavam desde então, e o `eslint.config` é o do scaffold do
Nest, intocado desde a fase 0. Agora passa limpo, sem nenhum aviso.

**Primeiro, os 898 de formatação.** O prettier estava no padrão de 80
colunas, e a API inteira foi escrita em ~150 — a mesma largura de
`apps/web` e `packages/shared`. Reformatar pra 80 seria 4 mil linhas de
diff e deixaria a API diferente dos outros dois pacotes; declarar
`printWidth: 150` (a largura real) reduziu tudo a 24 arquivos e 120
linhas. Isso também desarma a armadilha do `--fix`: o script de lint da
API é `eslint ... --fix`, e com a configuração batendo com o código ele
não tem mais nada pra reescrever.

**Depois, os 147 de regra.** O que cada grupo era, e o que virou:

| Regra | Quantos | O que era, e o conserto |
|---|---|---|
| `no-base-to-string` | 46 | `String(body.campo ?? '')` em todo corpo de requisição e pacote de socket. Virou `comoTexto()` (`common/texto.ts`) — ver abaixo, era buraco de verdade |
| `require-await` | 36 | fakes de teste com `async` sem `await`. Viraram métodos síncronos devolvendo `Promise.resolve` |
| `no-unsafe-*` | 57 | quase tudo `app.getHttpServer()`, que o Nest declara `any`, e o `body` do supertest. Viraram `servidorDe(app)` (`testing/servidor.ts`) e `corpo<T>(resposta)` |
| resto | 8 | `Promise<unknown \| null>` redundante, `JSON.parse` sem `as T`, `new Array(20)` que nasce `any[]`, `bootstrap()` sem `.catch` no `main.ts` |

**O `no-base-to-string` escondia um buraco real.** `String({})` devolve
`'[object Object]'`, com 15 caracteres, todos válidos: um POST com
`{"username": {}}` criava a conta `[object Object]` em vez de cair na
validação. `{"room": ['A','B']}` virava a sala `A,B`; `{"room": []}`, a
sala `""`. `comoTexto()` deixa passar só primitivo — o resto vira o
padrão e a validação de sempre recusa.

Foi o que o `isUniqueViolation` já tinha mostrado na fase 2: aviso de
ferramenta que ninguém olha às vezes é bug esperando.

### Redis — rate limit e presença (2026-08-17)

Decidido com o dono do projeto: **entra agora, e só estas duas peças.**
Salas ficam de fora — mover o relay depende do adaptador Redis do
socket.io e de um Redis de verdade pra verificar, e nada disso está
resolvido.

**O acordo é o mesmo do `DATABASE_URL`: sem `REDIS_URL`, o app sobe e se
comporta exatamente como antes**, com o estado no processo. Não existe
"modo cluster" que só é exercitado em produção — as duas versões saem da
mesma interface, e o caminho sem Redis é o caminho de sempre.

O que estava errado com uma instância só, e por que:

| Peça | Com duas instâncias, antes | Agora |
|---|---|---|
| tentativas por IP | 12 por minuto **por instância** — o teto virava 24, 36… | `INCR` + `PEXPIRE` numa chave só |
| quem está online | amigo conectado na instância B aparecia offline pra quem estava na A | cada instância publica o conjunto dela; quem lê junta as vivas |
| aviso de mensagem | e, pior, **não chegava**: presença que mente é pior que presença nenhuma | publicação num canal; a instância dona do socket entrega |

Três decisões que ficam ditas porque não se leem no código:

- **Presença expira sozinha.** Cada instância publica o *seu* conjunto
  (`rpg:online:<instância>`) com prazo renovado por batimento, em vez de
  um conjunto global com contagem de referências. Instância que morre
  para de renovar e some; com contagem, um processo derrubado deixaria
  gente "online" pra sempre.
- **Redis fora do ar não fecha o portão.** Se o `INCR` falhar, a
  requisição passa. Derrubar cadastro e login porque o cache caiu é pior
  do que perder o teto por alguns segundos — o teto existe contra força
  bruta, não contra indisponibilidade.
- **A presença virou pergunta em lote** (`onlineAmong(ids)`). A lista de
  amigos pergunta por todo mundo de uma vez; uma pergunta por amigo seria
  uma ida e volta por amigo.

O limite de socket (30 mensagens por segundo por conexão) **continua em
memória de propósito**: a conexão vive numa instância só, então contar
fora dela não mudaria nada.

**O que os testes não provam.** `RedisDeMentira` é um fake em memória com
a semântica que este código usa — expiração preguiçosa, conjunto, canal.
Prova a lógica (janela fixa, instância morta sumindo, publicador não
entregando duas vezes pra si mesmo) e **não prova nada sobre Redis de
verdade**: reconexão, partição, `PEXPIRE` real. Aqui não há a sorte do
PGlite, que é Postgres de verdade. Antes de confiar nisso em produção,
rodar contra um Redis real.

### O que ainda falta na fase 6

- **Salas no Redis.** `RoomRegistry` guarda estado e conexões no
  processo, então dois jogadores em instâncias diferentes não entram na
  mesma sala. Precisa do adaptador Redis do socket.io e de um Redis de
  verdade pra verificar.
- **O estado inteiro viaja a cada ação no co-op.** A foto saiu, que era o
  pedaço grande, mas o mapa continua indo por completo a cada passo. Só
  vale mexer junto das salas: o formato do que trafega e onde a sala mora
  são a mesma decisão.
- **A foto ainda mora no Postgres como base64.** Não sai mais de lá numa
  lista, mas guardar imagem em coluna de texto é remendo — o lugar dela é
  o Supabase Storage, que é a fase 5.

---

## Travado esperando você

| O quê | Pra quê | Sem isso |
|---|---|---|
| `RESEND_API_KEY` + `EMAIL_FROM` | confirmar e-mail e reset de senha | o fluxo inteiro funciona e grava o token, só não sai e-mail (o original se comporta igual) |
| `DATABASE_URL` de staging | rodar tudo contra banco real | PGlite cobre a maior parte, mas não pega diferença de versão/extensão do Neon |
| onde a API vai rodar | ligar `trust proxy`, apertar `ALLOWED_ORIGIN` | ver bug #7 |

**Regra que continua valendo:** nunca criar conta de teste no servidor de
produção pra depurar, e nunca apontar `drizzle-kit push`/`migrate` pro
banco de produção sem decisão explícita — as tabelas são criadas pelo
`init()` do servidor original e têm conta de gente de verdade.

---

## Contrato de rede do multiplayer (pra fase 3)

O front novo precisa falar isto. Papel 1 = quem criou a sala e conduz a
exploração; papel 2 = convidado.

**Cliente → servidor:** `auth`, `chat`, `room-invite`,
`room-invite-response`, `create`, `join`, `profile`, `welcome`, `state`,
`move-lock`, `ui-action`, `team-heal`, `boss-advance-request`.

**Servidor → cliente:** `authed`, `auth-error`, `chat-ack`, `chat-error`,
`room-invite`, `room-invite-sent`, `room-invite-error`,
`room-invite-response`, `created`, `hello`, `welcome`, `profile`,
`profile-accepted`, `state`, `authoritative`, `move-lock`, `ui-action`,
`team-heal`, `boss-advance`, `peer-left`, `error`.

Regras que o servidor impõe e o cliente não pode "burlar" só mudando a
tela: 30 mensagens por segundo por conexão; `move-lock` e `welcome` só do
papel 1; `boss-advance-request` só do papel 2 e só em andar múltiplo de 5
com o chefe já derrotado; nível/atributos/ouro/abates só crescem dentro de
um teto por submissão; posição/andar/mapa do convidado são descartados e
substituídos pelo estado do anfitrião.

---

## Variáveis de ambiente

| Variável | Padrão | Efeito |
|---|---|---|
| `DATABASE_URL` | — | sem ela o app **sobe normalmente**; rota que toca o banco responde 503 |
| `DATABASE_SSL` | ligado | só desliga com o literal `false` |
| `ADMIN_USERNAME` | `ADM` | conta que ganha cosméticos de ADM e modo GOD no multiplayer |
| `SAVE_SIGNING_SECRET` | cai pra `DATABASE_URL`, depois pra aleatório | **se cair no aleatório, assinatura de save não sobrevive a reinício** |
| `ALLOWED_ORIGIN` | `*` | CORS |
| `PUBLIC_GAME_URL` | `https://kingdark17.github.io/rpg-legend/` | monta o link dos e-mails; formato `?verify=` / `?reset=` é o que o cliente lê |
| `RESEND_API_KEY` / `EMAIL_FROM` | — | sem as duas, e-mail não sai (só avisa no log) |
| `REDIS_URL` | — | sem ela, tentativas por IP e presença ficam **no processo**, como antes: correto com uma instância, errado com duas |
| `PORT` | 3000 | — |

---

## Armadilhas

- **`rpg-legend/server/` neste repo é cópia velha.** O servidor real está
  em `github.com/Kingdark17/RPG-Legend-Server` e tem coisa que a cópia não
  tem. Nunca usar a cópia como referência.
- **Cache-busting do jogo legado:** editar `.js`/`.css` em `rpg-legend/`
  exige bumpar o `?v=` no `index.html` no mesmo commit. Vale também pro
  `src` das imagens em `items.js`.
- **Corpo de requisição:** o padrão do Express é 100 KB e não dá conta do
  save completo nem da foto de perfil em base64. Está em 700 KB, igual ao
  original.
- **Ícone de item fica gravado no save.** Trocar arte não muda item já
  salvo sem `RPG.Items.refreshIcon` no carregamento.
- **`next build` quebrando em fonte do Google:** o cache do Turbopack
  guarda a URL do `.woff2` que o `next/font/google` baixou, e o Google
  troca esse nome de arquivo de tempos em tempos. Quando isso acontece o
  build morre com `module-not-found` em `fonts.gstatic.com` **404** —
  aconteceu em 2026-08-14 com a JetBrains Mono, e de novo em 2026-08-16.
  Não é erro do código. Apagar só o `.next` **não basta** — parte do cache
  fica em `node_modules/.cache`. O que resolve é apagar os dois:
  `rm -rf apps/web/.next apps/web/node_modules/.cache`. Se acontecer na
  Vercel, é limpar o cache de build de lá.
