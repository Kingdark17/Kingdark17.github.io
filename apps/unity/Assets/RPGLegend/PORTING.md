# Port da engine do RPG Legend: TypeScript → C# (Unity)

Fonte: `packages/shared/src`, neste mesmo repositório.
Destino: `apps/unity/Assets/RPGLegend` (esta pasta).

O objetivo é **paridade exata**: para a mesma entrada (e o mesmo `rng`), o C# devolve o
mesmo resultado que o TS **e tira a mesma quantidade de números do rng, na mesma ordem**.
Quem decide se está certo são os resultados de referência gerados pelo TS:

- casos: `packages/shared/fixtures/<modulo>.json`
- tabelas (constantes de módulo): `packages/shared/fixtures/data/<pasta>/<arquivo>.json`
- gerador (lê-lo é obrigatório para saber a FORMA do resultado de cada caso):
  `packages/shared/scripts/gen-fixtures.ts` — cada `caso(nome, fn, args, executar, chamada)`
  mostra o que o executor faz com os argumentos e o que ele devolve.

## Como rodar

Na Unity: Window > General > Test Runner > EditMode > Run All.

Fora da Unity (precisa de um .NET 8 SDK; sem um instalado, no Windows os scripts usam o que vem com a
Unity), a partir desta pasta:

```
bash Tools~/run-tests.sh                      # tudo
bash Tools~/run-tests.sh --module monsters    # um módulo, com a lista do que falta
bash Tools~/run-tests.sh --name "generate:"   # filtra pelo nome do caso
bash Tools~/run-tests.sh --show 40            # mais falhas na tela
powershell -ExecutionPolicy Bypass -File Tools~/run-tests.ps1   # o mesmo, no PowerShell
```

Placar: `passou` = igual ao TS; `falhou` = diferente (com o diff do JSON); `falta` = ainda não portado.
Fora da Unity, os testes de `Tests/EditMode` (e o núcleo deles, `Fixtures/`) rodam com um substituto
mínimo do NUnit (`Tools~/build/Shim`), para não depender do nuget.org.

Os dois jeitos leem os casos de `packages/shared/fixtures`, achado subindo a partir da pasta atual;
a variável `RPG_FIXTURES_DIR` aponta outra pasta. Quando a engine TS mudar, regenere os casos
(`cd packages/shared && pnpm dlx tsx scripts/gen-fixtures.ts`) e rode de novo: o que falhar é o que
falta portar. Se as tabelas mudaram, rode também **RPG Legend > Atualizar tabelas do jogo** (ver Tabelas).

Build de teste: **RPG Legend > Build de teste (Windows)**. Builda só a cena `Scenes/EngineSmoke.unity`
(Mono, Windows 64) em `apps/unity/Builds/Smoke/` (fora do git), roda o `.exe` com
`-batchmode -nographics -logFile` e confere se as linhas `[smoke]` do log são idênticas às do `SmokeRun`
rodado no Editor. O resultado vai para o Console e para `Builds/Smoke/smoke-report.txt`. O primeiro build
leva uns 13 minutos (a Unity compila os shaders do zero); os seguintes, bem menos.

No celular: **RPG Legend > Build de teste (Android)**. Builda a mesma cena em IL2CPP/ARM64 (o que a Play
Store exige) em `apps/unity/Builds/SmokeAndroid/`, instala pelo `adb` no celular ligado no cabo (depuração
USB ligada e o computador autorizado), abre o app e compara as linhas `[smoke]` do logcat com as do Editor.
O mesmo app roda em seguida todos os casos de `packages/shared/fixtures` no aparelho (`DeviceTests/`), e as
linhas `[fixtures]` (placar por módulo, falhas, total) têm que sair idênticas às do `FixtureSuite` rodado no
Editor. Os casos entram como cópia temporária em `DeviceTests/Resources/Fixtures` (fora do git, apagada no
fim) e o código deles só compila com o símbolo `RPG_DEVICE_TESTS`, que só esse build define: o jogo de
verdade não leva nada disso. O relatório vai para `Builds/SmokeAndroid/smoke-report.txt` e o app fica
aberto no celular. O app de teste
usa o identificador `br.com.rpglegend.smoke` só durante o build (o definitivo ainda não foi escolhido). Se
o módulo Android foi instalado com a Unity aberta, feche e abra a Unity antes: sem isso o build "dá certo"
e não gera APK (o menu avisa). O primeiro build Android leva uns 13 minutos (IL2CPP compila tudo em C++).

