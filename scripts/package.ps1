[CmdletBinding()]
param(
    [ValidateSet('Public', 'PersonalCoding')]
    [string]$Profile = 'Public'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$distRoot = Join-Path $repoRoot 'dist'
$dist = if ($Profile -eq 'PersonalCoding') { Join-Path $distRoot 'personal' } else { $distRoot }
$stagingRoot = Join-Path $dist '.staging'
$packageSuffix = if ($Profile -eq 'PersonalCoding') { '-coding-plan' } else { '' }

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

function Set-RuntimeProfile {
    param([string]$DestinationDirectory)

    $sourceMarker = '__BAILIAN_RUNTIME_PROFILE_DEVELOPMENT__'
    $targetMarker = if ($Profile -eq 'PersonalCoding') {
        '__BAILIAN_RUNTIME_PROFILE_PERSONAL__'
    }
    else {
        '__BAILIAN_RUNTIME_PROFILE_PUBLIC__'
    }
    $changed = 0
    Get-ChildItem -LiteralPath $DestinationDirectory -Recurse -File -Filter '*.js' | ForEach-Object {
        $content = Get-Content -LiteralPath $_.FullName -Raw
        if ($content.Contains($sourceMarker)) {
            $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
            [System.IO.File]::WriteAllText($_.FullName, $content.Replace($sourceMarker, $targetMarker), $utf8NoBom)
            $changed += 1
        }
    }
    if ($changed -lt 1) {
        throw "No runtime profile marker was found in $DestinationDirectory."
    }
}

function Set-PersonalCodingManifest {
    param(
        [string]$ManifestPath,
        [ValidateSet('Manggo', 'BobTranslate', 'BobOcr')]
        [string]$Kind
    )

    if ($Profile -ne 'PersonalCoding') { return }

    $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    $notice = 'Unsupported personal build: Alibaba Cloud currently prohibits Coding Plan in custom applications. Use only after receiving written compatibility confirmation.'
    $accessModes = @(
        [pscustomobject]@{ title = 'Coding Plan (unsupported personal profile)'; value = 'coding_plan' },
        [pscustomobject]@{ title = 'Pay-as-you-go'; value = 'pay_as_you_go' },
        [pscustomobject]@{ title = 'Token Plan (Personal Edition)'; value = 'token_plan' }
    )
    $codingTranslationModels = @(
        [pscustomobject]@{ title = 'Qwen3.7 Plus (Coding Plan recommended)'; value = 'qwen3.7-plus' },
        [pscustomobject]@{ title = 'Qwen3.6 Plus (Coding Plan)'; value = 'qwen3.6-plus' },
        [pscustomobject]@{ title = 'Qwen3.5 Plus (Coding Plan)'; value = 'qwen3.5-plus' },
        [pscustomobject]@{ title = 'Kimi K2.5 (Coding Plan)'; value = 'kimi-k2.5' },
        [pscustomobject]@{ title = 'GLM 5 (Coding Plan)'; value = 'glm-5' },
        [pscustomobject]@{ title = 'MiniMax M2.5 (Coding Plan; always thinking)'; value = 'MiniMax-M2.5' },
        [pscustomobject]@{ title = 'Qwen3 Max 2026-01-23 (Coding Plan)'; value = 'qwen3-max-2026-01-23' },
        [pscustomobject]@{ title = 'Qwen3 Coder Next (Coding Plan)'; value = 'qwen3-coder-next' },
        [pscustomobject]@{ title = 'Qwen3 Coder Plus (Coding Plan)'; value = 'qwen3-coder-plus' },
        [pscustomobject]@{ title = 'GLM 4.7 (Coding Plan)'; value = 'glm-4.7' }
    )
    $codingOcrModels = @(
        [pscustomobject]@{ title = 'Qwen3.7 Plus (Coding Plan recommended)'; value = 'qwen3.7-plus' },
        [pscustomobject]@{ title = 'Qwen3.6 Plus (Coding Plan)'; value = 'qwen3.6-plus' },
        [pscustomobject]@{ title = 'Qwen3.5 Plus (Coding Plan)'; value = 'qwen3.5-plus' },
        [pscustomobject]@{ title = 'Kimi K2.5 (Coding Plan)'; value = 'kimi-k2.5' }
    )

    if ($Kind -eq 'Manggo') {
        $manifest.description = "Personal Coding Plan profile for Manggo translation and OCR. $notice"
        foreach ($service in $manifest.services) {
            $accessMode = $service.config | Where-Object { $_.key -eq 'accessMode' }
            $accessMode.default = 'coding_plan'
            $accessMode.options = @($accessModes | ForEach-Object {
                [pscustomobject]@{ label = $_.title; value = $_.value }
            })
            $accessMode.description = $notice

            $model = $service.config | Where-Object { $_.key -eq 'model' }
            $codingModels = if ($service.id -eq 'ocr') { $codingOcrModels } else { $codingTranslationModels }
            $existing = @($model.options)
            $codingIds = @($codingModels | ForEach-Object { $_.value })
            $model.options = @($codingModels | ForEach-Object {
                [pscustomobject]@{ label = $_.title; value = $_.value }
            }) + @($existing | Where-Object { $_.value -notin $codingIds })
        }
    }
    else {
        $manifest.summary = "Personal Coding Plan profile. $notice"
        $accessMode = $manifest.options | Where-Object { $_.identifier -eq 'accessMode' }
        $accessMode.defaultValue = 'coding_plan'
        $accessMode.menuValues = $accessModes
        $accessMode.desc = $notice

        $model = $manifest.options | Where-Object { $_.identifier -eq 'modelPreset' }
        $codingModels = if ($Kind -eq 'BobOcr') { $codingOcrModels } else { $codingTranslationModels }
        $existing = @($model.menuValues)
        $codingIds = @($codingModels | ForEach-Object { $_.value })
        $model.menuValues = $codingModels + @($existing | Where-Object { $_.value -notin $codingIds })
    }

    $manifest | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $ManifestPath -Encoding utf8NoBOM
}

function Add-PersonalCodingNotice {
    param([string]$DestinationDirectory)
    if ($Profile -ne 'PersonalCoding') { return }
    @(
        'UNSUPPORTED PERSONAL CODING PLAN BUILD',
        '',
        'Alibaba Cloud currently prohibits Coding Plan API keys in custom applications.',
        'Do not use this profile unless Alibaba Cloud gives you written compatibility confirmation.',
        'This build is intentionally excluded from public releases and Bob/Manggo indexes.'
    ) | Set-Content -LiteralPath (Join-Path $DestinationDirectory 'CODING-PLAN-NOTICE.txt') -Encoding utf8NoBOM
}

$manggoStage = Join-Path $stagingRoot 'manggo'
New-Item -ItemType Directory -Path $manggoStage -Force | Out-Null
@('manggo.plugin.json', 'main.js', 'README.md', 'LICENSE', 'icon.png') | ForEach-Object {
    Copy-RootFile -Source $_ -DestinationDirectory $manggoStage
}
Set-PersonalCodingManifest -ManifestPath (Join-Path $manggoStage 'manggo.plugin.json') -Kind 'Manggo'
Add-PersonalCodingNotice -DestinationDirectory $manggoStage
Set-RuntimeProfile -DestinationDirectory $manggoStage
$manggoPackage = New-PluginArchive -SourceDirectory $manggoStage -OutputName "manggo-bailian$packageSuffix-$version.mplugin"

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
    $kind = if ($Platform -eq 'bob-ocr') { 'BobOcr' } else { 'BobTranslate' }
    Set-PersonalCodingManifest -ManifestPath (Join-Path $stage 'info.json') -Kind $kind
    Add-PersonalCodingNotice -DestinationDirectory $stage
    Set-RuntimeProfile -DestinationDirectory $stage
    return (New-PluginArchive -SourceDirectory $stage -OutputName $PackageName)
}

