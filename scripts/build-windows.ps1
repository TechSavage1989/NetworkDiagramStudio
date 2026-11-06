[CmdletBinding()]
param([string]$Output = 'dist/windows')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    dotnet publish desktop/NetworkDiagramStudio.csproj -c Release -r win-x64 --self-contained true -o $Output
    if ($LASTEXITCODE) { throw 'Windows publish failed.' }
    $exe = Join-Path $Output 'NetworkDiagramStudio.exe'
    if (!(Test-Path $exe)) { throw 'Stable executable missing.' }
    $intent = Get-Content -Raw 'docs/releases/intent.json' | ConvertFrom-Json
    dotnet run --project tests/desktop/PolicyTests.csproj -- $exe $intent.tag
    if ($LASTEXITCODE) { throw 'Binary verification failed.' }
} finally { Pop-Location }
