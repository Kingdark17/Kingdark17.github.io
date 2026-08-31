# Notas da migração — RPG Legend

Caderno de trabalho da migração pro monorepo. **O que entra aqui:** o que
descobri lendo o servidor real e não está óbvio no código — bugs do
original, desvios conscientes do porte, o que está travado esperando
credencial, armadilhas de deploy e o contrato de rede do multiplayer.

**O que NÃO entra:** decisão de arquitetura fechada (isso é `CLAUDE.md`) e
nada que o código ou o `git log` já contem sozinhos.

Última atualização: 2026-08-24.

---

## Estado por fase

| Fase | Situação |
|---|---|
| 0 — monorepo | pronta |
| 1 — engine em `packages/shared` | pronta (326 testes) |
| 2 — Nest ainda no Neon | porte **completo**, verificado contra Postgres real |
| 3 — front Next | **pronta**: conta, personagem, cidade, masmorra, combate, loja/ferreiro, NPCs, quadro de missões, eventos, mochila, level up manual, perfil/cosméticos, amigos e chat, guia, painel ADM, multiplayer co-op, trilha e efeitos sonoros, narração das salas |
| 4 — paperdoll | **começou em 2026-08-24**: 18 camadas de 64×64, boneco na criação, no seletor de personagem e no painel do herói durante a partida — os dois últimos com o equipamento de verdade. Em 2026-08-31 ganhou vida: respiração só do tronco, aura da raridade, tinta de veneno e piscada de dano, **tudo em CSS** (+3 KB, contra ~400 KB do Pixi — ver "Fase 4"). Faltam 4 raças (anão, orc, goblin, fada), 5 armas e 2 armaduras sem arte |
| 5 — **Neon → Supabase** | **concluída.** Banco criado em 2026-08-18 (Postgres 17.6, `sa-east-1`); **a virada aconteceu em 2026-08-25** e o Supabase passou a ser produção. Em 2026-08-27 a conferência mostrou destino ≥ origem nas sete tabelas e **o projeto do Neon foi apagado** — ele havia deixado de ser rollback: voltar custaria os dados criados depois da virada. Ver "Fase 5" e "O copiador da virada" |
| 6 — otimização | **em andamento** — JS e fonte cortados e medidos, save inteiro fora do JSON, teto por IP e presença no Redis, salas no Redis (sobrevivem a deploy e a hibernação), foto de perfil fora do banco e no Supabase Storage, `pnpm lint` verde. **A compressão do socket foi refeita por dentro da mensagem em 2026-08-30**, porque o proxy nunca deixou a do WebSocket passar — ver "A compressão que o proxy não vê" |

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

### A camada sensorial ficou pra trás na fase 3 (corrigido em 2026-08-17)

Estas notas diziam "fase 3 pronta" com uma lista de telas — e a lista não
mencionava som nenhum, porque **três módulos do cliente antigo nunca
foram portados**. Ninguém percebeu porque nada disso aparece em teste e
nada quebra quando falta: o jogo simplesmente ficou mudo e sem descrever
as salas.

| Módulo antigo | Linhas | Foi pra onde |
|---|---|---|
| `js/effects.js` | 80 | `lib/som/efeitos.ts` (som) + CSS e React (número flutuante, tremida, piscada de nível) |
| `js/narrator.js` | 70 | `lib/jogo/narrador.ts` |
| `js/music.js` | 45 | `lib/som/musica.ts` |

**Custo medido em `/jogo`: 584 KB → 593 KB.** A música entra por
`import()` porque não toca antes do primeiro gesto do jogador.

Quatro decisões que valem ficar ditas:

- **Um `AudioContext`, não dois.** `effects.js` e `music.js` abriam cada
  um o seu, com volume e estado de suspensão separados — dava pra
  destravar a música no primeiro clique e os efeitos continuarem mudos.
  Agora tudo passa por um ganho mestre só, e por isso **o controle de
  volume também vale pros efeitos**; no original ele só mexia na música.
- **Volume e liga/desliga saíram do save.** Ver `lib/som/preferencia.ts`:
  eram campos do progresso, e o `soundOn` ainda viajava no relay do
  co-op, sincronizando o botão de som de um jogador com o do outro. É
  preferência do aparelho, e o save novo é assinado e conferido contra
  trapaça — pagar validação por um controle de volume seria caro pelo
  motivo errado.
- **A frase de ambiente da sala é derivada, não guardada.** O original
  sorteava e gravava em `cell.ambientLine` pra a sala não trocar de cara
  entre visitas. Aqui ela sai da posição da sala pelo `seededRng`: mesmo
  efeito, sem campo novo dentro do save nem no que trafega no co-op — e
  os dois jogadores leem a mesma frase de graça.
- **Som e números flutuantes são decididos em `lib/jogo/combate.ts`,** ao
  lado do `dado`, não na tela. É lá que se sabe se o golpe foi crítico;
  deduzir isso do log seria ler texto pra descobrir o que a regra já
  sabia. Isso traz junto uma armadilha, e ela tem teste: como todo turno
  é `{ ...combate }`, **toda ação precisa definir o seu `som`** — senão
  um golpe repete o "crítico" do anterior sem aparecer no log.

**Um defeito do original que não portei:** `js/pets.js:49` chama
`playSfx('heal')`, e `heal` não existe na tabela de efeitos do
`effects.js` — o som de fazer carinho no bichinho nunca tocou. Não
inventei um: é design de som, não conserto de código. Fica anotado pra
você decidir.

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

## Fase 4 — paperdoll (começou em 2026-08-24)

### O PixiJS não entrou, e a decisão foi consciente

A tabela de decisões da migração fixa PixiJS pro personagem 2D. Continua
valendo **pro boneco que se mexe**. A prévia da criação de personagem, que é
o que existe hoje, é um empilhamento parado de até cinco imagens de 64×64 —
Pixi custaria ~400 KB de JavaScript pra fazer o que `position:absolute` já
faz, e `image-rendering:pixelated` sai mais fiel que reamostragem de
textura. Quando o boneco precisar animar ou receber filtro, o Pixi entra e
substitui `app/componentes/paperdoll.tsx`.

### O nome do arquivo é o id do catálogo

`corpo/humano.png`, `corpo/elfo_negro.png`, `arma/espada.png` — os nomes são
**exatamente** os ids de `RACES[].id` e `CLASSES[].weaponTemplate`. Sem
tabela de tradução no meio, não há como as duas listas divergirem em
silêncio. Ao acrescentar arte, o nome sai do catálogo, não do gosto de quem
desenhou: os arquivos chegaram como `nigga_elf_body.png`, `calca-base.png`
(que desenha calça, mas o irmão `cat_add__body.png` não desenha corpo
nenhum, e sim orelhas) e foram todos rebatizados na entrada.

### A ausência de arte é dado, não acidente

`lib/paperdoll/camadas.ts` lista à mão o que existe. O navegador não enxerga
o disco: pedir `corpo/anao.png` sem saber se existe rende 404 e um quadrado
quebrado. A tela pergunta antes de desenhar, e a legenda embaixo do boneco
diz **qual** peça falta em vez de deixar o jogador achando que quebrou.

Faltam 6 das 12 raças (anão, orc, draconato, goblin, fada, celestial) e 6
das 8 armas do catálogo (adaga, maça, machado, arco, marreta, violão).

**Este parágrafo dizia "4 das 6 armas iniciais" até 26/08/2026, e errava
duas vezes.** As armas iniciais de classe são **sete**, não seis — o
`violão` é uma delas e ficava de fora da conta. E o `camadas.ts` não
filtra por arma inicial: ele pergunta pelo que o herói tem **equipado**,
que pode ser qualquer uma das oito do catálogo, `marreta` inclusive. A
conta que importa pro trabalho é a de oito.

### O resumo do personagem cresceu, e a régua não é a contagem de campos

`/personagens` recebia só `raceIcon` — um emoji — e nenhum equipamento, e a
projeção SQL em `drizzle-save-repository.ts` existe pra o save inteiro nunca
atravessar a rede. Pôr o boneco no seletor exigiu alargá-la: `race`,
`raceId` e o `templateId` dos três slots de equipamento.

**O que o teste de integração protege continua de pé** — mapa, inventário,
ouro e até o `uid` do item seguem morrendo dentro do Postgres, e o teste
passou a afirmar isso também. A régua pra acrescentar campo aqui é essa, não
"quantos campos já tem": texto curto que o card desenha, sim; estrutura que
o card não lê, não.

`equip` mantém o formato aninhado do save (`{arma: {templateId}}`, e não
`{arma: 'espada'}`) porque é o que sustenta a regra do arquivo: o `data` que
chega tem a mesma forma do save, então `heroFieldsOf` continua sendo o único
lugar que lê esses campos.

No front os campos novos são **opcionais**. Vercel e Render sobem separados,
e um front novo contra uma API velha recebe `undefined` — o card cai no
emoji da raça em vez de quebrar. É a regra de sempre: quando o contrato muda
dos dois lados, o lado tolerante vai primeiro.

### Na criação o boneco mostra a classe; na partida, o equipamento

São dois casos diferentes de propósito. Em `/personagens/novo` ainda não há
personagem, então a arma vem de `CLASSES[].weaponTemplate` — a inicial da
classe. No painel do herói o boneco lê `hero.equip.arma`, `.armadura` e
`.secundaria`: trocar de espada na mochila muda o que aparece.

**O herói grava `race` como nome ("Elfo Negro"), não como id.** O paperdoll
chaveia por id, então quem resolve é `idDaRaca()` da engine, que prefere
`raceId` e cai no nome pros saves antigos que ainda não têm o campo. Ler
`hero.race` direto funcionaria hoje e quebraria no dia em que os nomes forem
traduzidos.

### Sair da partida grava antes, e não sai se a gravação falhar

