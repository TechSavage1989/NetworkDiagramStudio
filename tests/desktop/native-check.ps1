[CmdletBinding()]
param([Parameter(Mandatory)][string]$Binary)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$binaryPath = (Resolve-Path $Binary).Path
$work = Join-Path ([IO.Path]::GetTempPath()) ('nds-native-'+[guid]::NewGuid().ToString('N'))
$null = New-Item -Type Directory $work
$old = Join-Path $work 'old'
$bad = Join-Path $work 'unhealthy'
$target = Join-Path $work 'CustomLaunchName.exe'
# This lifecycle test intentionally uses an isolated runner profile.
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Run lifecycle tests in a disposable Windows Actions runner.' }
$store = Join-Path $env:LOCALAPPDATA 'NetworkDiagramStudio'
$helper = Join-Path $store 'updates/update-helper.exe'
$report = Join-Path $work 'timer.txt'
$env:NDS_TEST_ERROR_LOG = Join-Path $work 'native-test-error.txt'
function Stage([string]$message) { Write-Host "[$([DateTime]::UtcNow.ToString('HH:mm:ss')) UTC] $message" }
function Wait-Until([scriptblock]$condition, [int]$seconds, [string]$label) {
    $until = (Get-Date).AddSeconds($seconds)
    do { if (& $condition) { return }; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $until)
    throw "Timed out waiting for $label."
}
function Get-TargetProcess { Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $target } }
function Close-Target {
    foreach ($app in @(Get-TargetProcess)) {
        [void]$app.CloseMainWindow()
        if (!$app.WaitForExit(6000)) { $app.Kill(); [void]$app.WaitForExit(3000) }
    }
}
function Run-Install([string]$candidate) {
    # The helper and replacement window outlive the explicitly launched process.
    # Start-Process -Wait waits for descendants on Windows and would deadlock here.
    $launcher = Start-Process $target -ArgumentList @('--test-install',('"'+$candidate+'"')) -PassThru
    Stage "Started fixture launcher PID $($launcher.Id)"
    if (!$launcher.WaitForExit(60000)) { throw "Fixture launcher PID $($launcher.Id) failed to exit within 60 seconds." }
    if ($launcher.ExitCode -ne 0) { throw "Fixture download or staging failed with exit code $($launcher.ExitCode)." }
    Stage 'Launcher exited. Watching the separate update helper and replacement.'
}
try {
    Stage 'Publishing previous-version and unhealthy test hosts.'
    & dotnet publish "$root/desktop/NetworkDiagramStudio.csproj" -c Release -r win-x64 --self-contained true -p:NativeSmokeBuild=true -p:Version=0.0.8-preview.1 -o $old
    if ($LASTEXITCODE) { throw 'Old native test build failed.' }
    & dotnet publish "$root/desktop/NetworkDiagramStudio.csproj" -c Release -r win-x64 --self-contained true -p:NativeSmokeBuild=true -p:Version=0.0.9-preview.1 -o $bad
    if ($LASTEXITCODE) { throw 'Unhealthy fixture build failed.' }
    $original = Join-Path $old 'NetworkDiagramStudio.exe'
    Copy-Item $original $target
    Stage 'Checking real window, export, PDF, focus and five-minute timer.'
    $p = Start-Process $target -ArgumentList @('--test-timer',('"'+$report+'"')) -PassThru
    if (!$p.WaitForExit(360000) -or $p.ExitCode -ne 0 -or !(Test-Path $report)) { throw 'Real-window timer test failed.' }
    Get-Content $report | Write-Host
    $sentinel = Join-Path $store 'qa-setting.txt'
    'preserve-this-setting' | Set-Content $sentinel
    Stage 'Installing an intentionally unhealthy release to exercise rollback.'
    $env:NDS_SIMULATE_FAILED_HEALTH='1'
    $candidate = Join-Path $bad 'NetworkDiagramStudio.exe'
    Run-Install $candidate
    Wait-Until { (Get-TargetProcess | Where-Object MainWindowHandle -ne 0) -and (Get-FileHash $target).Hash -eq (Get-FileHash $original).Hash } 125 'visible restored application'
    Stage 'Rollback confirmed. Closing restored window before valid upgrade.'
    Close-Target
    Remove-Item Env:NDS_SIMULATE_FAILED_HEALTH
    Wait-Until { !(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $helper }) } 15 'rollback helper exit'
    Stage 'Downloading and installing the verified release candidate.'
    Run-Install $binaryPath
    Wait-Until { (Test-Path "$store/updates/previous.exe") -and !(Test-Path "$store/updates/pending.json") } 125 'healthy window and rollback backup'
    if ((Get-FileHash $target).Hash -ne (Get-FileHash $binaryPath).Hash -or (Get-FileHash "$store/updates/previous.exe").Hash -ne (Get-FileHash $original).Hash) { throw 'Update target or rollback backup mismatch.' }
    if ((Get-Content $sentinel) -ne 'preserve-this-setting') { throw 'Settings lost.' }
    Stage 'Native upgrade and failed-health rollback preserved the filename, settings and correct backup.'
} catch {
    foreach($file in @($report,$env:NDS_TEST_ERROR_LOG,(Join-Path $store 'last-update-error.txt'))) {
        if(Test-Path -LiteralPath $file) { Stage "Diagnostic $file"; Get-Content -LiteralPath $file | Write-Host }
    }
    throw
} finally {
    Stage 'Stopping disposable test windows and updater processes.'
    # Only terminate application processes from the unique QA directory and its
    # dedicated update helper. /T includes WebView children of a stalled window.
    $workPrefix = $work.TrimEnd('\')+'\'
    foreach ($app in @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and ($_.Path.StartsWith($workPrefix,[StringComparison]::OrdinalIgnoreCase) -or $_.Path -eq $helper) })) {
        & taskkill.exe /PID $app.Id /T /F 2>$null | Out-Null
    }
    Remove-Item Env:NDS_SIMULATE_FAILED_HEALTH -ErrorAction SilentlyContinue
    Remove-Item Env:NDS_TEST_ERROR_LOG -ErrorAction SilentlyContinue
    $global:LASTEXITCODE = 0
}
