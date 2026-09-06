<#
.SYNOPSIS
Collect aggregate-only B1c membership evidence from Dev and Production.

.DESCRIPTION
Uses the existing Windows-encrypted Supabase access token without printing or
persisting it. The script runs one read-only aggregate query against each
hosted project. It never returns identifiers or changes either database.
#>

[CmdletBinding()]
param(
    [string]$OutputDirectory = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepositoryRoot = Split-Path $PSScriptRoot -Parent
$CredentialPath = Join-Path $env:LOCALAPPDATA "SportStack\release\player-mvp-tally-production-access.json"
$InventoryPath = Join-Path $PSScriptRoot "sql\b1-membership-live-inventory.sql"
$Targets = @(
    [ordered]@{ Name = "dev"; ProjectRef = "icqegnpjbizccjebjfhb" },
    [ordered]@{ Name = "production"; ProjectRef = "svierarfcolhcfjpmwck" }
)

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $RepositoryRoot "outputs\b1-membership-audit-2026-09-06"
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$AllowedOutputRoot = [IO.Path]::GetFullPath((Join-Path $RepositoryRoot "outputs"))
if (-not $OutputDirectory.StartsWith($AllowedOutputRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "The audit output must stay under the repository outputs directory."
}
if (Test-Path -LiteralPath $OutputDirectory) {
    throw "The audit output directory already exists: $OutputDirectory"
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory)]
        [string]$Command,

        [string[]]$Arguments = @()
    )

    $result = & $Command @Arguments 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0 -or $result -match '"_tag"\s*:\s*"Error"') {
        throw "$Command failed.`n$result"
    }
    return $result.Trim()
}

function ConvertTo-PlainText {
    param([Security.SecureString]$SecureValue)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Remove-VerifiedTemporaryDirectory {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }
    $resolved = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path).Path)
    $requiredPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()) + "sportstack-b1-membership-audit-"
    if (-not $resolved.StartsWith($requiredPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove an unexpected temporary path: $resolved"
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}

if (-not (Test-Path -LiteralPath $CredentialPath)) {
    throw "Encrypted Supabase access is not configured."
}
if (-not (Test-Path -LiteralPath $InventoryPath)) {
    throw "The B1c inventory query is missing."
}

$configuration = Get-Content -Raw -LiteralPath $CredentialPath | ConvertFrom-Json
if ($configuration.version -ne 1 -or $configuration.expectedProductionProjectRef -ne "svierarfcolhcfjpmwck") {
    throw "The encrypted access file is not pinned to SportStack Production."
}

$token = ConvertTo-PlainText -SecureValue (ConvertTo-SecureString -String $configuration.encryptedSupabaseToken)
$previousToken = $env:SUPABASE_ACCESS_TOKEN
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) (
    "sportstack-b1-membership-audit-" + [guid]::NewGuid().ToString("N")
)

try {
    $env:SUPABASE_ACCESS_TOKEN = $token
    New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
    $manifestTargets = @()

    foreach ($target in $Targets) {
        $targetTemporaryRoot = Join-Path $temporaryRoot $target.Name
        $targetOutputRoot = Join-Path $OutputDirectory $target.Name
        New-Item -ItemType Directory -Path (Join-Path $targetTemporaryRoot "supabase\migrations") -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $RepositoryRoot "supabase\config.toml") -Destination (Join-Path $targetTemporaryRoot "supabase\config.toml")
        New-Item -ItemType Directory -Path $targetOutputRoot -Force | Out-Null

        Invoke-CheckedCommand -Command "supabase" -Arguments @(
            "link", "--project-ref", $target.ProjectRef, "--workdir", $targetTemporaryRoot, "--yes"
        ) | Out-Null

        $inventoryJson = Invoke-CheckedCommand -Command "supabase" -Arguments @(
            "db", "query", "--linked", "--workdir", $targetTemporaryRoot,
            "--file", $InventoryPath, "--output-format", "json"
        )
        $inventoryJson | Set-Content -LiteralPath (Join-Path $targetOutputRoot "membership-inventory.json") -Encoding utf8

        $manifestTargets += [ordered]@{
            name = $target.Name
            project_ref = $target.ProjectRef
            inventory_sha256 = (Get-FileHash -LiteralPath (Join-Path $targetOutputRoot "membership-inventory.json") -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }

    [ordered]@{
        created_at = (Get-Date).ToString("o")
        mode = "read-only-aggregate-only"
        git_commit = (Invoke-CheckedCommand -Command "git" -Arguments @("rev-parse", "HEAD"))
        targets = $manifestTargets
    } | ConvertTo-Json -Depth 5 |
        Set-Content -LiteralPath (Join-Path $OutputDirectory "manifest.json") -Encoding utf8

    Write-Host "B1_MEMBERSHIP_ENVIRONMENT_AUDIT_OK" -ForegroundColor Green
    Write-Host "Output: $OutputDirectory"
}
finally {
    $env:SUPABASE_ACCESS_TOKEN = $previousToken
    $token = $null
    Remove-VerifiedTemporaryDirectory -Path $temporaryRoot
}