O app (telas): a cena `Scenes/App.unity` é a cena do build. Abra e dê Play: porta → entrar → menu →
personagens. Por padrão fala com a API de produção (a conta do site). Para testar sem tocar em produção, suba
a API no computador com o banco de desenvolvimento e escolha **RPG Legend > Servidor do jogo > Local**:

```
cd apps/api && pnpm dev:db        # imprime a DATABASE_URL local (127.0.0.1:5433)
pnpm --filter api build
cd apps/api && DOTENV_CONFIG_PATH=/nao/existe/.env DATABASE_URL=<a do dev:db> DATABASE_SSL=false \
  RESEND_API_KEY= EMAIL_FROM= PORT=3100 SAVE_SIGNING_SECRET=dev-local node dist/main.js
```

**Nunca suba a API local lendo o `apps/api/.env`**: ele aponta para o banco de produção e tem a chave do
Resend (criar conta de teste mandaria e-mail de verdade). O `DOTENV_CONFIG_PATH` inexistente impede a
leitura; `DATABASE_URL` e `RESEND_API_KEY` explícitos são a segunda trava (o dotenv não sobrescreve
variável já definida). O `/health` local mostra `redis` e `storage` desligados; o de produção, ligados.

Se a cena precisar ser refeita (mudou a montagem em `AppSceneBuilder`), rode **RPG Legend > Montar cena do
app**: ela recria `Scenes/App.unity` numa cena aditiva, sem mexer na cena aberta.

O app no celular: **RPG Legend > Build do app (Android)** builda `Scenes/App.unity` em IL2CPP/ARM64 em
`apps/unity/Builds/AppAndroid/`, instala pelo cabo e abre; aponta para a API de produção (é o que fica no
celular para entrar com a conta de verdade). **RPG Legend > Build do app (Android, API local)** é o mesmo app
apontando para a API local (símbolo `RPG_API_LOCAL`): o build liga o HTTP sem TLS só para ele e, depois de
instalar, faz `adb reverse tcp:3100 tcp:3100`, então o `127.0.0.1:3100` do celular chega ao computador pelo
cabo. São dois apps no celular ("RPG Legend" e "RPG Legend (local)", identificadores
`br.com.rpglegend.teste` e `br.com.rpglegend.teste.local`, só durante o build), para a sessão de um não
cair no outro. O relatório vai para `Builds/AppAndroid/build-report.txt` (o menu confere se o app abriu sem
exceção no log). O primeiro build leva uns 12 minutos; os seguintes, perto de 2.

## Estrutura

- `Engine/` — C# puro (.NET Standard 2.1, **C# 9**), sem UnityEngine e sem biblioteca de JSON.
  Um arquivo/pasta por módulo do TS (`Engine/Monsters/…`, `Engine/Combat/…`).
- `EngineJson/` — a ponte com JSON (Newtonsoft): `JsSerializer`, `JsJson`, `GameDataLoader`.
- `Game/` — o jogo de verdade, com UnityEngine (assembly `RPGLegend.Game`):
  - `GameBootstrap` carrega as tabelas de `Resources/GameData` antes da primeira cena
    (`RuntimeInitializeOnLoadMethod`), com erro dizendo qual tabela falta;
  - `SmokeRun` (sem UnityEngine) é uma partida curta e determinística — herói, andar 1 e os monstros do
    andar, um por um, com o turno do monstro — com `Rng.SeededRng(42)` e relógio fixo; o relatório não
    mostra uid, porque o da arma inicial sai de
    `Rng.Default`/`Date.now` (paridade com o `buildHero` do TS);
  - `EngineSmoke` (MonoBehaviour) mostra o `SmokeRun` na tela e no log (`[smoke] `) e, com `-batchmode`,
    sai com código 0 ou 1;
  - `App/` — as telas do app: `AppFlow` (o roteiro: porta → entrar → menu → personagens), `DoorScene` (a
    cena 2D da porta e as animações), `AppScreens` (a UI em UI Toolkit), `RpgApi` (as rotas da API do site,
    com token `Bearer`), `Session` (o token nas PlayerPrefs), `ApiConfig` (produção, ou o servidor do menu no
    Editor, ou `-api <url>` num executável, ou a API local no build com `RPG_API_LOCAL`).
- `Scenes/App.unity` — a cena do build (câmera, porta, telas, `AppFlow`), montada pelo menu
  "Montar cena do app". `Scenes/EngineSmoke.unity` — câmera e `EngineSmoke`; é a cena dos builds de teste.
