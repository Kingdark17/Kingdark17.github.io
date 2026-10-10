# Ferramentas do port (fora da Unity)

A Unity ignora esta pasta (o nome termina em `~`). Aqui ficam:

- `run-tests.sh` / `run-tests.ps1` — compilam `Engine/`, `EngineJson/` e `Tests/EditMode/` com o .NET 8 SDK
  e rodam todos os fixtures do TypeScript (o mesmo teste do Test Runner da Unity, em segundos).
  No Windows: `bash run-tests.sh` no Git Bash, ou `powershell -ExecutionPolicy Bypass -File run-tests.ps1`.
- `build/` — os projetos .NET do executor e `build/Shim/NUnitShim.cs`, um substituto mínimo do NUnit
  (assim nada depende do nuget.org).
- `lib/Newtonsoft.Json.dll` — a mesma biblioteca de JSON que a Unity usa (13.x, licença MIT em
  `lib/Newtonsoft.Json.LICENSE.md`).

Os casos vêm de `packages/shared/fixtures`, achado subindo a partir desta pasta; a variável
`RPG_FIXTURES_DIR` aponta outra pasta.

As regras do port estão em `../PORTING.md`.

Quando o TypeScript mudar: regenere os fixtures (`cd packages/shared && pnpm dlx tsx scripts/gen-fixtures.ts`),
rode os testes e corrija no C# o que aparecer como falha — o diff mostra o valor do TS e o do C#.
