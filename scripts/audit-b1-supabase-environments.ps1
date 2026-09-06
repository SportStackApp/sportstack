<#
.SYNOPSIS
Collect read-only Dev and Production schema evidence for B1 reconciliation.

.DESCRIPTION
Uses the existing Windows-encrypted Supabase access token without printing or
persisting it. The script captures only migration versions, Edge Function
metadata and public/private schema definitions. It never dumps table data or
changes either hosted project.
#>

[CmdletBinding()]
param(
    [string]$OutputDirectory = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepositoryRoot = Split-Path $PSScriptRoot -Parent
$CredentialPath = Join-Path $env:LOCALAPPDATA "SportStack\release\player-mvp-tally-production-access.json"
$Targets = @(
    [ordered]@{ Name = "dev"; ProjectRef = "icqegnpjbizccjebjfhb" },
    [ordered]@{ Name = "production"; ProjectRef = "svierarfcolhcfjpmwck" }
)

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $RepositoryRoot "outputs\b1-environment-audit-2026-09-06"
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
    $requiredPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()) + "sportstack-b1-audit-"
    if (-not $resolved.StartsWith($requiredPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove an unexpected temporary path: $resolved"
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}

if (-not (Test-Path -LiteralPath $CredentialPath)) {
    throw "Encrypted Supabase access is not configured."
}

$configuration = Get-Content -Raw -LiteralPath $CredentialPath | ConvertFrom-Json
if ($configuration.version -ne 1 -or $configuration.expectedProductionProjectRef -ne "svierarfcolhcfjpmwck") {
    throw "The encrypted access file is not pinned to SportStack Production."
}

$token = ConvertTo-PlainText -SecureValue (ConvertTo-SecureString -String $configuration.encryptedSupabaseToken)
$previousToken = $env:SUPABASE_ACCESS_TOKEN
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) (
    "sportstack-b1-audit-" + [guid]::NewGuid().ToString("N")
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

        $migrationList = Invoke-CheckedCommand -Command "supabase" -Arguments @(
            "migration", "list", "--linked", "--workdir", $targetTemporaryRoot
        )
        $migrationVersions = @(
            [regex]::Matches($migrationList, "(?m)\b20\d{12}\b") |
                ForEach-Object { $_.Value } |
                Sort-Object -Unique
        )
        $migrationVersions | ConvertTo-Json |
            Set-Content -LiteralPath (Join-Path $targetOutputRoot "migration-versions.json") -Encoding utf8

        $functionJson = Invoke-CheckedCommand -Command "supabase" -Arguments @(
            "functions", "list", "--project-ref", $target.ProjectRef, "--output", "json"
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
            Set-Content -LiteralPath (Join-Path $targetOutputRoot "edge-functions.json") -Encoding utf8

        $schemaPath = Join-Path $targetOutputRoot "public-private-schema.sql"
        Invoke-CheckedCommand -Command "supabase" -Arguments @(
            "db", "dump", "--linked", "--workdir", $targetTemporaryRoot,
            "--schema", "public,private", "--file", $schemaPath
        ) | Out-Null
        if (-not (Test-Path -LiteralPath $schemaPath) -or (Get-Item -LiteralPath $schemaPath).Length -eq 0) {
            throw "The $($target.Name) schema dump was not created."
        }

        $inventoryJson = Invoke-CheckedCommand -Command "supabase" -Arguments @(
            "db", "query", "--linked", "--workdir", $targetTemporaryRoot,
            "--file", (Join-Path $RepositoryRoot "scripts\sql\b1-schema-inventory.sql"),
            "--output-format", "json"
        )
        if ([string]::IsNullOrWhiteSpace($inventoryJson)) {
            throw "The $($target.Name) structural inventory was not returned."
        }
        $inventoryJson | Set-Content -LiteralPath (Join-Path $targetOutputRoot "structural-inventory.json") -Encoding utf8

        $manifestTargets += [ordered]@{
            name = $target.Name
            project_ref = $target.ProjectRef
            migration_count = $migrationVersions.Count
            edge_function_count = $safeFunctionRows.Count
            schema_sha256 = (Get-FileHash -LiteralPath $schemaPath -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }

    [ordered]@{
        created_at = (Get-Date).ToString("o")
        mode = "read-only-schema-only"
        dev_git_commit = (Invoke-CheckedCommand -Command "git" -Arguments @("rev-parse", "origin/dev"))
        main_git_commit = (Invoke-CheckedCommand -Command "git" -Arguments @("rev-parse", "origin/main"))
        production_git_commit = (Invoke-CheckedCommand -Command "git" -Arguments @("rev-parse", "origin/prod"))
        targets = $manifestTargets
    } | ConvertTo-Json -Depth 5 |
        Set-Content -LiteralPath (Join-Path $OutputDirectory "manifest.json") -Encoding utf8

    Write-Host "B1_ENVIRONMENT_AUDIT_OK" -ForegroundColor Green
    Write-Host "Output: $OutputDirectory"
    foreach ($target in $manifestTargets) {
        Write-Host "$($target.name): migrations=$($target.migration_count) functions=$($target.edge_function_count)"
    }
}
finally {
    $env:SUPABASE_ACCESS_TOKEN = $previousToken
    $token = $null
    Remove-VerifiedTemporaryDirectory -Path $temporaryRoot
}
