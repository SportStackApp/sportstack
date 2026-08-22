<#
.SYNOPSIS
Publishes the committed SportStack Markdown notes into Aaron's Big Brain Obsidian vault.

.DESCRIPTION
The repository remains the source of truth. The script exports an exact, verified mirror from a
Git ref (origin/dev by default), so it never depends on the currently checked-out feature branch or
on uncommitted files. Only the whitelisted Markdown locations in obsidian-note-sync.json are copied.

Use -Fetch to refresh origin/dev before publishing. Use -Check to verify the existing mirror without
changing it. Generated mirror files may be replaced or removed only when the previous sync manifest
proves that this script owns them.
#>

[CmdletBinding()]
param(
    [string]$VaultPath,
    [string]$SourceRef,
    [switch]$Fetch,
    [switch]$Check
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Resolve repository-owned configuration from the script location, not the caller's current folder.
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $scriptDirectory '..'))
$configurationPath = Join-Path $repositoryRoot 'config\obsidian-note-sync.json'

if (-not (Test-Path -LiteralPath $configurationPath -PathType Leaf)) {
    throw "Obsidian note-sync configuration was not found: $configurationPath"
}

$configuration = Get-Content -LiteralPath $configurationPath -Raw | ConvertFrom-Json
if ($configuration.schemaVersion -ne 1) {
    throw "Unsupported Obsidian note-sync schema version: $($configuration.schemaVersion)"
}

# Prefer an explicit path, then an environment override, then the user's normal Documents folder.
if ([string]::IsNullOrWhiteSpace($VaultPath)) {
    if (-not [string]::IsNullOrWhiteSpace($env:SPORTSTACK_OBSIDIAN_VAULT)) {
        $VaultPath = $env:SPORTSTACK_OBSIDIAN_VAULT
    }
    else {
        $documentsDirectory = [Environment]::GetFolderPath([Environment+SpecialFolder]::MyDocuments)
        $VaultPath = Join-Path $documentsDirectory 'Big Brain'
    }
}

if ([string]::IsNullOrWhiteSpace($SourceRef)) {
    $SourceRef = [string]$configuration.defaultSourceRef
}

$resolvedVaultPath = [IO.Path]::GetFullPath($VaultPath)
$obsidianConfigurationDirectory = Join-Path $resolvedVaultPath '.obsidian'
if (-not (Test-Path -LiteralPath $obsidianConfigurationDirectory -PathType Container)) {
    throw "Refusing to sync because the target is not an Obsidian vault: $resolvedVaultPath"
}

$mirrorRoot = [IO.Path]::GetFullPath(
    (Join-Path $resolvedVaultPath ([string]$configuration.vaultRelativeRoot))
)
$manifestPath = Join-Path $mirrorRoot '_sync-manifest.json'
$indexPath = Join-Path $mirrorRoot '_Index.md'

# Store a small local audit log without putting machine logs or paths into the repository.
$localLogRoot = if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    Join-Path $env:LOCALAPPDATA 'SportStack\logs'
}
else {
    Join-Path ([IO.Path]::GetTempPath()) 'SportStack\logs'
}
$localLogPath = Join-Path $localLogRoot 'obsidian-note-sync.log'

function Write-SyncLog {
    param([string]$Message)

    New-Item -ItemType Directory -Path $localLogRoot -Force | Out-Null
    $line = '{0} {1}' -f (Get-Date).ToString('o'), $Message
    Add-Content -LiteralPath $localLogPath -Value $line -Encoding UTF8
    Write-Output $Message
}