O autosave é adiado 2,5 s depois do último passo. Sair logo depois de andar
perderia essa jogada em silêncio, então o botão força a gravação pendente
antes de navegar. Por isso `salvar()` passou a devolver se gravou: navegar
depois de uma falha jogaria o progresso fora sem ninguém ver.

Em co-op não há o que gravar — a sessão nunca é gravada, por decisão —, mas
há sala pra desfazer: sem `sairDaSala()` o parceiro ficaria esperando alguém
que já foi embora.

### `felino` e `morto_vivo` não recebem cabelo

O corpo dos dois já resolve a cabeça — orelhas e pelo num, caveira no outro.
Cabelo humano por cima fica grotesco, então `SEM_CABELO` em `camadas.ts` os
exclui. É a única regra de composição que não sai direto do catálogo.

### `gif.mjs`: mais um codec na mão

A arte do pet slime veio em GIF animado de 17 quadros. Não há ImageMagick
nem ffmpeg nesta máquina — e `convert` no PATH do Windows é o utilitário de
disco (FAT→NTFS), não o do ImageMagick. `apps/api/scripts/gif.mjs` decodifica
GIF sem dependência, pelo mesmo motivo que `png.mjs` existe.

Ele compõe o descarte (`disposal`) antes de devolver o quadro: quadro de GIF
quase nunca é a imagem inteira, é um retângulo colado por cima do anterior,
e quem grava o quadro cru acaba com sprite pela metade.

**A grama do slime não sai.** O corpo e a grama dividem a mesma rampa de
verde (só 3 cores são exclusivas do cenário, e são as florzinhas), e não há
faixa vazia pra cortar na horizontal porque as flores estão espalhadas entre
o slime e o chão. Instalado com a base, ao contrário do dragão. Tirar exige
redesenhar o sprite.

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

### Sexto corte — a tela de personagens lia os saves inteiros

`GET /api/characters` desenha um card por slot com seis campos: nome,
ícone de raça, classe, ícone de classe, nível e andar. Pra montar isso ele
puxava **o save completo dos quatro slots** do Postgres — herói,
inventário, missões, party e o mapa do andar — e jogava fora tudo menos os
seis campos, no processo.

Medido com um save de verdade da engine (`montarSaveInicial` →
`entrarNaCidade` → `entrarNaMasmorra`):

| | Tamanho |
|---|---|
| save recém-criado | 1,0 KB |
| na cidade | 5,6 KB |
| na masmorra | 6,4 KB |
| **o resumo que a tela usa** | **0,1 KB** |

São ~25 KB vindos do Neon, pela rede, a cada abertura da tela de
personagens, pra produzir 0,4 KB. Não é a ordem de grandeza da foto em
base64, mas é a mesma falha: o banco está do outro lado da rede e a
consulta pedia o que ninguém ia ler.

Agora o `jsonb_build_object` remonta no Postgres um objeto só com esses
campos. A escolha de devolver **a mesma forma** (`{hero: {...}, floor}`)
em vez de colunas soltas é o que mantém o `heroFieldsOf` do service como
único lugar que lê esses campos — uma segunda leitura, escrita em SQL,
seria uma que pode discordar da primeira. Aqui não dava pra usar a saída
do avatar (contrato frouxo, `md5` de um lado e JS do outro): estes valores
aparecem na tela, então precisam ser exatamente os mesmos.

`listSlots` virou `listHeads` e devolve `CharacterHeadRow`, tipo separado
de propósito — quem for mexer aí não reintroduz o save inteiro sem
perceber. O teste de integração guarda o lado SQL: grava um save com mapa
e ouro, e confere que nem um nem outro chegam.

### CSS não é problema (medido)

Só pra fechar a conta do caminho crítico, já que JavaScript e fonte foram
medidos: o CSS por rota vai de **9 KB** (`/`) a **17 KB**
(`/multiplayer`). Não há nada a cortar — CSS Modules já entrega só o que
a rota usa. Fica registrado pra ninguém gastar tempo aqui.

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
- **O estado inteiro viaja a cada ação no co-op.** ~~Só vale mexer junto
  das salas.~~ **Revisto em 2026-08-22:** com o código na frente, onde a
  sala *mora* e o que *trafega* são camadas separadas. Primeiro corte
  feito — ver "A mochila parou de viajar" abaixo. O mapa completo a cada
  passo continua de pé.
- **A foto ainda mora no Postgres como base64.** Não sai mais de lá numa
  lista, mas guardar imagem em coluna de texto é remendo — o lugar dela é
  o Supabase Storage, que é a fase 5.
- ~~**Nenhuma resposta da API sai comprimida.**~~ **Resolvido em
  2026-08-22:** a borda da Cloudflare, na frente do Render, já entrega tudo
  em Brotli. Não há nada a fazer — e fazer pioraria. Ver abaixo.

### A mochila parou de viajar pro parceiro (2026-08-22)

**Medido antes de mexer.** Montando o pacote de `instantaneoDaSala` a partir
de saves reais:

| Save | Mochila | Pacote inteiro |
|---|---|---|
| `save-mochila` (6 itens) | 808 B | 4.609 B |
| `save-tutorial` (76 itens) | **10.555 B** | **14.035 B** |
| `save-masmorra-2` (1 item) | 135 B | 4.358 B |

Com a mochila cheia, ela era **75% do pacote** — e esse pacote sai a cada
ação de jogo, nos dois sentidos.

**E ninguém do outro lado lê.** Varrido o front inteiro: o único leitor de
`inventory` num perfil de sala é `aplicarRemoto`, e ele usa
`perfis[meuPapel]` — o próprio. O cartão do parceiro mostra cosméticos,
nome, nível e classe. `party`, idem.

**A armadilha que decidiu o desenho.** O recorte tem que ser **por
destinatário**, não global. O front faz `meuPerfil.inventory ?? []`: um
perfil próprio chegando sem `inventory` não é "sem novidade", é
"esvaziou" — e isso voltaria no `state` seguinte como perda de verdade.
Cada jogador recebe o próprio perfil inteiro e o do parceiro enxuto.

Por isso nasceram `toPeerProfile`, `RoomRegistry.profilesForRole` e
`relayPorPapel` no gateway: um pacote só não serve pros dois.

**Ganho medido depois**, comparando os dois perfis inteiros contra próprio
inteiro + parceiro enxuto:

| Save | Antes | Depois | |
|---|---|---|---|
| `save-mochila` | 6.928 B | 6.096 B | −12% |
| `save-tutorial` | 25.780 B | 15.201 B | **−41%** |
| `save-masmorra-2` | 5.618 B | 5.459 B | −3% |

O corte escala com o tamanho da mochila, que é exatamente quando pesa.

### E depois parou de subir a cada ação (2026-08-23)

Continuação do corte acima, pelo outro lado: a mochila do **próprio**
jogador, que subia inteira a cada ação.

**O erro que eu ia cometer.** A ideia óbvia era o cliente parar de mandar e
o servidor continuar ecoando a que tem guardada. Isso **desfaria itens
catados**: sem receber atualização, a cópia do servidor envelhece, e o eco
faria o cliente adotar uma mochila antiga. Subir e descer estão amarrados —
não dá pra cortar um lado sozinho.

**O que dava pra cortar sem risco.** O cliente omite a mochila quando ela é
a mesma do último envio; o servidor entende ausência como "não mudou" e
mantém a que já aceitou. É **exatamente o acordo que o cosmético já
tinha** (`sanitizeProfile`), e pelo mesmo motivo. Andar, lutar e abrir
porta não mexem na mochila, então a maioria das ações passa a não carregá-la.

Medido na subida:

| Save | Mochila mudou | Não mudou | |
|---|---|---|---|
| `save-mochila` (6 itens) | 4.664 B | 3.843 B | −18% |
| `save-tutorial` (76 itens) | 14.090 B | 3.522 B | **−75%** |
| `save-masmorra-2` (1 item) | 4.413 B | 4.265 B | −3% |

**Vazio é diferente de ausente.** `[]` é array e esvazia de verdade —
vender tudo é jogada legítima. Só o que não é array conta como "sem
novidade". Tem teste pros dois.

**A comparação é por referência**, e vale porque a engine troca o array ao
mudar e devolve o mesmo quando não muda (`mochila.ts`). Errar pro lado de
enviar demais custa banda; errar pro outro custa a mochila do jogador.

**A rede de segurança da reconexão.** Conexão caída apaga o que o servidor
sabia da sala. `tela-jogo.tsx` zera a referência quando a fase vira
`desligado`, obrigando a próxima sincronização a levar a mochila inteira —
sem isso, o servidor voltaria sem mochila e o eco esvaziaria a do jogador.

### Regra de ordem: quem tolera sobe primeiro

Este corte mexeu nos dois lados, e front e API publicam **separado** — o
mesmo push dispara Vercel e Render, que terminam quando terminam.

Se o front tivesse chegado primeiro, ele omitiria a mochila e a API velha
leria ausência como "esvaziou": o eco voltaria vazio e apagaria a mochila
de quem estivesse jogando. Deu certo por sorte, não por desenho — o Render
terminou antes.

**A regra que fica:** quando cliente e servidor mudam de acordo juntos,
sobe primeiro o lado que **tolera os dois formatos**. Aqui era a API, que
aceita o pacote com e sem mochila. Se só um dos lados puder ir primeiro e
não houver lado tolerante, o jeito é dividir em dois deploys: primeiro
ensinar o servidor a aceitar o formato novo, depois passar o cliente a
usá-lo.

Provado na API publicada com `scratchpad/prova-mochila.mjs`, que cria uma
sala efêmera, manda perfil com mochila e depois um `state` sem — e confere
que o eco manteve. Não cria conta e não escreve no banco.

### O corte inteiro, que ficou de fora de propósito

