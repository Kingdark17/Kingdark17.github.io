# Notas da migração — RPG Legend

Caderno de trabalho da migração pro monorepo. **O que entra aqui:** o que
descobri lendo o servidor real e não está óbvio no código — bugs do
original, desvios conscientes do porte, o que está travado esperando
credencial, armadilhas de deploy e o contrato de rede do multiplayer.

**O que NÃO entra:** decisão de arquitetura fechada (isso é `CLAUDE.md`) e
nada que o código ou o `git log` já contem sozinhos.

Última atualização: 2026-08-13.

---

## Estado por fase

| Fase | Situação |
|---|---|
| 0 — monorepo | pronta |
| 1 — engine em `packages/shared` | pronta (304 testes) |
| 2 — Nest ainda no Neon | porte **completo**, verificado contra Postgres real |
| 3 — front Next | em andamento: conta e seleção de personagem |
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
