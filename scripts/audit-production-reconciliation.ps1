<#
.SYNOPSIS
Collect sanitised, read-only Production evidence for the Main reconciliation map.

.DESCRIPTION
This script uses the existing Windows-encrypted Supabase access file. It never
prints or stores the token, does not apply migrations, and does not dump table
data. Its outputs are a public-schema definition, migration versions, deployed
Edge Function metadata and a small Git/Supabase manifest.
#>

[CmdletBinding()]
param(
    [string]$OutputDirectory = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProductionProjectRef = "svierarfcolhcfjpmwck"
$RepositoryRoot = Split-Path $PSScriptRoot -Parent
$CredentialPath = Join-Path $env:LOCALAPPDATA "SportStack\release\player-mvp-tally-production-access.json"

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $RepositoryRoot "outputs\production-reconciliation-2026-09-06"
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
    if ($LASTEXITCODE -ne 0) {
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
    $requiredPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()) + "sportstack-production-audit-"
    if (-not $resolved.StartsWith($requiredPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove an unexpected temporary path: $resolved"
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}

if (-not (Test-Path -LiteralPath $CredentialPath)) {
    throw "Production access is not configured. Run the guarded release access setup first."
}

$configuration = Get-Content -Raw -LiteralPath $CredentialPath | ConvertFrom-Json
if ($configuration.version -ne 1 -or $configuration.expectedProductionProjectRef -ne $ProductionProjectRef) {
    throw "The encrypted access file is not pinned to SportStack Production."
}

$token = ConvertTo-PlainText -SecureValue (ConvertTo-SecureString -String $configuration.encryptedSupabaseToken)
$previousToken = $env:SUPABASE_ACCESS_TOKEN
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) (
    "sportstack-production-audit-" + [guid]::NewGuid().ToString("N")
)

try {
    $env:SUPABASE_ACCESS_TOKEN = $token
    New-Item -ItemType Directory -Path (Join-Path $temporaryRoot "supabase\migrations") -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $RepositoryRoot "supabase\config.toml") -Destination (Join-Path $temporaryRoot "supabase\config.toml")
    New-Item -ItemType Directory -Path $OutputDirectory | Out-Null

    Invoke-CheckedCommand -Command "supabase" -Arguments @(
        "link", "--project-ref", $ProductionProjectRef, "--workdir", $temporaryRoot, "--yes"
    ) | Out-Null

    $migrationList = Invoke-CheckedCommand -Command "supabase" -Arguments @(
        "migration", "list", "--linked", "--workdir", $temporaryRoot
    )
    $migrationVersions = @(
        [regex]::Matches($migrationList, "(?m)\b20\d{12}\b") |
            ForEach-Object { $_.Value } |
            Sort-Object -Unique
    )
    if ($migrationVersions.Count -eq 0) {
        throw "No Production migration history was returned."
    }
    $migrationVersions | ConvertTo-Json |
        Set-Content -LiteralPath (Join-Path $OutputDirectory "production-migration-versions.json") -Encoding utf8

    $functionJson = Invoke-CheckedCommand -Command "supabase" -Arguments @(
        "functions", "list", "--project-ref", $ProductionProjectRef, "--output", "json"
    )
    $functionRows = @($functionJson | ConvertFrom-Json)
    $safeFunctionRows = @(
        $functionRows | ForEach-Object {
            [ordered]@{
                slug = $_.slug
                version = $_.version
                status = $_.status
                verify_jwt = $_.verify_jwt
                created_at = $_.created_at
                updated_at = $_.updated_at
            }
        }
    )
    $safeFunctionRows | ConvertTo-Json -Depth 4 |
        Set-Content -LiteralPath (Join-Path $OutputDirectory "production-edge-functions.json") -Encoding utf8

    # Download deployed source through the read-only Management API so its
    # content can be compared with Main without deploying or invoking it.
    $functionDownloadRoot = Join-Path $OutputDirectory "deployed-functions"
    New-Item -ItemType Directory -Path (Join-Path $functionDownloadRoot "supabase\functions") -Force | Out-Null
    Invoke-CheckedCommand -Command "supabase" -Arguments @(
        "functions", "download", "--project-ref", $ProductionProjectRef,
        "--use-api", "--workdir", $functionDownloadRoot
    ) | Out-Null

    $schemaPath = Join-Path $OutputDirectory "production-public-schema.sql"
    Invoke-CheckedCommand -Command "supabase" -Arguments @(
        "db", "dump", "--linked", "--workdir", $temporaryRoot, "--schema", "public", "--file", $schemaPath
    ) | Out-Null
    if (-not (Test-Path -LiteralPath $schemaPath) -or (Get-Item -LiteralPath $schemaPath).Length -eq 0) {
        throw "The Production public-schema dump was not created."
    }

    $manifest = [ordered]@{
        created_at = (Get-Date).ToString("o")
        mode = "read-only"
        production_project_ref = $ProductionProjectRef
        production_git_commit = (Invoke-CheckedCommand -Command "git" -Arguments @("rev-parse", "origin/prod"))
        main_git_commit = (Invoke-CheckedCommand -Command "git" -Arguments @("rev-parse", "origin/main"))
        migration_count = $migrationVersions.Count
        edge_function_count = $safeFunctionRows.Count
        edge_function_source_downloaded = $true
        schema_sha256 = (Get-FileHash -LiteralPath $schemaPath -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    $manifest | ConvertTo-Json -Depth 4 |
        Set-Content -LiteralPath (Join-Path $OutputDirectory "manifest.json") -Encoding utf8

    Write-Host "PRODUCTION_RECONCILIATION_AUDIT_OK" -ForegroundColor Green
    Write-Host "Output: $OutputDirectory"
    Write-Host "Migrations: $($migrationVersions.Count)"
    Write-Host "Edge Functions: $($safeFunctionRows.Count)"
}
finally {
    $env:SUPABASE_ACCESS_TOKEN = $previousToken
    $token = $null
    Remove-VerifiedTemporaryDirectory -Path $temporaryRoot
}