Tirar a mochila do contrato do co-op nos dois sentidos valeria −62% por
ação em vez dos ganhos acima. **Não foi feito** porque `js/multiplayer.js`
faz `s.inventory = own.inventory || []`: o jogo antigo esvaziaria a mochila
de todo mundo se algum dia apontasse pra esta API — que é o caminho de
migração mais seguro, trocar o servidor antes do cliente. O corte de hoje e
o de ontem **não** afetam o cliente antigo: ele lê só o próprio perfil no
`applyState`, e o `renderRemote` desenha `RPG.state`, não o do parceiro.

Se o jogo antigo for aposentado sem nunca falar com esta API, o corte
inteiro volta à mesa.

### Compressão das respostas — RESOLVIDO em 2026-08-22: não fazer nada

A decisão dependia de onde a API ia rodar. Ela roda no Render, e o Render
fica atrás da Cloudflare. Medido em produção, pedindo `Accept-Encoding:
gzip, br, zstd`:

| Rota | Cru | Resposta |
|---|---|---|
| `/health` | 116 B | `Content-Encoding: br`, 85 B |
| `/api/account/status` | 36 B | `br` |
| `/api/rooms` | 12 B | `br` |

A borda comprime com Brotli **inclusive respostas minúsculas**. Ligar o
`compression` do Express pioraria: o Node gastaria CPU aplicando gzip, e a
Cloudflare repassaria isso em vez de aplicar Brotli, que comprime melhor.
Trocaríamos CPU por uma compressão pior.

**Só reabrir se a API sair do Render** — num container cru ninguém comprime,
e aí a dependência passa a valer. O texto abaixo é o raciocínio original,
mantido porque é o que torna essa reabertura possível sem refazer a análise.

### Compressão das respostas — o raciocínio original

`configureApp` não liga compressão nenhuma. Todo JSON sai cru: o save de
~6 KB a cada `GET /api/save` e a cada autosave, mais `/api/friends` e as
conversas. JSON comprime muito bem — costuma cair pra menos de um quinto.

**Não fiz porque a resposta depende de onde a API vai rodar**, que é a
mesma pendência do `trust proxy`:

- Se ela ficar atrás de um proxy que já comprime na borda (Vercel,
  Cloudflare, Render), o `compression` do Express seria trabalho repetido
  — gasta CPU do Node pra um ganho que já existe.
- Se for um container cru (Fly, VPS, Railway sem proxy), ninguém comprime
  e vale a pena: uma dependência (`compression`) e uma linha no
  `configureApp`.

Não dá pra escolher sozinho sem saber o destino, e chutar aqui é escolher
gastar CPU à toa ou deixar banda na mesa.

---

## Trocar o idioma do jogo — o que estava no caminho

Você pediu isso em 2026-08-18. **Não havia rastro no repo**: nenhum dos
167 commits, nem o `CLAUDE.md`, nem estas notas, nem o cliente antigo
tinham qualquer sinal de idioma, tradução ou seletor. Está registrado
agora.

### O texto não era o problema. As regras eram.

Antes de traduzir uma palavra, uma coisa precisava mudar: **as regras do
jogo consultavam o texto em português**.

| Onde | O que fazia |
|---|---|
| `combat/party.ts` | onze comparações `member.className === 'Clérigo'`, `'Mago'`, `'Bárbaro'`… |
| `combat/resolve-attack.ts` | `'Mago'`, `'Bárbaro'`, `'Arqueiro'` |
| `combat/monster-hit.ts` | `'Guerreiro'`, duas vezes |
| `combat/damage.ts` | `classByName(hero.className)` decidia afinidade de arma |
| `hero/catalog.ts` | `CLASS_PASSIVES` chaveado pelo nome |
| `hero/hero.ts` | `COMPANION_ROLES` chaveado pelo nome; poderes resolvidos por `powerByName` |

Renomear `Mago` para `Mage` teria mudado dano, desligado a cura do
clérigo, sumido com a passiva do guerreiro e **tirado todos os poderes do
herói** — sem erro nenhum, porque toda busca por nome termina em `?? null`
ou num `.filter()`. O rastro disso já estava visível: alguém tinha
escrito `'Clérigo' || 'Clerigo'` e `'Bárbaro' || 'Barbaro'` quando um
acento sumiu de um save.

Itens e monstros já faziam certo (`templateId`, `speciesId`): identidade
por id, nome montado na hora de mostrar. Classe, raça e poder não.

### O que mudou

Classe, raça e poder já tinham `id` no catálogo — o save é que guardava só
o nome. Agora:

- **As regras só olham id.** `idDaClasse`/`idDaRaca` resolvem quem chega
  sem ele, e são o **único** lugar onde a compatibilidade com save antigo
  mora.
- `ClassDef.signature` (nome do poder) virou `signatureId`.
- `Hero` e `Companion` ganharam `classId`, `raceId`, `powerIds` —
  opcionais, porque os saves que já estão na nuvem não têm.
- `hydrateSavedHero` preenche os ids a partir dos nomes gravados, **uma
  vez, na entrada do save** (`retomarSave`). Não fica em `comuns()` de
  propósito: aquilo também roda em transição de dentro do jogo
  (`voltarParaCidade`), e refazer o herói a cada saída de masmorra não é
  normalizar, é mexer no que já estava certo — o teste da derrota pegou
  isso.
- `powerNames` passou a ser **regenerado do catálogo** no carregamento, em
  vez de copiado do save. É o que faz o nome mostrado acompanhar o idioma
  em vez de ficar congelado no que foi gravado.

Nada disso mexe na validação anti-trapaça: `isValidSave` só exige
`hero.name`/`attrs`/`equip`, e `isValidTransition` olha nível, ouro,
andar, inventário e atributos.

**Uma armadilha que o teste do bárbaro revelou:** onde os dois campos
existem, o id ganha. Um fixture que trocava só o `className` continuava
com o `classId` da classe sorteada, e a passiva testada nunca disparava —
o teste passou a medir outra coisa sem falhar. Vale pra qualquer código
que construa herói ou companheiro: **mudar o nome sem mudar o id não muda
nada.**

### O que falta pra trocar de idioma de fato

O caminho está aberto, mas o texto ainda está escrito dentro do código.
Falta decidir e fazer:

1. **Onde mora o catálogo de textos.** A engine não pode importar React
   nem DOM, e o servidor valida jogada com ela — então o texto pode ser
   dado dentro de `packages/shared`, mas não pode virar dependência de
   framework.
2. **Trocar ou acrescentar.** "Trocar" (o jogo passa a ser em inglês) e
   "acrescentar" (seletor pt/en) dão trabalhos diferentes: o segundo
   precisa de preferência guardada e de tudo em duas línguas.
3. **O que fica de fora.** Nome de item, monstro e sala já sai do
   catálogo por id, então acompanha. Nome de herói e mensagem de chat são
   do jogador — esses nunca se traduzem.

---

## Fase 5 — Neon → Supabase

Decidido por você em 2026-08-17. O que já está feito não precisa de
credencial nenhuma; o que falta precisa de duas decisões suas (no fim
desta seção).

### A conexão é a parte fácil, e é fácil mesmo

Não há nada de Neon no código: `pg` puro com `drizzle-orm/node-postgres`
lendo `DATABASE_URL` em `db/client.ts`, sem `@neondatabase/*`. Supabase é
Postgres. Trocar a variável basta.

Um detalhe que depende de onde a API vai rodar: o Supabase dá três
endereços (direto na 5432, session pooler, transaction pooler na 6543) e
**o direto é só IPv6** sem o add-on de IPv4. Com `pg.Pool` num processo de
vida longa, o direto é o certo — se a rede do host alcançar.

### O schema agora tem base versionada, e ela é a mesma da produção

Antes não existia migração nenhuma: `apps/api/drizzle/` estava vazia e o
banco de produção nasceu do `init()` do servidor antigo. Agora
`pnpm db:generate` produziu `0000_*.sql`, e
`db/schema-vs-original.integration.spec.ts` sobe **dois Postgres de
verdade** — um do DDL original, outro da migração — e compara coluna a
coluna, índice a índice, chave a chave.

Isso importa porque um banco novo no Supabase nasce da migração e a
produção nasceu do DDL. Divergência entre os dois não falharia em teste
nenhum (os testes rodam sobre o DDL): o jogo simplesmente se comportaria
diferente no banco novo.

**A comparação achou uma diferença que ninguém veria de olho:** o
`.desc()` do Drizzle gera `DESC NULLS LAST`, e `DESC` puro no Postgres é
`NULLS FIRST`. Índice com ordem de nulos diferente da consulta **não é
usado pra ordenar** — o banco cria o índice, não reclama, e ordena na mão.
Apareceria só como lentidão em produção, no histórico de saves e na busca
de conversa. Corrigido no `schema.ts` com `.nullsFirst()`.

Junto disso, o `schema.ts` passou a declarar os mesmos nomes que a
produção usa (`users_username_key`, `cloud_saves_pkey`,
`friendships_pkey`, `friend_requests_from_id_to_id_key`). Não é preciosismo:
com nomes diferentes, um `drizzle-kit generate` rodado contra um banco
restaurado da produção proporia derrubar e recriar cada constraint.

Nome de chave estrangeira ficou de fora dessa convergência de propósito —
o teste compara **para onde a chave aponta e o `ON DELETE`**, não o nome.
Postgres batiza de `sessions_user_id_fkey`, Drizzle de
`sessions_user_id_users_id_fk`, e nenhum código lê isso
(`isUniqueViolation` olha só o SQLSTATE).

### A porta que o Supabase abre sozinha

`0001_fecha_acesso_publico_supabase.sql`. O Supabase publica um PostgREST
em cima do schema `public`, e a chave `anon` é pública por natureza — ela
vai no navegador. **Com as tabelas em `public` e sem RLS, qualquer pessoa
com essa chave lê a tabela `users` inteira**: e-mail, hash e salt de
senha. No Neon isso não existe porque não há API HTTP na frente do banco,
e é a diferença mais importante entre os dois — ela não aparece quando
você troca a string de conexão e vê que funciona.

