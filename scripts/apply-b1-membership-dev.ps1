<#
.SYNOPSIS
Apply one exact B1 compatibility migration to the pinned Development project.

.DESCRIPTION
Uses the existing Windows-encrypted Supabase access token without printing it.
The target is hard-coded to SportStack Dev. The B1c defaults remain backward
compatible, while another B1 migration can be selected through parameters.
Protected row counts are checked before and after, and the migration version
is recorded only after the SQL completes successfully.
#>

[CmdletBinding()]
param(
    [string]$MigrationVersion = "20260906095820",
    [string]$MigrationName = "b1_membership_workflow_compatibility",
    [string]$SuccessMarker = "B1_MEMBERSHIP_DEV_APPLY_OK",
    [string]$RuntimeVerificationPath,
    [switch]$VerificationOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepositoryRoot = Split-Path $PSScriptRoot -Parent
$MigrationsRoot = [IO.Path]::GetFullPath((Join-Path $RepositoryRoot "supabase\migrations"))
$CredentialPath = Join-Path $env:LOCALAPPDATA "SportStack\release\player-mvp-tally-production-access.json"
$DevelopmentProjectRef = "icqegnpjbizccjebjfhb"

if ($MigrationVersion -notmatch '^[0-9]{14}$') {
    throw "MigrationVersion must contain exactly 14 digits."
}
if ($MigrationName -notmatch '^[a-z0-9_]+$') {
    throw "MigrationName may contain only lower-case letters, digits and underscores."
}
if ($SuccessMarker -notmatch '^[A-Z0-9_]+$') {
    throw "SuccessMarker may contain only upper-case letters, digits and underscores."
}

$MigrationPath = [IO.Path]::GetFullPath((
    Join-Path $MigrationsRoot "${MigrationVersion}_${MigrationName}.sql"
))
$RequiredMigrationPrefix = $MigrationsRoot + [IO.Path]::DirectorySeparatorChar
if (-not $MigrationPath.StartsWith($RequiredMigrationPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "The selected migration must remain inside the repository migrations folder."
}

$ResolvedRuntimeVerificationPath = $null
if (-not [string]::IsNullOrWhiteSpace($RuntimeVerificationPath)) {
    $VerificationRoot = [IO.Path]::GetFullPath((Join-Path $RepositoryRoot "scripts\sql"))
    $ResolvedRuntimeVerificationPath = [IO.Path]::GetFullPath((
        Join-Path $RepositoryRoot $RuntimeVerificationPath
    ))
    $RequiredVerificationPrefix = $VerificationRoot + [IO.Path]::DirectorySeparatorChar
    if (-not $ResolvedRuntimeVerificationPath.StartsWith(
        $RequiredVerificationPrefix,
        [StringComparison]::OrdinalIgnoreCase
    )) {
        throw "RuntimeVerificationPath must remain inside scripts/sql."
    }
    if (-not (Test-Path -LiteralPath $ResolvedRuntimeVerificationPath)) {
        throw "The selected runtime verification SQL is missing."
    }
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
    $requiredPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()) + "sportstack-b1-membership-apply-"
    if (-not $resolved.StartsWith($requiredPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove an unexpected temporary path: $resolved"
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}

function Invoke-Supabase {
    param([string[]]$Arguments)

    $output = & supabase @Arguments 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0 -or $output -match '"_tag"\s*:\s*"Error"') {
        throw "Supabase command failed.`n$output"
    }
    return $output.Trim()
}

function Get-ProtectedCounts {
    param([string]$Workdir)

    $sql = @"
select json_build_object(
  'profiles', (select count(*) from public.profiles),
  'team_memberships', (select count(*) from public.team_memberships),
  'primary_change_requests', (select count(*) from public.primary_change_requests)
) as protected_counts;
"@
    $json = Invoke-Supabase -Arguments @(
        "db", "query", "--linked", "--workdir", $Workdir,
        $sql, "--output-format", "json"
    )
    $jsonMatch = [regex]::Match($json, '(?s)(\{.*\})\s*$')
    if (-not $jsonMatch.Success) {
        throw "The Development count query did not return JSON."
    }
    $parsed = $jsonMatch.Groups[1].Value | ConvertFrom-Json
    return $parsed.rows[0].protected_counts
}

if (-not (Test-Path -LiteralPath $MigrationPath)) {
    throw "The selected B1 migration is missing."
}
if (-not (Test-Path -LiteralPath $CredentialPath)) {
    throw "Encrypted Supabase access is not configured."
}

$configuration = Get-Content -Raw -LiteralPath $CredentialPath | ConvertFrom-Json
if ($configuration.version -ne 1 -or $configuration.expectedProductionProjectRef -ne "svierarfcolhcfjpmwck") {
    throw "The encrypted access file has unexpected metadata."
}

$token = ConvertTo-PlainText -SecureValue (ConvertTo-SecureString -String $configuration.encryptedSupabaseToken)
$previousToken = $env:SUPABASE_ACCESS_TOKEN
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) (
    "sportstack-b1-membership-apply-" + [guid]::NewGuid().ToString("N")
)

try {
    $env:SUPABASE_ACCESS_TOKEN = $token
    New-Item -ItemType Directory -Path (Join-Path $temporaryRoot "supabase\migrations") -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $RepositoryRoot "supabase\config.toml") -Destination (Join-Path $temporaryRoot "supabase\config.toml")
    Copy-Item -LiteralPath $MigrationPath -Destination (Join-Path $temporaryRoot "supabase\migrations\$(Split-Path $MigrationPath -Leaf)")

    Invoke-Supabase -Arguments @(
        "link", "--project-ref", $DevelopmentProjectRef,
        "--workdir", $temporaryRoot, "--yes"
    ) | Out-Null

    $before = Get-ProtectedCounts -Workdir $temporaryRoot
    if (-not $VerificationOnly) {
        Invoke-Supabase -Arguments @(
            "db", "query", "--linked", "--workdir", $temporaryRoot,
            "--file", $MigrationPath
        ) | Out-Null
        Invoke-Supabase -Arguments @(
            "migration", "repair", $MigrationVersion,
            "--status", "applied", "--linked", "--workdir", $temporaryRoot, "--yes"
        ) | Out-Null
    }
    $after = Get-ProtectedCounts -Workdir $temporaryRoot

    if (($before | ConvertTo-Json -Compress) -ne ($after | ConvertTo-Json -Compress)) {
        throw "Protected Development row counts changed during the selected B1 migration."
    }

    $historySql = "select count(*)::int as recorded from supabase_migrations.schema_migrations where version = '$MigrationVersion';"
    $historyOutput = Invoke-Supabase -Arguments @(
        "db", "query", "--linked", "--workdir", $temporaryRoot,
        $historySql, "--output-format", "json"
    )
    $historyMatch = [regex]::Match($historyOutput, '(?s)(\{.*\})\s*$')
    if (-not $historyMatch.Success) {
        throw "The Development history query did not return JSON."
    }
    $historyJson = $historyMatch.Groups[1].Value | ConvertFrom-Json
    if ($historyJson.rows[0].recorded -ne 1) {
        throw "The selected B1 Development migration version was not recorded exactly once."
    }

    Invoke-Supabase -Arguments @(
        "db", "lint", "--linked", "--workdir", $temporaryRoot,
        "--level", "error", "--fail-on", "error"
    ) | Out-Null

    if ($null -ne $ResolvedRuntimeVerificationPath) {
        $verificationOutput = Invoke-Supabase -Arguments @(
            "db", "query", "--linked", "--workdir", $temporaryRoot,
            "--file", $ResolvedRuntimeVerificationPath
        )
        if ($verificationOutput -notmatch 'B1_ADMIN_MEMBERSHIP_RUNTIME_OK') {
            throw "The Development runtime verification marker was not returned."
        }

        $rollbackOutput = Invoke-Supabase -Arguments @(
            "db", "query", "--linked", "--workdir", $temporaryRoot,
            "select count(*)::int as leaked from auth.users where email like 'b1e-%@example.invalid';",
            "--output-format", "json"
        )
        $rollbackMatch = [regex]::Match($rollbackOutput, '(?s)(\{.*\})\s*$')
        if (-not $rollbackMatch.Success) {
            throw "The Development rollback query did not return JSON."
        }
        $rollbackJson = $rollbackMatch.Groups[1].Value | ConvertFrom-Json
        if ($rollbackJson.rows[0].leaked -ne 0) {
            throw "The rollback-only Development runtime check left fixture users behind."
        }
    }

    Write-Host $SuccessMarker -ForegroundColor Green
}
finally {
    $env:SUPABASE_ACCESS_TOKEN = $previousToken
    $token = $null
    Remove-VerifiedTemporaryDirectory -Path $temporaryRoot
}
