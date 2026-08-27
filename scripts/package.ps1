[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $repoRoot 'manggo.plugin.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$dist = Join-Path $repoRoot 'dist'
$packageBase = "manggo-bailian-plugin-$($manifest.version)"
$zipPath = Join-Path $dist "$packageBase.zip"
$outputPath = Join-Path $dist "$packageBase.mplugin"

New-Item -ItemType Directory -Path $dist -Force | Out-Null
Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $outputPath -Force -ErrorAction SilentlyContinue

Push-Location $repoRoot
try {
    Compress-Archive -LiteralPath @('manggo.plugin.json', 'main.js', 'README.md', 'LICENSE', 'icon.png') -DestinationPath $zipPath -CompressionLevel Optimal
}
finally {
    Pop-Location
}

Move-Item -LiteralPath $zipPath -Destination $outputPath
Write-Output $outputPath