Nada no jogo fala com o PostgREST, então a migração fecha a porta em vez
de usá-la: RLS ligado sem policy nenhuma, e `REVOKE` de `anon` e
`authenticated`. A API se conecta como dona das tabelas, e dona ignora
RLS (não usamos `FORCE`) — nada muda pro jogo.

É migração e não passo manual justamente porque passo manual se esquece.
Roda dentro de um `DO` que só age se o papel `anon` existir, então em
PGlite, Neon ou Postgres local é um nada-a-fazer — o que o teste de
comparação de schema comprova, porque aplica esse arquivo também.

### Rodado em 2026-08-18 — e o que apareceu no caminho

Escolha feita: **banco novo e vazio**, só pro ambiente novo. O jogo no ar
continua no Neon e nenhuma conta real se moveu.

O `pnpm db:migrate` aplicou as três migrações contra o Supabase
(`sa-east-1`). Conferido no banco de verdade, não no "applied
successfully": 7 tabelas, 9 FKs com `ON DELETE CASCADE`, os índices, RLS
ligado, e o app escrevendo e lendo pelo `schema.ts` real (defaults,
`jsonb` ida e volta, `Date`, cascade). Repetir o comando não muda nada.

**A `0001` não bastava.** Ela revoga o acesso de `anon`/`authenticated`
tabela por tabela, pelo nome — o que protege as sete de hoje e mais nada.
O Supabase deixa um `ALTER DEFAULT PRIVILEGES` do papel `postgres` dando
`arwdDxtm` a `anon` em **toda tabela nova** do schema `public`. Não foi
deduzido: uma tabela criada no banco nascia legível **e gravável** pela
chave pública. A `0002` muda o padrão, em vez de depender de alguém
lembrar de revogar a cada migração futura.

**Isto só dá pra testar contra um Supabase real** — no PGlite dos testes
não existe papel `anon`. Daí os scripts em `apps/api/scripts/`, com
`pnpm --filter api db:audit` sendo o que precisa rodar depois de qualquer
migração que crie tabela. Ele não pergunta ao Postgres se o privilégio
foi revogado: vira o papel `anon` e tenta ler e-mail e hash de `users`.

**O drizzle-kit carrega o `.env` sozinho.** Descoberto aqui: com um
`apps/api/.env` presente, `db:migrate` e `db:push` vão nele sem ninguém
exportar variável nenhuma. Variável já exportada no ambiente ganha do
arquivo. O `drizzle.config.ts` passou a imprimir o host de destino antes
de agir, porque "eu achei que estava no banco de teste" precisa ser
perceptível **antes**.

### O que ficou de fora, de propósito

**A foto de perfil continua base64 numa coluna de texto.** Já não sai de
lá numa lista (ver "Segundo corte"), mas o lugar dela é o Supabase
Storage. Ficou pra etapa própria — e agora está **destravada**, porque o
projeto no Supabase existe. Só passa a valer de fato quando a API nova
subir.

**A regra de sempre continua:** nunca apontar `drizzle-kit push`/`migrate`
pro banco de produção sem decisão explícita.

---

## O copiador da virada (2026-08-24)

A fase 5 criou o ambiente. **A virada — mover as contas reais e apontar o
jogo pra cá — continua sem data e sem decisão.** O que existe agora é a
peça que qualquer versão dela precisa: o copiador, com ensaio e
conferência, exercitado contra dois Postgres de verdade.

`pnpm --filter api db:copia`, com a lógica em `src/db/migracao/copia.ts`.

### Três armadilhas, e por que cada uma está no código

**A sequence não anda sozinha.** Inserir linha com `id` explícito não move
a sequence do `bigserial`. O banco novo entregaria `id = 1` no próximo
cadastro e colidiria com o usuário 1 recém-copiado. Isso **não aparece na
cópia** — aparece no primeiro jogador que criar conta depois da virada, e
aí o estrago já está feito. Daí `corrigirSequences` não ser opcional, e o
teste que prova isso ser o mais importante do arquivo: ele insere um
usuário no destino e exige que o id seja 4, não 1.

**Coluna a menos no destino é perda silenciosa.** A produção nasceu do
`init()` do servidor antigo, o Supabase nasceu das migrações do drizzle.
`conferirSchemas` compara as duas pontas e **recusa** a cópia se faltar
coluna no destino — copiar assim jogaria dado fora sem erro nenhum. Coluna
sobrando no destino é aceita de propósito: nasce com o default.

**`jsonb` que começa com array vira array do Postgres.** O `pg` converte
`Array` de JS pra literal de array, não pra JSON. Toda coluna `json`/`jsonb`
sai daqui como texto com `::jsonb` explícito, e a semente do teste tem um
`cloud_save_history.data` que é array no topo justamente pra provar isso.

### Dois modos, e escolher errado é o erro fácil

`inserir` (padrão) só acrescenta o que falta e nunca sobrescreve. `espelhar`
(`--espelhar`) deixa o destino idêntico à origem: acrescenta, atualiza o que
mudou e **apaga o que sumiu**.

**A armadilha:** `ON CONFLICT DO NOTHING` pula a linha que já existe — e
`cloud_saves` é a mesma chave `(user_id, slot)` com `data` novo a cada save.
Rodar `inserir` de novo pra "pegar o atraso" **não traz alteração nenhuma**.
Isso não é detalhe de implementação: é a diferença entre uma cópia quente
que termina certa e uma que entrega save velho pra todo mundo.

Escrito como teste, não como aviso: um caso altera um save na origem, roda
`inserir`, e **exige** que o destino continue com o valor antigo.

Consequência prática: cópia quente termina em `espelhar` depois de congelar
a escrita, nunca num segundo `inserir`.

### O que a conferência prova

Contagem sozinha não pega texto truncado nem `jsonb` remontado errado.
`conferir()` compara o `md5` da **linha inteira**, dos dois lados.

Linha inteira, e não uma lista escolhida a dedo — essa escolha custou um
teste vermelho pra ficar clara. A primeira versão listava à mão "o que
importa" (hash de senha, save, corpo da mensagem), e um `pet` alterado
passou pela conferência sem levantar nada: a coluna não estava na lista.
Numa virada isso é aprovar um destino onde o jogador perdeu o cosmético que
comprou. **Lista escolhida a dedo é lista que envelhece sem avisar.**

Dois cuidados que a linha inteira exige:

- `row(...)::text` com as colunas em **ordem alfabética**, não `t.*::text`.
  Origem e destino nasceram de DDLs diferentes e podem ter a ordem física
  das colunas diferente — o que faria dado idêntico divergir.
- `SET TIME ZONE 'UTC'` e `DateStyle ISO` nos dois antes de comparar. Fuso
  ou `DateStyle` diferentes renderizam o mesmo `timestamptz` de formas
  diferentes, e a conferência acusaria divergência que não existe.

### Esvaziar o destino, e por que isso ganhou comando próprio

**O Supabase não nasce vazio pra esta virada.** A conta criada no navegador
em 22/08, pra provar o login, mora lá.

Isso é pior do que parece com o modo `inserir`: se aquela conta ficou com um
`id` que um jogador real também tem no Neon, o `ON CONFLICT DO NOTHING`
**pula o jogador real e mantém a conta de teste** — e a contagem final
bateria assim mesmo. Conta real perdida, conferência aprovando.

`--limpar-destino` faz `TRUNCATE` nas sete com `RESTART IDENTITY` (que zera
as sequences junto, deixando o estado de banco recém-criado). Não é SQL
solto digitado na hora justamente porque a hora é ruim pra digitar SQL.

**A barreira dele é declarar o número de linhas** (`--apagando=<n>`), além
de repetir o host. Se o número não bater com o que está no banco, ele para.
Contagem inesperada é o sintoma de estar apontado pro banco errado, e
repetir só o host não pegaria isso.

Esvaziar **não dispensa o `--espelhar`**: "vazio no começo" não sobrevive a
uma segunda tentativa, e cópia interrompida e retomada encontra destino
sujo. Os dois juntos.

### As barreiras da CLI

**O script não lê o `.env`**, e isso é reação direta ao que a fase 5
descobriu (o drizzle-kit lê sozinho). As duas pontas vêm de `ORIGEM_URL` e
`DESTINO_URL` ou ele não roda. Recusa se as duas forem iguais. Sem
`--escrever` é ensaio: lê, conta e relata sem gravar.

Com `--escrever` ele **ainda** exige `--confirmo=<host do destino>`, e o
host tem que bater. Digitar o host da origem por engano é recusado antes de
qualquer conexão — provado na mão.

`SEM_SSL=1` existe pra Postgres local, e existe por um motivo específico:
sem ele não dá pra exercitar a CLI contra um banco descartável, e barreira
que nunca rodou não é barreira. Não é escape de produção — Neon e Supabase
exigem SSL e recusam a conexão sem ele.

Rodar de novo não duplica nada nos dois modos, então uma cópia interrompida
se retoma sem limpar o destino. É de propósito não ter transação única:
prender as sete tabelas num lock durante a cópia inteira seria pior que
retomar.

`--espelhar` apaga **antes** de inserir, e não depois: em `friend_requests`
um par `(from_id, to_id)` recriado com id novo violaria a única se a linha
velha ainda estivesse lá.

### O que continua em aberto

Nada disto decide a virada. Falta decidir:

1. **A janela de escrita.** Quem estiver jogando continua gravando no Neon
   durante a cópia. O `--espelhar` dá o caminho — pré-copiar quente (longo,
   sem parar o jogo), congelar a escrita, e fechar com `--espelhar`, que
   reconcilia alteração e remoção. A janela vira o tempo do espelho, não o
   da cópia inteira. **Falta decidir se vale congelar, e por quanto.**
2. **As sessões.** Copiar (ninguém desloga) ou não copiar (todo mundo
   entra de novo). O copiador leva `sessions` junto hoje.
