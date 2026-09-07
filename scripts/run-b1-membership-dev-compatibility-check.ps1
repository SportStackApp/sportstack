<#
.SYNOPSIS
Run the exact B1c migration against live Dev inside a rolled-back transaction.

.DESCRIPTION
The script uses the existing Windows-encrypted release token without printing
it. It links only to the pinned Development project, generates the fixed
rollback-only SQL from the reviewed repository migration and removes its
temporary link directory.
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepositoryRoot = Split-Path $PSScriptRoot -Parent
$CredentialPath = Join-Path $env:LOCALAPPDATA "SportStack\release\player-mvp-tally-production-access.json"
$BuilderPath = Join-Path $PSScriptRoot "build-b1-membership-dev-compatibility-check.mjs"
$ExpectedMarker = "B1_MEMBERSHIP_DEV_COMPATIBILITY_OK"
$BuilderMarker = "B1_MEMBERSHIP_DEV_COMPATIBILITY_CHECK_BUILT"

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
    $requiredPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()) + "sportstack-b1-membership-dev-"
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
    "sportstack-b1-membership-dev-" + [guid]::NewGuid().ToString("N")
)

try {
    $env:SUPABASE_ACCESS_TOKEN = $token
    New-Item -ItemType Directory -Path (Join-Path $temporaryRoot "supabase\migrations") -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $RepositoryRoot "supabase\config.toml") -Destination (Join-Path $temporaryRoot "supabase\config.toml")

    $SqlPath = Join-Path $temporaryRoot "b1-membership-dev-compatibility.sql"
    $buildOutput = & node $BuilderPath $SqlPath 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0 -or $buildOutput -notmatch [regex]::Escape($BuilderMarker)) {
        throw "Could not build the fixed Development compatibility check.`n$buildOutput"
    }
    if (-not (Test-Path -LiteralPath $SqlPath) -or (Get-Item -LiteralPath $SqlPath).Length -eq 0) {
        throw "The generated Development compatibility SQL is missing or empty."
    }

    $linkOutput = supabase link --project-ref "icqegnpjbizccjebjfhb" --workdir $temporaryRoot --yes 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0 -or $linkOutput -match '"_tag"\s*:\s*"Error"') {
        throw "Development link failed.`n$linkOutput"
    }

    $queryOutput = supabase db query --linked --workdir $temporaryRoot --file $SqlPath --output-format json 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0 -or $queryOutput -match '"_tag"\s*:\s*"Error"') {
        throw "Development compatibility check failed.`n$queryOutput"
    }
    if ($queryOutput -notmatch [regex]::Escape($ExpectedMarker)) {
        throw "Development compatibility success marker was not returned."
    }

    Write-Host $ExpectedMarker -ForegroundColor Green
}
finally {
    $env:SUPABASE_ACCESS_TOKEN = $previousToken
    $token = $null
    Remove-VerifiedTemporaryDirectory -Path $temporaryRoot
}