function Assert-PathInsideRoot {
    param(
        [string]$CandidatePath,
        [string]$ExpectedRoot,
        [string]$Description
    )

    $candidate = [IO.Path]::GetFullPath($CandidatePath)
    $root = [IO.Path]::GetFullPath($ExpectedRoot).TrimEnd('\') + '\'
    if (-not $candidate.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
        throw "$Description resolved outside its allowed root: $candidate"
    }
}

function Invoke-Git {
    param([string[]]$Arguments)

    $output = & git -C $repositoryRoot @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Arguments -join ' ')`n$($output -join [Environment]::NewLine)"
    }
    return @($output)
}

if ($Fetch) {
    Invoke-Git -Arguments @('fetch', 'origin', 'dev', '--quiet') | Out-Null
}

$sourceCommit = ([string](Invoke-Git -Arguments @('rev-parse', '--verify', "$SourceRef^{commit}"))).Trim()
$trackedPaths = @(Invoke-Git -Arguments @('ls-tree', '-r', '--name-only', $SourceRef))

# Build the exact whitelist from tracked Git paths. SQL backups, data files and secrets are excluded.
$selectedPaths = [System.Collections.Generic.List[string]]::new()
$allowedExtensions = @($configuration.include.extensions | ForEach-Object { $_.ToLowerInvariant() })

foreach ($trackedPath in $trackedPaths) {
    $normalisedPath = $trackedPath.Replace('\', '/')
    $extension = [IO.Path]::GetExtension($normalisedPath).ToLowerInvariant()

    if ($configuration.include.rootMarkdown -and
        -not $normalisedPath.Contains('/') -and
        $allowedExtensions -contains $extension) {
        $selectedPaths.Add($normalisedPath)
        continue
    }

    foreach ($includedDirectory in @($configuration.include.directories)) {
        $prefix = ([string]$includedDirectory).TrimEnd('/') + '/'
        if ($normalisedPath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) -and
            $allowedExtensions -contains $extension) {
            $selectedPaths.Add($normalisedPath)
            break
        }
    }
}

$destinationOverrides = @{}
foreach ($additionalFile in @($configuration.include.additionalFiles)) {
    $additionalSource = ([string]$additionalFile.source).Replace('\', '/')
    if ($trackedPaths -notcontains $additionalSource) {
        throw "Configured additional note is not tracked at ${SourceRef}: $additionalSource"
    }
    $selectedPaths.Add($additionalSource)
    $destinationOverrides[$additionalSource] = ([string]$additionalFile.destination).Replace('\', '/')
}

$selectedPaths = @($selectedPaths | Sort-Object -Unique)
if ($selectedPaths.Count -eq 0) {
    throw "No repository notes matched the sync whitelist at $SourceRef"
}

# Export from Git into a private temporary folder so a feature checkout cannot leak into the mirror.
$systemTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$temporaryRoot = Join-Path $systemTempRoot ("sportstack-note-sync-" + [Guid]::NewGuid().ToString('N'))
$archivePath = Join-Path $temporaryRoot 'notes.zip'
$extractRoot = Join-Path $temporaryRoot 'source'

New-Item -ItemType Directory -Path $temporaryRoot -Force | Out-Null
Assert-PathInsideRoot -CandidatePath $temporaryRoot -ExpectedRoot $systemTempRoot -Description 'Temporary sync folder'

try {
    $archiveArguments = @(
        'archive',
        '--format=zip',
        "--output=$archivePath",
        $SourceRef,
        '--'
    ) + $selectedPaths
    Invoke-Git -Arguments $archiveArguments | Out-Null
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractRoot -Force

    $records = [System.Collections.Generic.List[object]]::new()
    foreach ($sourcePath in $selectedPaths) {
        $destinationRelativePath = if ($destinationOverrides.ContainsKey($sourcePath)) {
            [string]$destinationOverrides[$sourcePath]
        }
        elseif ($sourcePath.Contains('/')) {
            $sourcePath
        }
        else {
            "Root/$sourcePath"
        }

        $sourceFile = Join-Path $extractRoot ($sourcePath.Replace('/', '\'))
        $destinationFile = Join-Path $mirrorRoot ($destinationRelativePath.Replace('/', '\'))
        Assert-PathInsideRoot -CandidatePath $destinationFile -ExpectedRoot $mirrorRoot -Description 'Mirror note'

        if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) {
            throw "Archived source note is missing: $sourcePath"
        }

        $sourceHash = (Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash
        $records.Add([pscustomobject]@{
            source = $sourcePath
            destination = $destinationRelativePath
            sha256 = $sourceHash
        })
    }

    $verificationErrors = [System.Collections.Generic.List[string]]::new()
    foreach ($record in $records) {
        $destinationFile = Join-Path $mirrorRoot ($record.destination.Replace('/', '\'))
        if (-not (Test-Path -LiteralPath $destinationFile -PathType Leaf)) {
            $verificationErrors.Add("Missing mirror note: $($record.destination)")
            continue
        }

        $destinationHash = (Get-FileHash -LiteralPath $destinationFile -Algorithm SHA256).Hash
        if ($destinationHash -ne $record.sha256) {
            $verificationErrors.Add("Changed mirror note: $($record.destination)")
        }
    }

    foreach ($curatedRelativePath in @($configuration.curatedNotes)) {
        $curatedPath = Join-Path $resolvedVaultPath ([string]$curatedRelativePath)
        Assert-PathInsideRoot -CandidatePath $curatedPath -ExpectedRoot $resolvedVaultPath -Description 'Curated vault note'
        if (-not (Test-Path -LiteralPath $curatedPath -PathType Leaf)) {
            $verificationErrors.Add("Missing curated vault note: $curatedRelativePath")
        }
    }

    if ($Check) {
        if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
            $verificationErrors.Add('Missing mirror manifest: _sync-manifest.json')
        }
        else {
            $existingManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
            if ($existingManifest.sourceCommit -ne $sourceCommit) {
                $verificationErrors.Add(
                    "Mirror commit is $($existingManifest.sourceCommit), expected $sourceCommit"
                )
            }
        }

        if ($verificationErrors.Count -gt 0) {
            $message = "CHECK_FAILED ref=$SourceRef commit=$sourceCommit issues=$($verificationErrors.Count): " +
                ($verificationErrors -join '; ')
            Write-SyncLog -Message $message
            throw $message
        }

        Write-SyncLog -Message (
            "CHECK_OK ref=$SourceRef commit=$sourceCommit files=$($records.Count) vault=$resolvedVaultPath"
        )
        return
    }

    New-Item -ItemType Directory -Path $mirrorRoot -Force | Out-Null

    # Remove only stale files listed in the prior generated manifest. Other vault files are untouched.
    if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
        $previousManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        $currentDestinations = @($records | ForEach-Object { $_.destination })
        foreach ($previousRecord in @($previousManifest.files)) {
            if ($currentDestinations -notcontains $previousRecord.destination) {
                $stalePath = Join-Path $mirrorRoot ($previousRecord.destination.Replace('/', '\'))
                Assert-PathInsideRoot -CandidatePath $stalePath -ExpectedRoot $mirrorRoot -Description 'Stale mirror note'
                if (Test-Path -LiteralPath $stalePath -PathType Leaf) {
                    Remove-Item -LiteralPath $stalePath -Force
                }
            }
        }
    }

    foreach ($record in $records) {
        $sourceFile = Join-Path $extractRoot ($record.source.Replace('/', '\'))
        $destinationFile = Join-Path $mirrorRoot ($record.destination.Replace('/', '\'))
        $destinationDirectory = Split-Path -Parent $destinationFile
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
        Copy-Item -LiteralPath $sourceFile -Destination $destinationFile -Force
    }

    # Generate a navigable Obsidian index and a machine-readable verification manifest.
    $syncTimestamp = (Get-Date).ToString('o')
    $indexLines = [System.Collections.Generic.List[string]]::new()
    @(
        '---',
        'type: generated-index',
        'status: active',
        "updated: $((Get-Date).ToString('yyyy-MM-dd'))",
        "source_commit: $sourceCommit",
        'tags: [sportstack, generated, repository-notes]',
        '---',
        '# SportStack Repository Notes',
        '',
        '> [!warning] Managed mirror',
        '> These files are generated from the committed SportStack repository. Edit the repository',
        '> source, then run the sync again. Do not edit generated mirror files directly.',
        '',
        ('- Source ref: `{0}`' -f $SourceRef),
        ('- Source commit: `{0}`' -f $sourceCommit),
        "- Synced: $syncTimestamp",
        '',
        '## Notes'
    ) | ForEach-Object { $indexLines.Add($_) }

    foreach ($record in @($records | Sort-Object destination)) {
        $linkPath = $record.destination.Replace('\', '/') -replace '\.md$', ''
        $indexLines.Add("- [[$linkPath|$($record.source)]]")
    }
    Set-Content -LiteralPath $indexPath -Value $indexLines -Encoding UTF8

    $manifest = [ordered]@{
        schemaVersion = 1
        sourceRef = $SourceRef
        sourceCommit = $sourceCommit
        syncedAt = $syncTimestamp
        fileCount = $records.Count
        files = @($records)
    }
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

    # Re-hash every destination after writing. A successful sync is not reported without proof.
    foreach ($record in $records) {
        $destinationFile = Join-Path $mirrorRoot ($record.destination.Replace('/', '\'))
        $destinationHash = (Get-FileHash -LiteralPath $destinationFile -Algorithm SHA256).Hash
        if ($destinationHash -ne $record.sha256) {
            throw "Post-sync verification failed for $($record.destination)"
        }
    }

    Write-SyncLog -Message (
        "SYNC_OK ref=$SourceRef commit=$sourceCommit files=$($records.Count) vault=$resolvedVaultPath"
    )
}
finally {
    # The recursive delete is restricted to the unique task folder created under the OS temp root.
    if (Test-Path -LiteralPath $temporaryRoot) {
        Assert-PathInsideRoot -CandidatePath $temporaryRoot -ExpectedRoot $systemTempRoot -Description 'Temporary cleanup folder'
        if ((Split-Path -Leaf $temporaryRoot) -notlike 'sportstack-note-sync-*') {
            throw "Refusing unexpected temporary cleanup target: $temporaryRoot"
        }
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}