3. **A volta atrás.** Depois que o jogo apontar pro Supabase, o que gravar
   lá fica órfão se a decisão for voltar.

Limite assumido de propósito: `--espelhar` lê as duas listas de chaves
inteiras na memória pra achar o que apagar. Aguenta bem um banco do tamanho
deste jogo; não aguentaria milhões de linhas.

### Achado de fora do assunto: `noImplicitAny: false` esconde `any`

O `apps/api/tsconfig.json` tem `noImplicitAny: false`. Consequência que
apareceu aqui: quando a inferência **fecha um ciclo** (uma variável é lida
pra montar a consulta e reescrita com o resultado dela), o TS resolve
entregando `any` **em silêncio** — o `pnpm typecheck` passa e o tipo some.
Quem pegou foi o `eslint` com as regras tipadas, não o `tsc`.

Vale como regra geral neste pacote: `typecheck` verde não é prova de que há
tipo. Anotação explícita corta o ciclo.

---

## A imagem da API (2026-08-18)

```
docker build -f apps/api/Dockerfile -t rpg-legend-api .
```

**O ponto na raiz não é descuido.** `@rpg-legend/shared` é `workspace:*`
e não existe dentro de `apps/api/`, então o contexto do build tem que ser
o repositório inteiro. Hospedagem que só sabe apontar pra uma subpasta
não constrói isto.

Três estágios: `deps` instala só produção
(`--prod --filter api... --ignore-scripts`, 144 pacotes, 68 MB), `builder`
compila com tudo (sem `--ignore-scripts`, senão o esbuild que o tsup usa
fica sem binário nativo), e `runner` junta os dois `dist` por cima do
`deps`.

### O que foi verificado, e o que não

**Não há Docker nesta máquina**, então a imagem nunca foi construída. O
primeiro `docker build` é o teste dela.

O que foi verificado de verdade, rodando: o `--prod --filter api...`
instala e resolve o `@rpg-legend/shared`; o layout resultante roda com
`node dist/main` e responde em `/health`; e `pnpm --filter api... build`
constrói o shared antes da API. Ou seja, cada comando do Dockerfile foi
exercitado fora dele.

### Dois bugs de build que apareceram junto

Os dois existiam antes, e nenhum aparecia porque a API só tinha rodado em
modo dev:

1. **`node dist/main` não funcionava.** O `drizzle.config.ts` mora na raiz
   do pacote e entrava no build, o que empurrava a raiz inferida pelo
   TypeScript pra o pacote inteiro e a saída pra `dist/src/main.js` —
   enquanto `start:prod` chama `dist/main`. Resolvido fixando `rootDir`
   em `src` no `tsconfig.build.json`, o que também tirou `drizzle.config.js`
   e os scripts de dev da imagem de produção.
2. **`nest build` dizendo "Done" sem gerar nada.** O cache incremental
   (`.tsbuildinfo`) ficava fora do `dist`, e o `nest-cli.json` tem
   `deleteOutDir: true`: apagava a saída, lia um cache que dizia "tudo
   compilado" e não emitia arquivo nenhum. Silencioso — sai com código 0.
   Resolvido pondo o cache dentro do `dist`, pra os dois serem limpos
   juntos.

---

## E-mail saindo de verdade (2026-08-22)

Domínio `rpglegend.com.br`, registrado no Registro.br, verificado no Resend
(região São Paulo). O envio foi provado ponta a ponta com a classe real, não
com uma cópia do request: `pnpm --filter api email:test seu@email.com`
instancia o `ResendEmailSender` do `dist` e manda de verdade.

Três atalhos novos, no padrão dos `db:*`:

| Comando | Pra quê |
|---|---|
| `email:dns` | o DNS já tem o que o Resend precisa? Pergunta pro 8.8.8.8, não pro resolvedor do provedor |
| `email:key` | a `RESEND_API_KEY` é válida? Distingue "chave errada" de "chave só de envio" |
| `email:test` | manda e-mail de verdade pela classe de produção |

### O formato dos registros mudou, e a documentação velha engana

O Resend hoje pede **DKIM em TXT** (`resend._domainkey`) mais **dois CNAME**
(`send` e `rsend`, apontando pra `*.forge.rmta.net`). O par MX + TXT/SPF em
`send.` que a documentação antiga descreve **não é mais isso**. O
`confere-dns.mjs` aceita os dois formatos de propósito, pra não reprovar
quem seguiu a tela que viu.

### Duas horas perdidas por olhar o servidor errado

Quando você cria uma zona própria, o Registro.br **muda os servidores de
nome da zona** — de `auto.dns.br` (a zona padrão anti-spoofing deles) para
`sec.dns.br` (a sua). Um verificador que fixe os IPs dos servidores antigos
responde `ENOTFOUND` pra sempre, mesmo com tudo publicado e correto.

Foi exatamente o que aconteceu aqui: 24 checagens em 2h, todas negativas,
enquanto os registros já estavam no ar. **Sempre reconsultar `NS` antes de
perguntar qualquer coisa** — é o que o `confere-dns.mjs` faz.

### O que a zona nova perdeu

A zona padrão do Registro.br trazia `v=spf1 -all`, `MX 0 .` e
`v=DMARC1; p=reject;` — a configuração "este domínio não manda nem recebe
e-mail". Criar zona própria **substituiu tudo**, e os três sumiram.

Nenhum atrapalha o envio (o SPF do Resend vive no subdomínio `send.`, e o
DMARC passava por DKIM de qualquer jeito). Mas vale recolocar o DMARC —
começando em `p=none` pra ler relatório antes de mandar rejeitar, já que
`p=reject` faz e-mail com problema **sumir calado** em vez de cair no spam.

### A chave é só de envio, e isso é de propósito

A `RESEND_API_KEY` tem permissão `Sending access`. Ela envia e não faz mais
nada — não lê domínio, não mexe na conta. Consequência prática: qualquer
script que tente `GET /domains` com ela leva `401 restricted_api_key`. Isso
é a chave **certa**, não uma chave quebrada; o `confere-resend.mjs` trata os
dois casos separado porque confundir os dois custa tempo.

---

## A sessão saiu do localStorage e virou cookie (2026-08-22)

Pedido original: "um menu de login antes de tudo". O formulário já existia
em `/conta`; o que não existia era como decidir **no servidor** se há
sessão — e sem isso toda tela que dependa de login vira Client Component
que pisca o formulário antes de descobrir que o jogador já estava logado.

A causa era o token morar no `localStorage`: nada fora do navegador
alcança aquilo. Trocado por cookie `httpOnly`, que de quebra tira o token
do alcance de XSS — risco que o próprio `lib/api/session.ts` admitia.

### O que mudou

| Camada | O quê |
|---|---|
| `auth/session-cookie.ts` | novo: emite, lê e apaga o cookie |
| `auth.guard.ts`, `auth.controller.ts` | leem cookie, com `Bearer` de reserva |
| `bootstrap.ts` | `lerCors()` — origem e credenciais viraram um par só |
| `realtime.gateway.ts` | `auth`, `create` e `join` aceitam o cookie do handshake |
| `lib/api/client.ts` | `credentials: 'include'` |
| `lib/api/session.ts` | **apagado** — não há mais token pra guardar |
| `lib/rede/sala.ts` | socket com `withCredentials`, `auth` de corpo vazio |

O `Bearer` continua aceito de propósito: o cliente antigo e qualquer coisa
que não seja navegador ainda mandam token na mão.

### A raiz virou portão, o menu foi pra `/menu`

Ler cookie impede prerender. Se o portão e o menu dividissem a rota, o
menu — que é igual pra todo mundo — viraria dinâmico de graça, jogando
fora o "Server Component sem uma linha de JS" do quinto corte. Separados:

```
ƒ /       portão, dinâmico, decide no servidor
○ /menu   menu, estático, zero JS
```

**Entrar não é obrigatório**: o "Jogar sem conta" leva direto ao menu.

### Cookie exige mesmo site — e isso decide a hospedagem

Dois fatos que só aparecem em produção, os dois silenciosos:

1. A spec do Fetch **proíbe** `Allow-Origin: *` com
   `Allow-Credentials: true`. O navegador descarta a resposta sem avisar.
   Daí `lerCors()` só ligar credenciais quando a origem é declarada.
2. Front e API em domínios diferentes tornam o cookie de terceiros, e
   Safari e Firefox o descartam por padrão. **A API precisa atender em
   `api.rpglegend.com.br`, com o front em `rpglegend.com.br`.** Vercel +
   Render em domínios separados não funciona.

Em produção: `COOKIE_SECURE=true`, `COOKIE_DOMAIN=.rpglegend.com.br`,
`ALLOWED_ORIGIN=https://rpglegend.com.br`.

### A API nunca leu o `.env` (achado no caminho)

Não havia `dotenv` nem `ConfigModule`. O `.env` existia desde a fase 5 e
era lido pelo `drizzle-kit`, que carrega sozinho, e pelos scripts, que
fazem o parsing na mão — **nunca pelo processo da API**, que subia sem
`DATABASE_URL` e respondia `{"configured":false}` em desenvolvimento.

Resolvido com `import 'dotenv/config'` no topo do `main.ts`. **A ordem é
obrigatória:** decorador é avaliado ao importar o módulo, e o
`@WebSocketGateway({ cors: lerCors() })` lê o ambiente nesse instante — se
o `.env` entrar depois, o gateway já congelou a configuração errada.

### Portas em desenvolvimento

Os dois caíam na 3000. O front foi pra **3001** (`next dev -p 3001`), a API
ficou com a 3000, e `ALLOWED_ORIGIN=http://localhost:3001` no `.env` é o
que faz o cookie atravessar.

### A fonte de título virou Jacquard 12

Blackletter pixelada, só nos 23 usos de `--font-display`. Não foi pros 74
usos de `--font-mono` de propósito: aqueles vão de 8,5px a 11px, e
blackletter nesse tamanho é borrão.