- `UI/` — `App.uxml` (as telas), `Tema.uss` (o visual do site: tokens, botão de pedra em 9-slice, fontes),
  `PainelDoApp.asset` (1280×720, escala pela altura: a tela é deitada), `Fontes/` (Pixelify Sans e VT323,
  OFL; Alkhemikal, CC BY 4.0, com crédito obrigatório no rodapé do menu) e `Imagens/` (brasão e botões,
  copiados de `apps/web/public/img`).
- `Art/Entrada/` — a arte **provisória** da cena da porta (muralha, céu, folhas, cadeado, corrente, tochas).
  A definitiva do Breno entra com os mesmos nomes e tamanhos; o `PixelArtImporter` importa tudo de
  `Art/` e `UI/Imagens/` como pixel art (Point, sem compressão, 1 pixel = 1 unidade).
- `Resources/GameData/` — a cópia de `packages/shared/fixtures/data`, nas mesmas pastas, que vai no build.
  Não edite à mão: ela sai do menu de atualizar tabelas (ver Tabelas).
- `EditorTools/` — só Editor (namespace `RPGLegend.EditorTools`, não `Editor`, que colide com
  `UnityEditor.Editor`): os menus "Atualizar tabelas do jogo", "Build de teste (Windows)",
  "Build de teste (Android)", "Build do app (Android)" (e a variante com API local), "Montar cena do app"
  e "Servidor do jogo", o `AndroidDevice` (o adb e as checagens comuns aos builds de Android) e o
  `PixelArtImporter`.
- `Fixtures/` — o núcleo dos testes, sem NUnit e sem UnityEngine (assembly `RPGLegend.Fixtures`): os
  handlers de fixture (`XxxFixtures.cs`), o `FixtureRegistry`, a leitura dos casos (`Fixtures`), a
  comparação (`JsonAssert`, `FixtureCheck`) e o relatório de todos os casos (`FixtureSuite`). Só compila no
  Editor (`UNITY_INCLUDE_TESTS`) e no build de teste do celular (`RPG_DEVICE_TESTS`).
- `DeviceTests/` — `DeviceFixtures`, que roda o `FixtureSuite` no celular (só no build de teste).
- `Tests/EditMode/` — os testes do Test Runner: `EngineFixtureTests` (um teste por caso, chamando o
  `FixtureCheck`), as regressões e o `GameDataCopyTests`. Sem UnityEngine: também compila no executor de
  fora da Unity.
- `Tools~/` — o executor fora da Unity (projetos .NET, shim do NUnit, scripts `run-tests`).
  A Unity ignora pastas terminadas em `~`.

## Regras do porte

