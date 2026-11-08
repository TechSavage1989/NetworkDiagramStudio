[CmdletBinding()]
param([string]$Output = 'dist/windows')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    node scripts/export-test-fixtures.mjs
    if ($LASTEXITCODE) { throw 'Visio fixture export failed.' }
    python scripts/check-visio-package.py .artifacts/visio
    if ($LASTEXITCODE) { throw 'Visio package validation failed.' }
    python -m unittest discover -s tests -p 'test_*.py'
    if ($LASTEXITCODE) { throw 'Damaged Visio package rejection tests failed.' }
    dotnet run --project tests/switchport-native/SwitchportReports.Tests.csproj -c Release -- .artifacts/switchport-native
    if ($LASTEXITCODE) { throw 'Switchport report integration checks failed.' }
    dotnet publish desktop/NetworkDiagramStudio.csproj -c Release -r win-x64 --self-contained true -o $Output
    if ($LASTEXITCODE) { throw 'Windows publish failed.' }
    $exe = Join-Path $Output 'NetworkDiagramStudio.exe'
    if (!(Test-Path $exe)) { throw 'Stable executable missing.' }
    $intent = Get-Content -Raw 'docs/releases/intent.json' | ConvertFrom-Json
    dotnet run --project tests/desktop/PolicyTests.csproj -- $exe $intent.tag
    if ($LASTEXITCODE) { throw 'Binary verification failed.' }
} finally { Pop-Location }