A troca saiu **mais leve**, ao contrário do que a estimativa dizia: 89,1 KB
→ **70,5 KB** no caminho crítico. Os 110 KB que assustavam eram o `.ttf`
cru do CDN do Google; subsetado pelo `next/font` o arquivo tem 6,7 KB, e a
Cinzel carregava dois pesos contra o único da Jacquard.

**Ela não tem negrito.** Título nasce com `font-weight: bold` pela folha do
navegador, e negrito inventado empasta desenho pixelado — daí o
`h1..h6 { font-weight: 400 }` no `globals.css`.

### As regiradas por seção que faltavam na criação

O front novo só tinha "Rolar Tudo". Os três botões por seção (poderes,
fraqueza, atributos) existiam no jogo vanilla e nunca foram portados.

Uma regra aqui não é óbvia e está no `ui.js` original: **regirar a fraqueza
regira os atributos junto**, porque eles são calculados a partir dela —
deixar a fraqueza nova com os atributos velhos mostraria números que não
correspondem a nada. Regirar os poderes não mexe em mais nada, porque poder
não entra nesse cálculo.

Pré-requisitos, iguais aos do original: poderes precisam de classe;
atributos precisam de raça, classe e fraqueza; fraqueza não precisa de
nada. Botão sem pré-requisito atendido fica **visível e opaco**, com o
motivo no `title` — botão que some não ensina nada a quem procura por ele.

---

## Publicar a API no Render — a receita (decidido em 2026-08-22)

Escolhido o Render porque o servidor antigo já mora lá: mesma conta, mesmo
painel, nada novo pra aprender. É **serviço novo e separado**, não troca do
que existe.

### O que subir agora não é a virada

```
jogo no ar  →  RPG-Legend-Server (Render)  →  Neon      ← jogadores de verdade
API nova    →  serviço novo                →  Supabase  ← vazio
```

A API nova aponta pro Supabase, que tem o schema e **nenhuma conta**. O que
sobe é ambiente de teste com endereço público, rodando em paralelo. A
virada — mover os dados e apontar o jogo pra cá — é decisão de depois.

### Configuração do serviço

| Campo | Valor |
|---|---|
| Tipo | Web Service |
| Repositório | `Kingdark17/Kingdark17.github.io`, branch `main` |
| Runtime | Docker |
| Dockerfile Path | `apps/api/Dockerfile` |
| **Docker Build Context** | **`.` (a raiz)** |
| Health check | `/health` |

**O contexto na raiz não é opcional.** `@rpg-legend/shared` é `workspace:*`,
e a API não compila sem o pacote irmão, que não existe dentro de
`apps/api/`. Plataforma apontada só pra subpasta não constrói isto.

### Variáveis de ambiente

| Variável | Valor | Por quê |
|---|---|---|
| `DATABASE_URL` | Session pooler do Supabase | porta 5432, host `.pooler.supabase.com` |
| `TRUST_PROXY` | `1` | **obrigatório no Render.** Sem, o teto de 12 tentativas/min vira global e meia dúzia de jogadores tranca o login de todos |
| `COOKIE_SECURE` | `true` | produção é HTTPS |
| `COOKIE_DOMAIN` | `.rpglegend.com.br` | pro cookie valer no front e na API |
| `SAVE_SIGNING_SECRET` | 64 hex aleatórios | sem ele cai pro `DATABASE_URL`; explícito é melhor, e permite trocar o banco sem invalidar save |
| `RESEND_API_KEY` / `EMAIL_FROM` | os mesmos do `.env` | |
| `ALLOWED_ORIGIN` | **deixar vazio por ora** | ver abaixo |
| `ADMIN_USERNAME` | `ADM` (padrão) | |
| `REDIS_URL` | vazio | sem ele, rate limit e presença ficam no processo: correto com uma instância |
| `PORT` | o Render define | |

### A ordem importa: API antes do front deixa `ALLOWED_ORIGIN` em aberto

O front novo ainda não está publicado, então não há origem pra declarar.
Enquanto `ALLOWED_ORIGIN` estiver vazia, `lerCors()` cai no `*` sem
credenciais — a API funciona, mas **o cookie de sessão não atravessa
origem**. É inofensivo agora porque nada consome a API ainda.

Sequência: subir a API → conferir `/health` → publicar o front → aí sim
preencher `ALLOWED_ORIGIN` com a origem dele e reiniciar.

### Domínio

`api.rpglegend.com.br`, criado na Cloudflare como CNAME pro endereço que o
Render dá, **com a nuvem cinza**. Não é preferência: o cookie de sessão só
é de primeira parte se front e API dividirem o domínio registrável.

### O health check é `/health`, e o Render sugere `/healthz`

O campo vem com `/healthz` escrito em cinza. É sugestão do painel, e não
serve aqui: a rota é `/health` (`status.controller.ts`, `@Controller()` sem
prefixo). Aceitar a sugestão dá 404 a cada checagem, o Render marca o
serviço como doente em laço e derruba o deploy sozinho — parecendo defeito
do código.

### Auto-Deploy fica em "On Commit" (decidido em 2026-08-22)

Este repositório serve duas coisas: a API e o jogo antigo em `rpg-legend/`,
que o GitHub Pages publica. Com "On Commit", **todo commit de arte ou de
texto do jogo reconstrói e reinicia a API**, mesmo sem tocar em uma linha
dela.

Escolhido assim mesmo, porque a alternativa é pior no momento errado:
filtrar por caminho (`Build Filters` → `Included Paths`) faz uma mudança
real da API não subir quando o caminho não estiver na lista, e isso **não
dá erro** — a API só continua velha, em silêncio. É a mesma família de bug
do `?v=` esquecido no `index.html`, que já custou caro aqui.

Enquanto nada consome a API, um restart a mais não custa nada. **Revisar
quando o front novo estiver no ar:** aí um commit de sprite derruba a
sessão de quem estiver jogando, e o filtro passa a valer o risco. Dá pra
ligar depois em Settings, sem recriar o serviço. Os caminhos, se for ligar,
são os que o Dockerfile copia:

```
apps/api/**   packages/shared/**   apps/web/package.json
package.json   pnpm-lock.yaml   pnpm-workspace.yaml
```

### O plano grátis dorme

Depois de 15 min parado, a primeira visita leva ~30s. Aceitável enquanto é
ambiente de teste; inaceitável quando virar o jogo de verdade.

### Feito em 2026-08-22: está no ar

Serviço `rpg-legend-api`, região Virginia, plano grátis. Subiu de primeira —
o Dockerfile nunca tinha sido construído em lugar nenhum, porque não há
Docker nesta máquina.

Conferido de fora, não pelo log do painel:

| Prova | Resultado |
|---|---|
| `GET /health` | `200` em 0,46s |
| Banco | `configured: true, connected: true` — o Supabase respondeu de dentro do Render |
| CORS sem `ALLOWED_ORIGIN` | `access-control-allow-origin: *`, sem `allow-credentials` |
| `GET /api/account/me` sem sessão | `401` |
| socket.io | handshake OK, `maxPayload: 524288`, upgrade disponível |

O `maxPayload` bater com os 512 KB do gateway é o que prova que subiu a
nossa configuração, e não o padrão da biblioteca.

Endereço: **`https://api.rpglegend.com.br`** (CNAME → `rpg-legend-api.onrender.com`,
nuvem cinza). `ALLOWED_ORIGIN` continua vazia de propósito, esperando o front.

### A pegadinha do certificado: o Render também roda atrás da Cloudflare

Ao conferir o `api.` recém-criado, o certificado apresentado era
`rpglegend.com.br` + `*.rpglegend.com.br`, emitido pela Google Trust
Services **quase três horas antes de o serviço existir**. Parece
impossível, e a explicação importa:

`rpg-legend-api.onrender.com` responde com `Server: cloudflare` e `CF-RAY`
— **o Render é cliente da Cloudflare**. Como a nossa zona também está lá e
o Universal SSL dela emitiu um curinga quando a zona ativou, a borda da
Cloudflare já tinha certificado válido pro `api.` antes de o Render pedir
o dele.

Consequência prática: **o HTTPS funciona antes de o Render terminar de
emitir**, e o certificado que aparece num teste externo pode não ser o do
Render. Não confundir isso com proxy ligado por engano — a prova de que a
nuvem está cinza é o IP resolvido ser `216.24.57.x` (Render) em vez de
`104.x`/`172.67.x` (Cloudflare), e a resposta trazer
`x-render-origin-server: Render`.

### Verificação que falha na primeira tentativa é normal

O "We weren't able to verify" aparece quando se clica em `Verify` antes de
o registro estar publicado. Não é erro de configuração: criar o registro na
Cloudflare e clicar em `Retry Verification` resolve em segundos. O aviso de
"24 horas ou mais" do painel é texto genérico, escrito pra DNS lento.

---

## O `www` quem resolve é a Cloudflare, não o GitHub (2026-08-22)

O GitHub Pages emite certificado pro apex sozinho, mas **não incluiu o
`www`**: passadas duas horas com o DNS já correto, ele chegou a *reemitir*
o certificado do apex e mesmo assim deixou o `www` de fora. Quem abrisse
`https://www.rpglegend.com.br` recebia `SEC_E_WRONG_PRINCIPAL` — o
servidor apresentava o `*.github.io`, que obviamente não casa.

Pior: o único caminho que funcionava era `http://www`, e o 301 do GitHub
apontava pra **`http://`** do apex. Como navegador moderno tenta HTTPS
primeiro, quase todo mundo batia no erro de certificado antes de chegar
nesse redirecionamento.

**Resolvido sem depender do GitHub.** A zona já tinha um certificado
curinga (`rpglegend.com.br` + `*.rpglegend.com.br`, Google Trust Services)
emitido pelo Universal SSL quando ela ativou. Basta a Cloudflare atender o
`www` pra esse certificado valer:

