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

Fora da Unity (precisa do .NET 8 SDK), a partir desta pasta:

```
bash Tools~/run-tests.sh                      # tudo
bash Tools~/run-tests.sh --module monsters    # um módulo, com a lista do que falta
bash Tools~/run-tests.sh --name "generate:"   # filtra pelo nome do caso
bash Tools~/run-tests.sh --show 40            # mais falhas na tela
powershell -ExecutionPolicy Bypass -File Tools~/run-tests.ps1   # o mesmo, no PowerShell
```

Placar: `passou` = igual ao TS; `falhou` = diferente (com o diff do JSON); `falta` = ainda não portado.
Fora da Unity, os testes de `Tests/EditMode` rodam com um substituto mínimo do NUnit
(`Tools~/build/Shim`), para não depender do nuget.org.

Os dois jeitos leem os casos de `packages/shared/fixtures`, achado subindo a partir da pasta atual;
a variável `RPG_FIXTURES_DIR` aponta outra pasta. Quando a engine TS mudar, regenere os casos
(`cd packages/shared && pnpm dlx tsx scripts/gen-fixtures.ts`) e rode de novo: o que falhar é o que
falta portar.

## Estrutura

- `Engine/` — C# puro (.NET Standard 2.1, **C# 9**), sem UnityEngine e sem biblioteca de JSON.
  Um arquivo/pasta por módulo do TS (`Engine/Monsters/…`, `Engine/Combat/…`).
- `EngineJson/` — a ponte com JSON (Newtonsoft): `JsSerializer`, `JsJson`, `GameDataLoader`.
- `Tests/EditMode/` — os handlers de fixture (`XxxFixtures.cs`) e o executor `EngineFixtureTests`.
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

### Fixtures (testes)
- Um `Tests/EditMode/XxxFixtures.cs` por módulo: `internal sealed class XxxFixtures : IFixtureModule`
  com `Register()` chamando `Fn(modulo, "nomeDaFuncaoNoTS", (args, ctx) => ...)` e
  `Const(modulo, "NOME", () => ...)`. É descoberto sozinho.
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