$translatePackage = New-BobPackage -Platform 'bob-translate' -PackageName "bob-bailian-translate$packageSuffix-$version.bobplugin"
$ocrPackage = New-BobPackage -Platform 'bob-ocr' -PackageName "bob-bailian-ocr$packageSuffix-$version.bobplugin"

$profileVerifier = Join-Path $repoRoot 'scripts/verify-package-profile.mjs'
& node $profileVerifier $Profile $manggoStage (Join-Path $stagingRoot 'bob-translate') (Join-Path $stagingRoot 'bob-ocr')
if ($LASTEXITCODE -ne 0) {
    throw "Runtime profile verification failed for $Profile."
}

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

function Assert-ArchiveProfile {
    param(
        [string]$ArchivePath,
        [string]$ManifestEntry
    )
    $archive = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
    try {
        $developmentMarker = '__BAILIAN_RUNTIME_PROFILE_DEVELOPMENT__'
        $expectedMarker = if ($Profile -eq 'PersonalCoding') {
            '__BAILIAN_RUNTIME_PROFILE_PERSONAL__'
        }
        else {
            '__BAILIAN_RUNTIME_PROFILE_PUBLIC__'
        }
        $runtimeMatched = $false
        foreach ($entry in $archive.Entries | Where-Object { $_.FullName -match '\.js$' }) {
            $reader = [System.IO.StreamReader]::new($entry.Open())
            try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() }
            if ($content.Contains($developmentMarker)) {
                throw "$(Split-Path -Leaf $ArchivePath) contains an uninjected development runtime profile."
            }
            if ($content.Contains($expectedMarker)) { $runtimeMatched = $true }
        }
        if (-not $runtimeMatched) {
            throw "$(Split-Path -Leaf $ArchivePath) does not contain its expected runtime profile."
        }

        $manifest = $archive.Entries | Where-Object { $_.FullName -eq $ManifestEntry }
        $reader = [System.IO.StreamReader]::new($manifest.Open())
        try { $manifestText = $reader.ReadToEnd() } finally { $reader.Dispose() }
        $hasCodingOption = $manifestText -match '"(value|default|defaultValue)"\s*:\s*"coding_plan"'
        if ($Profile -eq 'PersonalCoding' -and -not $hasCodingOption) {
            throw "$(Split-Path -Leaf $ArchivePath) is missing the personal Coding Plan option."
        }
        if ($Profile -eq 'Public' -and $hasCodingOption) {
            throw "$(Split-Path -Leaf $ArchivePath) exposes Coding Plan in its public manifest."
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
Assert-ArchiveProfile -ArchivePath $manggoPackage -ManifestEntry 'manggo.plugin.json'
Assert-ArchiveProfile -ArchivePath $translatePackage -ManifestEntry 'info.json'
Assert-ArchiveProfile -ArchivePath $ocrPackage -ManifestEntry 'info.json'

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
