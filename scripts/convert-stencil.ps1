[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Path,
    [string]$Destination,
    [switch]$HardwarePack,
    [switch]$List,
    [string[]]$MasterNames
)
$ErrorActionPreference = "Stop"
$source = (Resolve-Path -LiteralPath $Path).Path
if ([IO.Path]::GetExtension($source) -notin ".vss", ".vssx", ".vsdx") { throw "Choose a Visio stencil or drawing." }
if (!$List) {
    $ext = if ($HardwarePack) { ".json" } else { ".vssx" }
    if (!$Destination) { $Destination = [IO.Path]::ChangeExtension($source, $ext) }
    $target = [IO.Path]::GetFullPath($Destination)
    if ([IO.Path]::GetExtension($target) -ne $ext -or (Test-Path -LiteralPath $target)) { throw "Choose a new $ext output path." }
}
$visio = $null
$doc = $null
$temp = $null
try {
    $visio = New-Object -ComObject Visio.InvisibleApp
    $visio.EventsEnabled = 0
    # Read only, hidden, macros disabled; do not add to the recent-files list.
    $doc = $visio.Documents.OpenEx($source, (2 -bor 8 -bor 64 -bor 128))
    if ($List) { foreach ($master in $doc.Masters) { $master.Name }; return }
    if (!$HardwarePack) { $doc.SaveAs($target); Write-Output $target; return }

    Add-Type -AssemblyName System.Drawing
    $temp = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString('N'))
    [void][IO.Directory]::CreateDirectory($temp)
    $shapes = foreach ($master in $doc.Masters) {
        if ($MasterNames -and $master.Name -notin $MasterNames) { continue }
        $id = "art-" + [guid]::NewGuid()
        $png = Join-Path $temp "$id.png"
        $master.Export($png)
        $size = [Drawing.Image]::FromFile($png)
        try {
            $bytes = [IO.File]::ReadAllBytes($png)
            if ($bytes.Length -gt 12MB) { throw "Image too large. Select a smaller master or reduce Visio's raster export resolution." }
            [ordered]@{
                id=$id; name=$master.Name; view=$(if($master.Name -match '\b(back|rear)\b'){'rear'}else{'front'})
                width=$size.Width; height=$size.Height
                dataUrl='data:image/png;base64,' + [Convert]::ToBase64String($bytes)
                anchors=@{}
            }
        } finally { $size.Dispose() }
        Remove-Item -LiteralPath $png
    }
    if (!$shapes) { throw "No matching masters. Use -List to see the available names." }
    $json = [ordered]@{format='NDS-hardware';schema=1;stencils=@($shapes);optics=@{}} | ConvertTo-Json -Depth 6 -Compress
    if ($json.Length -gt 150MB) { throw "Pack too large. Select fewer masters with -MasterNames." }
    [IO.File]::WriteAllText($target,$json,[Text.UTF8Encoding]::new($false))
    Write-Output $target
}
finally {
    if ($temp -and (Test-Path -LiteralPath $temp)) { Remove-Item -LiteralPath $temp -Recurse -Force }
    if ($doc) { try { $doc.Close() } finally { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc) } }
    if ($visio) { try { $visio.Quit() } finally { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($visio) } }
}
