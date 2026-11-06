[CmdletBinding()]
param([Parameter(Mandatory)][string]$Binary)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$binaryPath = (Resolve-Path $Binary).Path
$work = Join-Path ([IO.Path]::GetTempPath()) ('nds-native-'+[guid]::NewGuid().ToString('N'))
$null = New-Item -Type Directory $work
$old = Join-Path $work 'old'
$bad = Join-Path $work 'unhealthy'
# An isolated runner profile belongs exclusively to this test.
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Run lifecycle tests in a disposable Windows Actions runner.' }
& dotnet publish "$root/desktop/NetworkDiagramStudio.csproj" -c Release -r win-x64 --self-contained true -p:NativeSmokeBuild=true -p:Version=0.0.8-preview.1 -o $old
if ($LASTEXITCODE) { throw 'Old native test build failed.' }
& dotnet publish "$root/desktop/NetworkDiagramStudio.csproj" -c Release -r win-x64 --self-contained true -p:NativeSmokeBuild=true -p:Version=0.0.9-preview.1 -o $bad
if ($LASTEXITCODE) { throw 'Unhealthy fixture build failed.' }
$original = Join-Path $old 'NetworkDiagramStudio.exe'
$target = Join-Path $work 'CustomLaunchName.exe'
Copy-Item $original $target
$report = Join-Path $work 'timer.txt'
$p = Start-Process $target -ArgumentList @('--test-timer',('"'+$report+'"')) -PassThru
if (!$p.WaitForExit(360000) -or $p.ExitCode -ne 0 -or !(Test-Path $report)) { if (Test-Path $report) { Get-Content $report }; throw 'Real-window timer test failed.' }
$store = Join-Path $env:LOCALAPPDATA 'NetworkDiagramStudio'
$sentinel = Join-Path $store 'qa-setting.txt'
'preserve-this-setting' | Set-Content $sentinel
function Wait-Until([scriptblock]$condition, [int]$seconds) {
    $until = (Get-Date).AddSeconds($seconds)
    do { if (& $condition) { return }; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $until)
    throw 'Native update did not reach its expected end state.'
}
function Get-TargetProcess { Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $target } }
function Close-Target { foreach ($app in @(Get-TargetProcess)) { [void]$app.CloseMainWindow(); if (!$app.WaitForExit(6000)) { $app.Kill() } } }
try {
    $env:NDS_SIMULATE_FAILED_HEALTH='1'
    $candidate = Join-Path $bad 'NetworkDiagramStudio.exe'
    $p=Start-Process $target -ArgumentList @('--test-install',('"'+$candidate+'"')) -PassThru -Wait
    if ($p.ExitCode -ne 0) { throw 'Fixture download or staging failed.' }
    Wait-Until { (Get-TargetProcess | Where-Object MainWindowHandle -ne 0) -and (Get-FileHash $target).Hash -eq (Get-FileHash $original).Hash } 125
    Close-Target
    Remove-Item Env:NDS_SIMULATE_FAILED_HEALTH
    $p=Start-Process $target -ArgumentList @('--test-install',('"'+$binaryPath+'"')) -PassThru -Wait
    if ($p.ExitCode -ne 0) { throw 'Release download or staging failed.' }
    Wait-Until { (Test-Path "$store/updates/previous.exe") -and !(Test-Path "$store/updates/pending.json") } 125
    if ((Get-FileHash $target).Hash -ne (Get-FileHash $binaryPath).Hash -or (Get-FileHash "$store/updates/previous.exe").Hash -ne (Get-FileHash $original).Hash) { throw 'Update target or rollback backup mismatch.' }
    if ((Get-Content $sentinel) -ne 'preserve-this-setting') { throw 'Settings lost.' }
    Write-Output 'Native upgrade and failed-health rollback preserved the filename, settings and correct backup.'
} finally { Close-Target; Remove-Item Env:NDS_SIMULATE_FAILED_HEALTH -ErrorAction SilentlyContinue }
