# Notas da migração — RPG Legend

Caderno de trabalho da migração pro monorepo. **O que entra aqui:** o que
descobri lendo o servidor real e não está óbvio no código — bugs do
original, desvios conscientes do porte, o que está travado esperando
credencial, armadilhas de deploy e o contrato de rede do multiplayer.

**O que NÃO entra:** decisão de arquitetura fechada (isso é `CLAUDE.md`) e
nada que o código ou o `git log` já contem sozinhos.

Última atualização: 2026-08-15.

---

## Estado por fase

| Fase | Situação |
|---|---|
| 0 — monorepo | pronta |
| 1 — engine em `packages/shared` | pronta (321 testes) |
| 2 — Nest ainda no Neon | porte **completo**, verificado contra Postgres real |
| 3 — front Next | em andamento: conta, personagem, cidade, masmorra, combate e **loja/ferreiro** jogáveis; faltam NPCs, quadro de missões e eventos |
| 4 — paperdoll PixiJS | não começou |
| 5 — **Neon → Supabase** | não começou — **reafirmado pelo usuário em 2026-08-13: fazer assim que a migração terminar** |
| 6 — otimização | não começou |

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
| front (fase 3) | sala não migrada avisa "ainda não foi migrado" em vez de não fazer nada | entrar numa loja e a tela não reagir parece bug; o aviso deixa claro o que falta e não inventa regra nova |
| front (fase 3) | o combate grava a cada ação, não só no fim | fechar a aba no meio de um chefe não devolvia o chefe com vida cheia — o original salva igual |
| front (fase 3) | texto com `<b>` da engine vira `<strong>` de verdade, sem `innerHTML` | o original jogava tudo em `innerHTML`; o mapa trafega pela rede e um dia vem de outro jogador no multiplayer |
| front (fase 3) | sem token, `chamarApi` já rejeita no cliente | evita mandar `Bearer ` vazio e tira o `setState` síncrono de dentro do `useEffect` (regra `react-hooks/set-state-in-effect` do lint do Next 16) |
| front (fase 3) | a arte dos itens foi **copiada** de `rpg-legend/img/` pra `apps/web/public/img/` | 240 KB, 28 arquivos. O app na Vercel não pode depender do GitHub Pages pra desenhar um item. Enquanto os dois clientes coexistirem há duas cópias; a do jogo antigo some junto com ele |

### Fase 3 — o que já dá pra jogar

Criar conta → criar personagem → andar pela cidade → taverna →
**comprar, vender e reforjar** → atravessar o portão → explorar a
masmorra → abrir baú → lutar → descer escada → sair pela saída e voltar
pra cidade. Tudo gravando na nuvem com a assinatura encadeada.

Falta: quadro de missões, diálogo com NPC e eventos de sala.

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
idêntico, e o `cityMap` guarda o mesmo estoque. O item no save continua
sendo só `uid/templateId/rarity/stats/value/equipped` — o catálogo não
entra. E a arte serve de `/img/...` no build do Next (conferido com
`next start` + `curl`, 200 e `image/png`).

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
  aconteceu em 2026-08-14 com a JetBrains Mono. Não é erro do código:
  `rm -rf apps/web/.next/cache/turbopack` e buildar de novo resolve. Se
  acontecer na Vercel, é limpar o cache de build de lá.
