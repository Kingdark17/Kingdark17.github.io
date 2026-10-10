# Roda os fixtures do TypeScript contra a engine C# fora da Unity (precisa do .NET 8 SDK).
#   powershell -ExecutionPolicy Bypass -File run-tests.ps1 [--module combat] [--name "texto"] [--show 20]
# Os casos vêm de packages\shared\fixtures, achado subindo a partir desta pasta;
# a variável RPG_FIXTURES_DIR aponta outra pasta.
$ErrorActionPreference = "Stop"
$env:DOTNET_CLI_TELEMETRY_OPTOUT = "1"; $env:DOTNET_NOLOGO = "1"
Push-Location $PSScriptRoot
try {
    dotnet build build/Runner/Runner.csproj -v q -nologo | Out-Null
    if ($LASTEXITCODE -ne 0) {
        dotnet build build/Runner/Runner.csproj -v q -nologo
        $code = 2
    } else {
        dotnet build/Runner/bin/Debug/net8.0/RPGLegend.FixtureRunner.dll @args
        $code = $LASTEXITCODE
    }
} finally {
    Pop-Location
}
exit $code