1. **Rules → Redirect Rules**, modelo pronto "Redirecionar de WWW para a
   raiz": padrão `https://www.*` → destino `https://${1}`, 301.
2. Marcar **"Preservar string de consulta"** — o curinga captura só
   esquema, host e caminho. Sem essa caixa, um link de e-mail com `www`
   chega no jogo **sem o `?verify=`**: conta não confirmada, nenhum erro
   na tela.
3. Só então trocar o registro `www` pra **nuvem laranja**.

**A ordem não é estética.** Com a laranja ligada antes da regra existir, a
Cloudflare passa a buscar no GitHub usando o nome `www.rpglegend.com.br`,
o GitHub responde com o `*.github.io`, a Cloudflare recusa e o visitante
recebe **erro 526** — pior que o erro original. Com a regra no lugar, ela
responde na borda e nunca fala com o GitHub.

Provado depois de ligar:

| Entrada | Saída |
|---|---|
| `https://www/` | 301 → `https://rpglegend.com.br/` |
| `https://www/rpg-legend/` | 301, caminho preservado |
| `https://www/rpg-legend/?verify=X` | 301, `?verify=X` preservado |
| `http://www/rpg-legend/` | 301 direto pro **https** |
| ponta a ponta | `200`, 36 KB, `<title>RPG Legend</title>` |

O `http` ter funcionado foi bônus — a regra pegou os dois esquemas, então
`Always Use HTTPS` não foi preciso. E o rebaixamento pra `http` que o
GitHub fazia sumiu junto.

**Consequência:** o `www` não depende mais do certificado do GitHub, e o
vigia que esperava por ele foi desligado. Se algum dia o `www` voltar a
falhar, o suspeito é a regra da Cloudflare ou a nuvem ter voltado pra
cinza — não o GitHub.

---

## O front novo está no ar (2026-08-22)

`novo.rpglegend.com.br`, Vercel, projeto `rpg-legend-web`. Subdomínio
porque o apex continua com o jogo antigo — e porque **`.vercel.app` não
serviria**: o cookie de sessão é emitido com `Domain=.rpglegend.com.br` e
o navegador simplesmente não o guardaria num domínio de outra gente.

Configuração da Vercel: Root Directory `apps/web`, preset Next.js, e a
opção de **incluir arquivos fora da Root Directory ligada** — mesmo motivo
do contexto `.` no Render, o `@rpg-legend/shared` mora fora. Uma variável
só: `NEXT_PUBLIC_API_URL=https://api.rpglegend.com.br`.

**Cuidado ao importar:** a Vercel varre o repositório e detecta `apps/api`
como projeto NestJS primeiro, já com o preset errado preenchido. Publicar
assim tenta empacotar o Nest como função serverless — que não segura
conexão WebSocket aberta, e levaria o multiplayer junto. Trocar Root
Directory **e** preset antes de clicar em Deploy.

Provado depois de subir:

| Prova | Resultado |
|---|---|
| `/` | `200`, 8,4 KB, 0,67s, certificado próprio Let's Encrypt |
| `/menu` | `X-Vercel-Cache: PRERENDER` — continua estática |
| `NEXT_PUBLIC_API_URL` | achada embutida no chunk; `127.0.0.1:3000` não aparece em lugar nenhum |
| CORS com a origem certa | `allow-origin` específico + `allow-credentials: true` + `vary: Origin` |
| CORS de origem intrusa | não refletida |
| preflight `OPTIONS` | `204`, com `POST` e `Content-Type` liberados |
| `POST /api/account/login` errado | `401`, `{"error":"Usuário ou senha incorretos."}`, sem `Set-Cookie` |

### O login foi testado num navegador de verdade, e passou

Em 2026-08-22, conta criada e sessão aberta em `novo.rpglegend.com.br`
contra a API em `api.rpglegend.com.br`. **Era o último elo nunca
verificado**: até aqui tudo que se sabia do cookie vinha de teste de
cabeçalho e de suíte, nunca de um navegador.

O que ficou provado de uma vez: cookie `httpOnly` emitido por um
subdomínio e devolvido por outro, `SameSite=lax` valendo por serem o mesmo
domínio registrável, `Secure` sobre HTTPS de verdade, `credentials:
'include'` casando com um `ALLOWED_ORIGIN` específico, e a gravação
chegando no Supabase. Nenhuma dessas peças tinha sido exercitada em
conjunto fora da máquina.

É a validação da decisão de arquitetura tomada semanas antes — manter auth
própria com scrypt em vez de Supabase Auth, e pôr front e API sob o mesmo
domínio registrável em vez de aceitar `.vercel.app`.

### ~~Buraco~~: o link de e-mail agora funciona no front novo (2026-08-22)

Estava faltando dos dois lados: `PUBLIC_GAME_URL` não definida no Render
(caindo no padrão, que aponta pro **jogo antigo**), e nenhuma linha em
`apps/web` lendo `?verify=` ou `?reset=`. Consertar um sozinho não
resolveria.

**Onde o link cai.** A API continua montando `BASE/?verify=TOKEN` — formato
herdado do `handleEmailLink` do jogo antigo, **mantido de propósito** pra
uma API só poder atender os dois clientes, que é o que a fase 2 previa.
Quem traduz o formato pras rotas do front é `rotaDoLinkDeEmail()` em
`lib/api/email.ts`, não a API.

**A armadilha que decidiu o desenho.** O portão redireciona pra `/menu`
quem tem sessão. Se o desvio do link viesse depois dessa checagem, o token
seria engolido junto com a busca — e sem erro nenhum: a pessoa veria o
menu, acharia que confirmou, e a conta continuaria pendente. Quem confirma
e-mail normalmente **está** logado, então esse é o caminho comum, não o
raro. Por isso o desvio é a primeira coisa que `app/page.tsx` faz.

**Por que confirmar no cliente e não no servidor.** Seria mais simples
confirmar durante a renderização, e funcionaria sem JavaScript. Mas o token
é de uso único, e varredor de link de caixa de entrada corporativa abre
todo endereço que chega: ele gastaria a confirmação antes da pessoa, que
veria "link inválido" num link que nunca usou. Varredor quase nunca executa
JavaScript. Também há uma trava (`useRef`) contra o efeito rodar duas vezes
no modo estrito — sem ela, a segunda chamada falha e troca o sucesso na
tela por um erro falso.

**Duas entradas que não existiam.** `/redefinir-senha` nasceria
inalcançável: nada no front chamava `request-password-reset`, então o link
que ela espera nunca seria enviado. Daí a `/esqueci-senha` e o link no
portão. E o "Reenviar confirmação" na página de conta, porque o link vale
uma hora — sem ele, e-mail lido no dia seguinte deixaria a conta pendente
pra sempre.

**Confirmado no código, contra a minha própria suspeita:** trocar a senha
apaga todas as sessões do usuário, na mesma transação
(`drizzle-account-email-repository.ts`, `consumePasswordReset`). A tela diz
isso, porque quem acabou de recuperar o acesso precisa entender por que foi
deslogado dos outros aparelhos.

Rotas provadas em produção com entradas inofensivas: `verify-email` e
`reset-password` com token falso devolvem `400` com a mensagem exata que as
telas mostram; `request-password-reset` com e-mail inexistente devolve
`200` com a frase vaga de propósito — a rota não pode virar um verificador
de quais e-mails têm conta.

---

## O `/health` passa a dizer quem está no ar (2026-08-27)

Duas coisas foram entregues em 2026-08-26 e ficaram **inertes em produção
sem ninguém perceber**: a compressão do socket, que não aparecia negociada
no handshake, e a persistência de sala, que depende de uma `REDIS_URL` que
ainda não foi posta. O problema comum às duas não era o código — era não
haver como perguntar ao servidor o que ele estava fazendo. `version`
respondia `nest-phase-2`, uma constante escrita à mão, igual pro commit de
hoje e pro de duas semanas atrás.

O corpo do `/health` ganhou três campos. Os antigos ficaram onde estavam.

| Campo | Responde | Por que não dava pra saber antes |
|---|---|---|
| `commit` / `branch` | qual build está rodando | `RENDER_GIT_COMMIT`/`RENDER_GIT_BRANCH` são injetados pelo Render em build e runtime. Antes, o único jeito era ler o SHA na aba Deploys — e selo verde de "Live" não prova que a variável que você acabou de mexer entrou |
| `redis: {configured, connected}` | a `REDIS_URL` chegou até o processo, e o serviço responde | é o mesmo interruptor da persistência de sala: com cliente o registro usa `DepositoNoRedis`, sem cliente usa `DepositoNulo`. Como o depósito **engole os próprios erros de propósito** (Redis fora não pode recusar partida), sala que não sobrevive ao deploy não faz barulho em lugar nenhum |
| `socket: {conexoes, comprimidas}` | quantas conexões negociaram `permessage-deflate` desde que o processo subiu | de fora, o handshake volta `101` sem `Sec-WebSocket-Extensions` tanto se o deploy é velho quanto se um proxy tirou a extensão — e **não existe endereço da API que não passe por proxy**: `rpg-legend-api.onrender.com` também responde `Server: cloudflare` |

`redis.connected` é medido na hora com um `EXISTS` numa chave que ninguém
escreve — ida e volta de verdade, custo constante, sem deixar rastro. É a
mesma correção do bug #6: flag gravada no boot continua dizendo `true`
depois do serviço cair.

Os contadores de socket zeram junto com o processo, e isso é proposital:
falam sempre da build que está rodando agora.

### Como ler

- **`comprimidas` sobe junto com `conexoes`** → a compressão está valendo.
- **`conexoes` sobe e `comprimidas` fica em zero** → a config do gateway
  não é a culpada (há teste ponta a ponta em `realtime.gateway.spec.ts`
  provando que ela negocia sem proxy no meio); olhar o proxy.
