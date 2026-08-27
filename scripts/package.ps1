[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $repoRoot 'dist'
$stagingRoot = Join-Path $dist '.staging'

$manggoManifest = Get-Content -LiteralPath (Join-Path $repoRoot 'manggo.plugin.json') -Raw | ConvertFrom-Json
$translateManifest = Get-Content -LiteralPath (Join-Path $repoRoot 'platforms/bob-translate/info.json') -Raw | ConvertFrom-Json
$ocrManifest = Get-Content -LiteralPath (Join-Path $repoRoot 'platforms/bob-ocr/info.json') -Raw | ConvertFrom-Json
$versions = @(@($manggoManifest.version, $translateManifest.version, $ocrManifest.version) | Select-Object -Unique)
if ($versions.Count -ne 1) {
    throw "Plugin versions must match across Manggo, Bob Translate, and Bob OCR."
}
$version = $versions[0]

New-Item -ItemType Directory -Path $dist -Force | Out-Null
Get-ChildItem -LiteralPath $dist -File | Where-Object { $_.Extension -in @('.mplugin', '.bobplugin') } | Remove-Item -Force
Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

function Copy-RootFile {
    param([string]$Source, [string]$DestinationDirectory)
    Copy-Item -LiteralPath (Join-Path $repoRoot $Source) -Destination $DestinationDirectory
}

function New-PluginArchive {
    param(
        [string]$SourceDirectory,
        [string]$OutputName
    )
    $zipPath = Join-Path $dist ($OutputName + '.zip')
    $outputPath = Join-Path $dist $OutputName
    Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
    Compress-Archive -Path (Join-Path $SourceDirectory '*') -DestinationPath $zipPath -CompressionLevel Optimal
    Move-Item -LiteralPath $zipPath -Destination $outputPath
    return $outputPath
}

function Copy-BobRuntime {
    param(
        [string]$Platform,
        [string]$DestinationDirectory
    )
    $sourceLib = Join-Path $repoRoot "platforms/$Platform/lib"
    $destinationLib = Join-Path $DestinationDirectory 'lib'
    Get-ChildItem -LiteralPath $sourceLib -Recurse -File -Filter '*.js' | ForEach-Object {
        $relative = [System.IO.Path]::GetRelativePath($sourceLib, $_.FullName)
        $target = Join-Path $destinationLib $relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $target
    }
}

$manggoStage = Join-Path $stagingRoot 'manggo'
New-Item -ItemType Directory -Path $manggoStage -Force | Out-Null
@('manggo.plugin.json', 'main.js', 'README.md', 'LICENSE', 'icon.png') | ForEach-Object {
    Copy-RootFile -Source $_ -DestinationDirectory $manggoStage
}
$manggoPackage = New-PluginArchive -SourceDirectory $manggoStage -OutputName "manggo-bailian-$version.mplugin"

function New-BobPackage {
    param(
        [string]$Platform,
        [string]$PackageName
    )
    $stage = Join-Path $stagingRoot $Platform
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    @('info.json', 'main.js', 'icon.png') | ForEach-Object {
        Copy-Item -LiteralPath (Join-Path $repoRoot "platforms/$Platform/$_") -Destination $stage
    }
    Copy-RootFile -Source 'README.md' -DestinationDirectory $stage
    Copy-RootFile -Source 'LICENSE' -DestinationDirectory $stage
    Copy-BobRuntime -Platform $Platform -DestinationDirectory $stage
    return (New-PluginArchive -SourceDirectory $stage -OutputName $PackageName)
}

$translatePackage = New-BobPackage -Platform 'bob-translate' -PackageName "bob-bailian-translate-$version.bobplugin"
$ocrPackage = New-BobPackage -Platform 'bob-ocr' -PackageName "bob-bailian-ocr-$version.bobplugin"

Add-Type -AssemblyName System.IO.Compression.FileSystem
function Assert-ArchiveEntries {
    param(
        [string]$ArchivePath,
        [string[]]$RequiredEntries
    )
    $archive = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
    try {
        $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
        foreach ($required in $RequiredEntries) {
            if ($entries -notcontains $required) {
                throw "$(Split-Path -Leaf $ArchivePath) is missing root entry $required."
            }
        }
    }
    finally {
        $archive.Dispose()
    }
}

function Assert-ArchiveSafety {
    param(
        [string]$ArchivePath,
        [switch]$BobRuntime
    )
    $archive = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
    try {
        foreach ($entry in $archive.Entries) {
            if ($entry.FullName -notmatch '\.(js|json|md|txt)$') { continue }
            $stream = $entry.Open()
            $reader = [System.IO.StreamReader]::new($stream)
            try {
                $content = $reader.ReadToEnd()
            }
            finally {
                $reader.Dispose()
                $stream.Dispose()
            }
            if ($content -match '(?i)[A-Z]:\\Users\\|/home/runner/' -or $content -match 'sk-[A-Za-z0-9]{12,}') {
                throw "$(Split-Path -Leaf $ArchivePath) contains a local path or credential-like value in $($entry.FullName)."
            }
            if ($BobRuntime -and $entry.FullName -match '\.js$') {
                $forbidden = @(
                    '(^|\n)\s*(import|export)\s',
                    '\bfetch\s*\(',
                    '\bnew\s+Response\b',
                    '\bnew\s+TextDecoder\b',
                    '\bnew\s+URL\b',
                    '\bprocess\.',
                    '\bBuffer\.'
                )
                foreach ($pattern in $forbidden) {
                    if ($content -cmatch $pattern) {
                        throw "$(Split-Path -Leaf $ArchivePath) contains unsupported Bob runtime code in $($entry.FullName): $pattern"
                    }
                }
            }
        }
    }
    finally {
        $archive.Dispose()
    }
}

Assert-ArchiveEntries -ArchivePath $manggoPackage -RequiredEntries @('manggo.plugin.json', 'main.js', 'icon.png')
Assert-ArchiveEntries -ArchivePath $translatePackage -RequiredEntries @('info.json', 'main.js', 'icon.png', 'lib/core.js', 'lib/translate/main.js')
Assert-ArchiveEntries -ArchivePath $ocrPackage -RequiredEntries @('info.json', 'main.js', 'icon.png', 'lib/core.js', 'lib/plugin.js')
Assert-ArchiveSafety -ArchivePath $manggoPackage
Assert-ArchiveSafety -ArchivePath $translatePackage -BobRuntime
Assert-ArchiveSafety -ArchivePath $ocrPackage -BobRuntime

$packages = @($manggoPackage, $translatePackage, $ocrPackage)
$hashLines = $packages | Sort-Object | ForEach-Object {
    $hash = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $(Split-Path -Leaf $_)"
}
$hashPath = Join-Path $dist 'SHA256SUMS.txt'
$hashLines | Set-Content -LiteralPath $hashPath -Encoding utf8NoBOM

Remove-Item -LiteralPath $stagingRoot -Recurse -Force
$packages | ForEach-Object { Write-Output $_ }
Write-Output $hashPath
