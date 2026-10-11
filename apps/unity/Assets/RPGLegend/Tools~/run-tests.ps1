# Roda os fixtures do TypeScript contra a engine C# fora da Unity (precisa de um .NET 8 SDK).
#   powershell -ExecutionPolicy Bypass -File run-tests.ps1 [--module combat] [--name "texto"] [--show 20]
# Os casos vêm de packages\shared\fixtures, achado subindo a partir desta pasta;
# a variável RPG_FIXTURES_DIR aponta outra pasta.
# Sem .NET SDK instalado, usa o que vem com a Unity (instalada pelo Hub);
# a variável RPG_DOTNET aponta outro dotnet.
$ErrorActionPreference = "Stop"
$env:DOTNET_CLI_TELEMETRY_OPTOUT = "1"; $env:DOTNET_NOLOGO = "1"
$dotnet = "dotnet"
if ($env:RPG_DOTNET) {
    $dotnet = $env:RPG_DOTNET
} else {
    $sdks = $null
    try { $sdks = & dotnet --list-sdks 2>$null } catch {}
    if (-not $sdks) {
        $unity = Get-ChildItem "$env:ProgramFiles\Unity\Hub\Editor\*\Editor\Data\DotNetSdk\dotnet.exe" -ErrorAction SilentlyContinue |
            Sort-Object FullName | Select-Object -Last 1
        if ($unity) { $dotnet = $unity.FullName }
    }
}
Push-Location $PSScriptRoot
try {
    & $dotnet build build/Runner/Runner.csproj -v q -nologo | Out-Null
    if ($LASTEXITCODE -ne 0) {
        & $dotnet build build/Runner/Runner.csproj -v q -nologo
        $code = 2
    } else {
        & $dotnet build/Runner/bin/Debug/net8.0/RPGLegend.FixtureRunner.dll @args
        $code = $LASTEXITCODE
    }
} finally {
    Pop-Location
}
exit $code