### Números
- **Todo número do jogo é `double`**, como no JS. Inteiro C# só para índice de lista/laço.
- Use `Js.*` onde C# e JS discordam:
  - `Js.Round` (o `Math.round` do JS sobe no .5; o `Math.Round` do C# vai para o par);
  - `Js.Max`/`Js.Min` (propagam NaN; aceitam vários valores);
  - `Math.Floor` do C# é igual ao do JS; divisão sempre em double (`Math.floor(-3/2)` = -2);
  - `Js.ToInt32` (`x | 0`), `Js.ToUint32` (`x >>> 0`);
  - `Js.NumberToString` para número dentro de texto (template literal, uid);
  - `Js.Truthy(...)` para `if (x)` / `x || y` / `!x` com número, número opcional ou texto.
- **Mantenha a ordem das operações** exatamente como no TS: `a * b / c` não é `a * (b / c)` em
  ponto flutuante, e há fixture que pega isso.
- `x ?? 0` com `double?` é `x ?? 0`; `Number(x) || 0` é `Js.Truthy(Js.Num(x)) ? ... : 0`.

### Sorteios
- `RngFn` (delegate `double ()`), `Rng.RandomInt`, `Rng.Pick`, `Rng.SeededRng`.
- A ordem e a quantidade de chamadas ao rng fazem parte do contrato (`rngCalls` no fixture).
  Atenção a: avaliação de curto-circuito (`a && rng() < p`), ordem dos argumentos, laços que
  sorteiam, e `sort(() => rng() - 0.5)` (ver abaixo).
- `Array.prototype.sort` com comparador que sorteia: use a cópia do sort do V8
  (`ordenarComoV8` no gerador; no C#, `JsSort.SortLikeV8`). `List.Sort` do .NET
  dá outra ordem, tira outra quantidade de números e não é estável.
- Relógio: funções que leem `Date.now` recebem `Func<double> now`.

### Modelos (classes de dados)
- Campos públicos com o nome do TS em PascalCase (`maxHp` → `MaxHp`): o `JsSerializer` usa
  camelCase automaticamente. Nome diferente disso → `[JsName("...")]` (ex.: `power`, `RACES`).
- **Campo opcional no TS** (`x?: T`) → tipo anulável no C# (`double?`, `bool?`, `string`,
  classe). `null` no C# = campo ausente (undefined) e some do JSON.
- **Campo que é `null` de propósito no TS** (`x: T | null`, sempre presente) → `[KeepNull]`
  (o null é escrito no JSON).
- Objeto do estado do jogo que vem do save (herói, item, monstro, sala) → inclua
  `[JsExtra] public JsExtras Extra;` para devolver intactos os campos que o C# não conhece.
- **Campo opcional E anulável** (`x?: T | null`: às vezes ausente, às vezes `null`) → propriedade com
  `[KeepNull]` mais um irmão `[JsIgnore] public bool XxxSpecified` (convenção do Newtonsoft, que o
  `JsContractResolver` herda): o setter da propriedade marca `XxxSpecified = true`; `XxxSpecified = false`
  apaga a chave. Exemplos: `DungeonCell.Item`, `ResolveAttackResult.ProcTriggered`.
- Objeto lido como um tipo mais pobre que depois vira um tipo mais rico (ex.: `MonsterInstance` →
  `CombatMonster`): as chaves que o tipo rico conhece chegaram no `Extra`. Promova-as com
  `Extra.TryTake<T>("chave", out var valor)` na conversão (ver `CombatMonster.PromoteCombatExtras`) — no JS
  o spread as leva junto e elas continuam valendo.
- Objeto com chaves dinâmicas (`Record<string, X>`, `Partial<Record<...>>`) → `OrderedMap<X>`
  (ou subclasse). Chave ausente = undefined; valor null = null.
- `{ ...obj }` do TS → cópia rasa explícita (`Clone()`), com o mesmo comportamento de referência.
- Mutação: se o TS muta o objeto recebido, o C# muta; se devolve cópia, o C# devolve cópia.

### Tabelas (constantes de módulo)
- Não copie tabela para dentro do C#. Crie a classe de dados (ex.: `SpeciesData` com
  `[JsName("SPECIES")] public List<SpeciesDef> Species;`), uma parte de `GameData`
  (`public static partial class GameData { ... }` no arquivo do módulo) e um
  `[Preserve] internal sealed class XxxTables : ITableSet` em `EngineJson/` que a carrega.
  O `GameDataLoader` acha os `ITableSet` sozinho.
- Constantes simples (um número) podem ser `const` no C# se não estiverem no JSON, mas prefira
  ler do JSON quando estiverem lá.
- De onde vem o texto das tabelas: nos testes, direto de `packages/shared/fixtures/data`; no jogo, da cópia
  em `Assets/RPGLegend/Resources/GameData` (o `GameBootstrap` lê com `Resources.Load<TextAsset>`).
- **Mudaram as tabelas do TS (regenerou os fixtures) → rode RPG Legend > Atualizar tabelas do jogo.** O menu
  copia só o que mudou (ignorando `\r\n` contra `\n`) e apaga o que sumiu da origem. O teste
  `GameDataCopyTests` falha enquanto a cópia estiver diferente da origem, e diz qual arquivo.

### Fixtures (testes)
- Um `Fixtures/XxxFixtures.cs` por módulo: `internal sealed class XxxFixtures : IFixtureModule`
  com `Register()` chamando `Fn(modulo, "nomeDaFuncaoNoTS", (args, ctx) => ...)` e
  `Const(modulo, "NOME", () => ...)`. É descoberto sozinho.
- Nada de NUnit em `Fixtures/` (ele roda no celular): falha é `FixtureFailure`, que o `JsonAssert` e o
  `ctx.NowOrFail` já lançam.
- O handler reproduz o **executor** do gerador: lê `args` (com `R<T>`, `Num`, `Str`), chama a
  função portada com `ctx.RngFn` / `ctx.NowOrFail` e devolve o JSON com `W(...)` / `N(...)`.
  `W(null)` = null do JSON; devolver C# `null` = undefined.
