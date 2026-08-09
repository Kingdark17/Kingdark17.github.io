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
das salas vizinhas, múltiplos monstros em fila por sala (combate encadeado
automático), tesouro bônus ao limpar a sala, movimento em direção absoluta
fixa.
