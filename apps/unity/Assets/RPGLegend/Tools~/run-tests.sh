#!/usr/bin/env bash
# Roda os fixtures do TypeScript contra a engine C# fora da Unity (precisa de um .NET 8 SDK).
#   bash run-tests.sh [--module combat] [--name "texto"] [--show 20]
# Os casos vêm de packages/shared/fixtures, achado subindo a partir desta pasta;
# a variável RPG_FIXTURES_DIR aponta outra pasta.
# Sem .NET SDK instalado, usa o que vem com a Unity (Windows, instalada pelo Hub);
# a variável RPG_DOTNET aponta outro dotnet.
set -e
cd "$(dirname "$0")"
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1
DOTNET="${RPG_DOTNET:-dotnet}"
if [ -z "$RPG_DOTNET" ] && [ -z "$(dotnet --list-sdks 2>/dev/null)" ]; then
  for d in "/c/Program Files/Unity/Hub/Editor/"*/Editor/Data/DotNetSdk/dotnet.exe; do
    [ -x "$d" ] && DOTNET="$d"
  done
fi
if ! command -v "$DOTNET" >/dev/null; then
  echo "Não achei um .NET SDK: instale o .NET 8 SDK ou a Unity 6 pelo Hub, ou aponte RPG_DOTNET." >&2
  exit 2
fi
"$DOTNET" build build/Runner/Runner.csproj -v q -nologo >/dev/null || { "$DOTNET" build build/Runner/Runner.csproj -v q -nologo | grep -E "error" | sort -u | head -40; exit 2; }
"$DOTNET" build/Runner/bin/Debug/net8.0/RPGLegend.FixtureRunner.dll "$@"