- **`commit` diferente do `git rev-parse --short HEAD`** → o deploy não
  pegou. Nada além disso precisa ser investigado ainda.
- **`commit: null`** → o campo não achou a variável; aí o problema é
  aqui, não no deploy.

---

## A compressão que o proxy não vê (2026-08-30)

O `perMessageDeflate` do gateway estava certo e **nunca valeu em
produção**. Medido no dia, com handshake na mão:

```
$ curl -i -H "Upgrade: websocket" -H "Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits" …
HTTP/1.1 101 Switching Protocols
Server: cloudflare
```

Sem `Sec-WebSocket-Extensions` na resposta — nos **dois** endereços,
`api.rpglegend.com.br` e `rpg-legend-api.onrender.com`. Os dois respondem
`Server: cloudflare`: o Render também fica atrás da Cloudflare, então não
existe endereço da API que escape do proxy. Não há o que configurar.

A saída foi comprimir onde o proxy não mexe: **o corpo da mensagem**. Um
fluxo de deflate por conexão no servidor (`realtime/compressao.ts`), um
`DecompressionStream('deflate-raw')` por conexão no cliente
(`lib/rede/descomprimir.ts`), evento `z` no lugar de `state`/
`authoritative`/`welcome`. Pro Cloudflare são bytes opacos.

### Por que fluxo por conexão, e não um deflate por mensagem

Medido com um pacote real de andar 8 (hero + mapa, já sem a mochila que o
recorte tira), 30 ações:

| regime | por ação | ganho |
|---|---|---|
| cru — o que ia no fio até aqui | 10,8 KB | — |
| deflate por mensagem | 1,9 KB | 5,8× |
| deflate com contexto compartilhado | **0,2 KB** | **56×** |

Quase 10× entre os dois últimos, porque pacotes de sala seguidos são quase
idênticos e o contexto referencia a mensagem anterior em vez de repeti-la.
Um deflate por mensagem ficaria **pior** que o protocolo de delta que já
tinha sido descartado por trazer invariante arriscado: custo sem prêmio.

### As duas armadilhas

1. **A janela precisa ser maior que o pacote.** Com `windowBits: 14` são
   16 KB. Na primeira medição o pacote tinha 21,4 KB (a mochila entrou por
   engano) e o ganho despencou de 56× pra **10,9×** — não há como alcançar
   a mensagem anterior de fora da janela. É por isso que o recorte da
   mochila e a compressão se somam; um não é enfeite do outro.

2. **A ordem virou invariante.** Contexto compartilhado quer dizer que a
   mensagem N só se descomprime depois da N−1. `flush` é assíncrono dos
   dois lados, e duas chamadas concorrentes comprimiriam numa ordem e
   entregariam noutra — dali em diante o outro lado decodifica lixo *com
   cara de estado bom*, que é o pior tipo de falha. Os dois lados têm uma
   fila encadeada por conexão, e teste que dispara tudo junto pra provar.

### O que fazer se aparecer errado

- **`/health` → `socket.deflatePorDentro`** conta as conexões que
  anunciaram saber inflar. Zero com gente jogando = o front não está
  mandando `auth: { z: 1 }`, ou o navegador não tem `deflate-raw`.
- **`socket.comprimidas` continua em zero** e está certo: ele mede o
  `permessage-deflate` do WebSocket, que o proxy mata. Se um dia sair do
  zero, o proxy mudou e dá pra reavaliar.
- **Cliente que não anuncia recebe JSON cru**, como antes. Navegador velho
  e o cliente legado em `rpg-legend/` seguem funcionando.
- **Fronteira é o campo `n`** (tamanho antes de comprimir), não o pedaço
  que o fluxo devolve: nada promete "um pedaço por mensagem".

---

## Os filtros de deploy (2026-08-27)

Commit que mexe só na API redeployava o front, e vice-versa. Os dois lados
foram configurados e **provados com experimento controlado**, porque olhar
o toggle não bastou — ver abaixo.

**Render** (`rpg-legend-api` → Settings → Build Filters → Included Paths).
Os caminhos saem do que o `apps/api/Dockerfile` realmente copia, não de
chute — `turbo.json` e `tsconfig.base.json` ficam de fora porque nunca
entram na imagem:

```
apps/api/**   packages/shared/**   package.json
pnpm-lock.yaml   pnpm-workspace.yaml   .dockerignore
```

Root Directory tem que continuar **vazio**: o contexto do Docker é a raiz
do repositório, porque `@rpg-legend/shared` é `workspace:*`.

**Vercel** (`rpg-legend-web`): Root Directory `apps/web`, *Include files
outside the root directory* **ligado** (sem isso o front não enxerga
`packages/shared`) e o **Skip Deployments** embutido **ligado**. O
`Ignored Build Step` fica em `Automatic`: o próprio painel avisa que
**`turbo-ignore` está deprecado** em favor do toggle.

### O confundidor que fez parecer quebrado

Três commits só de API tinham construído o front assim mesmo, o que lia
como "o toggle não faz nada". **Os três também mexiam no
`NOTAS-MIGRACAO.md`, na raiz do repositório** — e com "include files
outside root directory" ligado, mudança na raiz conta.

O teste que separou: `47afd1d` (só `apps/api/scripts/`, nada na raiz) →
Render construiu, Vercel pulou. `b783cdd` (só `apps/web/`) → Vercel
construiu, Render não. As quatro células como previstas.

**Consequência prática:** editar este arquivo junto com código de API
custa um deploy de front à toa. Vale deixar edição só de documentação em
commit separado.

---

## Travado esperando você

| O quê | Pra quê | Sem isso |
|---|---|---|
| ~~`REDIS_URL` no Render~~ | sala sobreviver ao redeploy | **resolvido em 2026-08-27** — instância **Key Value** (o Render não chama mais de Redis), plano free. Sem persistência em disco e tudo bem: o que importa é sobreviver ao reinício *da API*, e o Key Value é serviço à parte. De brinde, a hibernação do plano free também parou de matar partida |
| ~~Build Filters no Render~~ | parar de redeployar a API em commit que só mexe no front | **resolvido em 2026-08-27**, junto com o Skip Deployments da Vercel. Ver "Os filtros de deploy" |
| ~~Supabase Storage~~ | tirar a foto de perfil de dentro do Postgres | **resolvido em 2026-08-27** — balde `avatares`, público, objeto nomeado pelo hash do conteúdo. **O Storage recusa a chave nova (`sb_secret_…`) com `Invalid Compact JWS`**: ele quer JWT, e só a `service_role` legada (`eyJ…`) serve |
| ~~`RESEND_API_KEY` + `EMAIL_FROM`~~ | confirmar e-mail e reset de senha | **resolvido em 2026-08-22** — domínio `rpglegend.com.br` verificado, envio provado ponta a ponta |
| `DATABASE_URL` de staging | rodar tudo contra banco real | ~~PGlite cobre a maior parte~~ **resolvido em 2026-08-18**: o Supabase serve de staging |
| ~~onde a API vai rodar~~ | definir `TRUST_PROXY` e `ALLOWED_ORIGIN`, decidir a compressão | **resolvido em 2026-08-22** — Render, em `api.rpglegend.com.br`, com `TRUST_PROXY=1`. Falta só `ALLOWED_ORIGIN`, que espera o front existir pra ter uma origem pra declarar |
| arte em camadas | paperdoll | **destravado em 2026-08-24** — 14 camadas chegaram. Ainda faltam 6 raças (anão, orc, draconato, goblin, fada, celestial), 6 armas (adaga, maça, machado, arco, marreta, violão) e 2 armaduras (couro, robe) |

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
| `ALLOWED_ORIGIN` | `*` | CORS — e **é o que liga `credentials`**. Enquanto for `*`, o navegador recusa mandar o cookie de sessão e o login não funciona entre origens. Em desenvolvimento: `http://localhost:3001` |
| `COOKIE_SECURE` | desligado | só o literal `true` liga. Desligado por padrão porque `localhost` é http e o navegador recusaria um cookie `Secure` |
| `COOKIE_DOMAIN` | vazio | `.rpglegend.com.br` em produção, pra o cookie valer no front e na API ao mesmo tempo. Vazio em desenvolvimento (portas diferentes já compartilham cookie) |
| `PUBLIC_GAME_URL` | `https://kingdark17.github.io/rpg-legend/` | monta o link dos e-mails; formato `?verify=` / `?reset=` é o que o cliente lê |
| `RESEND_API_KEY` / `EMAIL_FROM` | — | sem as duas, e-mail não sai (só avisa no log) |
| `REDIS_URL` | — | sem ela, tentativas por IP e presença ficam **no processo**, como antes: correto com uma instância, errado com duas |
| `TRUST_PROXY` | desligado | **ligue com `1` em qualquer hospedagem gerenciada.** Desligado atrás de proxy, o teto de 12 tentativas por minuto é somado entre os jogadores e meia dúzia deles tranca o login geral. Ligado sem proxy na frente é pior: o cliente escolhe o próprio IP pelo cabeçalho e o teto some. Por isso não tem padrão esperto — é declaração de onde o processo está |
| `PORT` | 3000 | — |

---

## Armadilhas

- **`rpg-legend/server/` neste repo é cópia velha.** O servidor real está
  em `github.com/Kingdark17/RPG-Legend-Server` e tem coisa que a cópia não
  tem. Nunca usar a cópia como referência.
- **Mensagem de erro do PowerShell devolve a linha que falhou.** Um
  `$env:X = $env:postgresql://...` digitado errado imprimiu a string de
  conexão inteira, senha inclusa, dentro do texto do erro — e ela foi
  parar num chat sem ninguém ter colado segredo de propósito. A senha do
  Supabase foi rotacionada duas vezes por isso (25/08 e 27/08). Ao passar
  comando com credencial, prefira `Read-Host`: o valor vai num prompt, não
  na linha de comando, e erro nenhum consegue ecoá-lo.
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