- Com `args.count`, o executor genérico chama o handler `count` vezes e junta numa lista —
  a não ser que o executor do gerador faça outra coisa; aí registre com `countsItself: true`.
- Erro esperado (`throws`) → lance `EngineError(mensagem, nome)` com a mesma mensagem do TS.

### Testes de regressão (fora dos fixtures)
- Caminhos que o gerador não cobre, mas que um save real pode trazer, ficam em
  `Tests/EditMode/PortRegressionTests.cs` como `[Test]` comuns (o executor fora da Unity também os
  roda, no módulo "regressao").

### O fluxo do jogo (`jogo/`)
- Veio de `apps/web/lib/jogo` para a engine em 2026-10-16, com os mesmos nomes em português, e está portado
  em `Engine/Jogo/` (casos no módulo `jogo` do gerador). Os nomes C# seguem o TS: `Estados` (estado.ts),
  `Tutoriais`, `Apresentacoes`, `Narrador`, `Neblina`, `Cartao`, `Maestria`, `Diario`, `AndarNaSala`,
  `ExtrasDaSala` (extras.ts; o `RoomExtras` é o de dungeon/extras.ts), `Mochilas`, `Impactos`, `Lojas`,
  `QuadroDeMissoes` (missoes.ts: o membro `Missoes` não pode ter o nome da classe), `Dialogos`, `Eventos`,
  `Professores`, `Portoes`, `Guildas`, `Totens`, `Salas` (sala.ts), `Combates` (só o começo do encontro de
  combate.ts) e `Criacoes` (criacao.ts e save-inicial.ts).
- A `TelaAberta` (a união do TS por `tipo`) é uma classe com o `Tipo` e o campo daquele tipo preenchido.
- O estado é a união do TS (`EstadoNaCidade` / `EstadoNaMasmorra`, pelo `mapMode`). Quem escolhe a classe na
  leitura é o `EstadoDoJogoConverter`, registrado no `JsSerializer`: um campo `EstadoDoJogo` dentro de outro
  objeto (a mochila, a conversa) também sai certo. O save carregado se lê com `JogoJson.LerSave`.
- O NPC da cidade e o da masmorra são duas classes no C# (`CityNpc`, `DungeonNpc`) com os mesmos campos; a
  conversa usa `Npc`, que converte de e para as duas.
- As funções do fluxo que criam item (gerar andar, prêmio do tutorial, estoque, troca do NPC, evento, missão,
  portão, guilda) recebem `now` opcional no TS também, para os casos gravarem o uid; sem ele, valem `Date.now`
  e o relógio de verdade. `buildHero` e `trainAtGuild` recebem o rng e o relógio da arma inicial
  (`armaInicial`; no C#, `armaRng` e `armaNow`), e os casos delas, que eram pulados, agora são gravados.
- **Ficam fora de propósito** (decisão do usuário, 2026-10-16): a luta por turnos
  (`combate.ts`, só o começo do encontro vem junto com a sala), porque a luta do app vai ser em tempo real, e
  o co-op e o painel ADM, que entram no app numa etapa própria.

### Limitações conhecidas
- `Attributes` guarda os seis atributos como `double`: atributo ausente vira NaN e `null` vira 0
  (o `Number()` do JS). O que o C# não distingue é o `attrs.x ?? 8` do TS (ausente/null → 8): só
  acontece com save corrompido (o JSON.stringify do web nunca grava atributo ausente).
- Números obrigatórios do `Hero` que faltem no save chegam como 0 (não como undefined). Onde o TS
  depende de undefined, o campo é anulável (ex.: `AttrPoints`, `NpcBlessing.Combats`).
- `Object.prototype` não existe no C#: busca por chave como `"constructor"` ou `"toString"` numa
  tabela devolve "não achou", enquanto no JS acharia a função herdada.
- `raceById` é a única função exportada sem caso de referência no gerador (é uma busca simples
  por id).

### O que NÃO fazer
- Não "corrigir" comportamento do TS, mesmo que pareça bug: porte igual. A correção é feita
  primeiro no TS, os casos são regenerados e o C# acompanha — nunca só de um lado.
- Não mexer nos arquivos-base (`Js.cs`, `OrderedMap.cs`, `JsSerializer.cs`, `JsJson.cs`,
  `Hero/Stats.cs`, `Items/*`) sem necessidade: um utilitário novo vai no módulo que o usa.
- Não usar recursos acima do C# 9 (sem file-scoped namespace, sem `global using`, sem record struct).
