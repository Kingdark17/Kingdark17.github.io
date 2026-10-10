#!/usr/bin/env bash
# Roda os fixtures do TypeScript contra a engine C# fora da Unity (precisa do .NET 8 SDK).
#   bash run-tests.sh [--module combat] [--name "texto"] [--show 20]
# Os casos vêm de packages/shared/fixtures, achado subindo a partir desta pasta;
# a variável RPG_FIXTURES_DIR aponta outra pasta.
set -e
cd "$(dirname "$0")"
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1
dotnet build build/Runner/Runner.csproj -v q -nologo >/dev/null || { dotnet build build/Runner/Runner.csproj -v q -nologo | grep -E "error" | sort -u | head -40; exit 2; }
dotnet build/Runner/bin/Debug/net8.0/RPGLegend.FixtureRunner.dll "$@"
