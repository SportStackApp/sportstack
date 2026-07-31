#requires -Version 7.0

<#
.SYNOPSIS
Safely prepares or runs the approved SportStack Umpire Portal Production release.

.DESCRIPTION
The script has three modes:

- ConfigureAccess: securely stores the required access details for the current Windows user.
- Preflight: performs read-only checks and refuses an unsafe or unexpected release.
- Release: backs up Production, applies only the approved database changes, deploys the approved
  Edge Function and Vercel setting, then fast-forwards the prod branch.

Secrets are encrypted with Windows Data Protection API (DPAPI) and saved outside the repository.
The decrypted values exist only in this PowerShell process while a command needs them.
#>

[CmdletBinding()]
param(
    [ValidateSet("ConfigureAccess", "Preflight", "Release", "Verify")]
    [string]$Mode = "Preflight",

    [string]$Confirmation = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# These constants deliberately pin this release to the known SportStack Production targets.
$ProductionProjectRef = "svierarfcolhcfjpmwck"
$DevelopmentProjectRef = "icqegnpjbizccjebjfhb"
$ProductionUrl = "https://sportstack.grampianshockey.com.au"
$ProductionFunctionUrl = "https://$ProductionProjectRef.functions.supabase.co/public-umpire-match-voting"
$AssociationId = "635f5e71-b9d7-40eb-9225-60894a07219f"
$AllowedOrigin = $ProductionUrl
$ExpectedGitRemote = "https://github.com/SportStackApp/sportstack.git"
$ExpectedGitName = "Aaron Mullane"
$ExpectedGitEmail = "admin@sportstackapp.com.au"
$ExpectedGitHubAccount = "SportStackApp"
$RequiredConfirmation = "RELEASE UMPIRE PORTAL TO PRODUCTION"
$RequiredMigrations = @(
    "20260730114925_public_umpire_portal.sql",
    "20260730124436_restore_default_voter_role.sql"
)
$RequiredFunction = "public-umpire-match-voting"
$CredentialDirectory = Join-Path $env:LOCALAPPDATA "SportStack\release"
$CredentialPath = Join-Path $CredentialDirectory "production-access.json"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory)]
        [string]$Command,

        [string[]]$Arguments = @(),

        [switch]$Quiet
    )

    # Capture output so a failed command stops the release immediately.
    $output = & $Command @Arguments 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed. No Production changes were attempted after this failure.`n$output"
    }

    if (-not $Quiet -and -not [string]::IsNullOrWhiteSpace($output)) {
        Write-Host $output.TrimEnd()
    }

    return $output
}

function Get-RequiredSecureValue {
    param([string]$Prompt)

    while ($true) {
        $value = Read-Host $Prompt -AsSecureString
        if ($value.Length -gt 0) {
            return $value
        }

        Write-Warning "A value is required."
    }
}

function ConvertTo-PlainText {
    param([Security.SecureString]$SecureValue)

    # Marshal the SecureString only for the shortest possible time and clear the unmanaged copy.
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Protect-Value {
    param([Security.SecureString]$SecureValue)
    return ConvertFrom-SecureString -SecureString $SecureValue
}

function Unprotect-Value {
    param([string]$EncryptedValue)

    $secure = ConvertTo-SecureString -String $EncryptedValue
    return ConvertTo-PlainText -SecureValue $secure
}

function Read-TextWithDefault {
    param(
        [string]$Prompt,
        [string]$Default
    )

    $value = Read-Host "$Prompt [$Default]"
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $Default
    }

    return $value.Trim()
}

function Save-AccessConfiguration {
    Write-Step "Configure encrypted Production CLI access"
    Write-Host "Paste each value into the secure prompt. PowerShell will not display it."

    $vercelTeam = Read-TextWithDefault -Prompt "Vercel team slug" -Default "sportstackapps-projects"
    $vercelProject = Read-TextWithDefault -Prompt "Vercel project name" -Default "sportstack"
    $vercelToken = Get-RequiredSecureValue -Prompt "Vercel team access token"
    $supabaseToken = Get-RequiredSecureValue -Prompt "Supabase Owner/Admin personal access token"
    $turnstileSiteKey = Get-RequiredSecureValue -Prompt "Production Turnstile site key"
    $turnstileSecretKey = Get-RequiredSecureValue -Prompt "Production Turnstile secret key"

    $turnstileSiteKeyText = ConvertTo-PlainText -SecureValue $turnstileSiteKey
    $turnstileSecretKeyText = ConvertTo-PlainText -SecureValue $turnstileSecretKey
    try {
        if ($turnstileSiteKeyText -match "^[123]x0{10,}" -or $turnstileSecretKeyText -match "^[123]x0{10,}") {
            throw "Cloudflare test keys cannot be saved for Production."
        }
        if ($turnstileSiteKeyText -match "\s" -or $turnstileSecretKeyText -match "\s") {
            throw "Turnstile keys cannot contain spaces or line breaks."
        }
    }
    finally {
        $turnstileSiteKeyText = $null
        $turnstileSecretKeyText = $null
    }

    New-Item -ItemType Directory -Path $CredentialDirectory -Force | Out-Null

    # DPAPI encryption binds these values to Aaron's current Windows account on this PC.
    $payload = [ordered]@{
        version = 1
        configuredAt = (Get-Date).ToString("o")
        expectedProductionProjectRef = $ProductionProjectRef
        vercelTeam = $vercelTeam
        vercelProject = $vercelProject
        encrypted = [ordered]@{
            vercelToken = Protect-Value -SecureValue $vercelToken
            supabaseToken = Protect-Value -SecureValue $supabaseToken
            turnstileSiteKey = Protect-Value -SecureValue $turnstileSiteKey
            turnstileSecretKey = Protect-Value -SecureValue $turnstileSecretKey
        }
    }

    $payload | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $CredentialPath -Encoding utf8
    Write-Host "Encrypted access saved outside the repository: $CredentialPath" -ForegroundColor Green
    Write-Host "Next: run this script with -Mode Preflight."
}

function Get-AccessConfiguration {
    if (-not (Test-Path -LiteralPath $CredentialPath)) {
        throw "Production access is not configured. Run: pwsh -NoProfile -File scripts/release-production.ps1 -Mode ConfigureAccess"
    }

    $configuration = Get-Content -LiteralPath $CredentialPath -Raw | ConvertFrom-Json
    if ($configuration.version -ne 1) {
        throw "The encrypted access file uses an unsupported format."
    }
    if ($configuration.expectedProductionProjectRef -ne $ProductionProjectRef) {
        throw "The encrypted access file is not pinned to the expected Production project."
    }

    return [ordered]@{
        VercelTeam = [string]$configuration.vercelTeam
        VercelProject = [string]$configuration.vercelProject
        VercelToken = Unprotect-Value -EncryptedValue $configuration.encrypted.vercelToken
        SupabaseToken = Unprotect-Value -EncryptedValue $configuration.encrypted.supabaseToken
        TurnstileSiteKey = Unprotect-Value -EncryptedValue $configuration.encrypted.turnstileSiteKey
        TurnstileSecretKey = Unprotect-Value -EncryptedValue $configuration.encrypted.turnstileSecretKey
    }
}

function Assert-CommandAvailable {
    param([string]$Command)

    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "Required command '$Command' is not installed or is not on PATH."
    }
}

function Assert-EqualSet {
    param(
        [string[]]$Actual,
        [string[]]$Expected,
        [string]$Description
    )

    $actualNormalised = @($Actual | Sort-Object -Unique)
    $expectedNormalised = @($Expected | Sort-Object -Unique)
    if (($actualNormalised -join "`n") -ne ($expectedNormalised -join "`n")) {
        throw "$Description did not match the approved allow-list. Found: $($actualNormalised -join ', ')"
    }
}

function Assert-LocalReleaseState {
    Write-Step "Check Git and local release safety"

    foreach ($command in @("git", "gh", "supabase", "vercel")) {
        Assert-CommandAvailable -Command $command
    }

    $repoRoot = (Invoke-NativeCommand -Command "git" -Arguments @("rev-parse", "--show-toplevel") -Quiet).Trim()
    $currentRoot = (Get-Location).Path
    if (-not [IO.Path]::GetFullPath($repoRoot).Equals([IO.Path]::GetFullPath($currentRoot), [StringComparison]::OrdinalIgnoreCase)) {
        throw "Run this script from the SportStack repository root: $repoRoot"
    }

    $remote = (Invoke-NativeCommand -Command "git" -Arguments @("remote", "get-url", "origin") -Quiet).Trim()
    if ($remote -ne $ExpectedGitRemote) {
        throw "The origin remote is not the expected SportStack repository."
    }

    $gitName = (Invoke-NativeCommand -Command "git" -Arguments @("config", "user.name") -Quiet).Trim()
    $gitEmail = (Invoke-NativeCommand -Command "git" -Arguments @("config", "user.email") -Quiet).Trim()
    if ($gitName -ne $ExpectedGitName -or $gitEmail -ne $ExpectedGitEmail) {
        throw "The repository Git identity is not $ExpectedGitName <$ExpectedGitEmail>."
    }

    $githubAccount = (Invoke-NativeCommand -Command "gh" -Arguments @("api", "user", "--jq", ".login") -Quiet).Trim()
    if ($githubAccount -ne $ExpectedGitHubAccount) {
        throw "The active GitHub CLI account is not $ExpectedGitHubAccount."
    }

    $status = Invoke-NativeCommand -Command "git" -Arguments @("status", "--porcelain") -Quiet
    if (-not [string]::IsNullOrWhiteSpace($status)) {
        throw "The working tree is not clean. Commit or safely remove local changes before a Production release."
    }

    $currentBranch = (Invoke-NativeCommand -Command "git" -Arguments @("branch", "--show-current") -Quiet).Trim()
    if ($currentBranch -ne "dev") {
        throw "Run the release from the clean dev branch. The current branch is '$currentBranch'."
    }

    Invoke-NativeCommand -Command "git" -Arguments @("fetch", "origin", "dev", "main", "prod", "--prune") -Quiet | Out-Null

    $devCommit = (Invoke-NativeCommand -Command "git" -Arguments @("rev-parse", "origin/dev") -Quiet).Trim()
    $mainCommit = (Invoke-NativeCommand -Command "git" -Arguments @("rev-parse", "origin/main") -Quiet).Trim()
    $prodCommit = (Invoke-NativeCommand -Command "git" -Arguments @("rev-parse", "origin/prod") -Quiet).Trim()
    if ($devCommit -ne $mainCommit) {
        throw "Dev and main are not aligned. Promote and verify Dev to main before Production."
    }
    $localCommit = (Invoke-NativeCommand -Command "git" -Arguments @("rev-parse", "HEAD") -Quiet).Trim()
    if ($localCommit -ne $devCommit) {
        throw "The local dev branch is not aligned with origin/dev."
    }

    & git merge-base --is-ancestor origin/prod origin/main
    if ($LASTEXITCODE -ne 0) {
        throw "Production is not a clean ancestor of main. A fast-forward release is unsafe."
    }
    if ($prodCommit -eq $mainCommit) {
        throw "Production already matches main. There is nothing to release."
    }

    $migrationOutput = Invoke-NativeCommand -Command "git" -Arguments @(
        "diff", "--name-only", "origin/prod..origin/main", "--", "supabase/migrations"
    ) -Quiet
    $migrationDiff = @($migrationOutput.Trim() -split "`r?`n" | Where-Object { $_ })
    $migrationNames = @($migrationDiff | ForEach-Object { Split-Path $_ -Leaf })
    Assert-EqualSet -Actual $migrationNames -Expected $RequiredMigrations -Description "Production migration files"

    $functionOutput = Invoke-NativeCommand -Command "git" -Arguments @(
        "diff", "--name-only", "origin/prod..origin/main", "--", "supabase/functions"
    ) -Quiet
    $functionDiff = @($functionOutput.Trim() -split "`r?`n" | Where-Object { $_ })
    $unexpectedFunctions = @($functionDiff | Where-Object { $_ -notlike "supabase/functions/$RequiredFunction/*" })
    if ($unexpectedFunctions.Count -gt 0 -or $functionDiff.Count -eq 0) {
        throw "The Edge Function changes do not match the approved $RequiredFunction allow-list."
    }

    $linkedRefPath = Join-Path $currentRoot "supabase/.temp/project-ref"
    if (-not (Test-Path -LiteralPath $linkedRefPath)) {
        throw "The local Supabase link is missing. It must remain linked to Dev for routine work."
    }
    $linkedRef = (Get-Content -LiteralPath $linkedRefPath -Raw).Trim()
    if ($linkedRef -ne $DevelopmentProjectRef) {
        throw "The repository is not linked to SportStack Dev. Refusing to continue."
    }

    Write-Host "Git release path: $($prodCommit.Substring(0, 7)) -> $($mainCommit.Substring(0, 7))" -ForegroundColor Green
    Write-Host "Local Supabase link remains safely on Dev: $linkedRef" -ForegroundColor Green
    return $mainCommit
}

function Assert-RemoteAccess {
    param([System.Collections.IDictionary]$Access)

    Write-Step "Validate scoped Vercel and Supabase access"

    $oldSupabaseToken = $env:SUPABASE_ACCESS_TOKEN
    $oldVercelToken = $env:VERCEL_TOKEN
    try {
        $env:SUPABASE_ACCESS_TOKEN = $Access.SupabaseToken
        $projectsJson = Invoke-NativeCommand -Command "supabase" -Arguments @(
            "projects", "list", "--output-format", "json"
        ) -Quiet
        $projectsEnvelope = $projectsJson | ConvertFrom-Json
        $projects = if ($projectsEnvelope.PSObject.Properties.Name -contains "projects") {
            @($projectsEnvelope.projects)
        }
        else {
            @($projectsEnvelope)
        }
        if (-not ($projects | Where-Object { $_.id -eq $ProductionProjectRef })) {
            throw "The Supabase token cannot see SportStack Production. Use an Owner/Admin token."
        }

        $env:VERCEL_TOKEN = $Access.VercelToken
        Invoke-NativeCommand -Command "vercel" -Arguments @(
            "project", "inspect", $Access.VercelProject,
            "--scope", $Access.VercelTeam,
            "--yes", "--no-color"
        ) -Quiet | Out-Null
    }
    finally {
        $env:SUPABASE_ACCESS_TOKEN = $oldSupabaseToken
        $env:VERCEL_TOKEN = $oldVercelToken
    }

    Write-Host "Vercel project and Supabase Production access are available." -ForegroundColor Green
}

function New-IsolatedProductionWorkdir {
    param([System.Collections.IDictionary]$Access)

    Write-Step "Create an isolated Production Supabase connection"

    $temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("sportstack-production-release-" + [guid]::NewGuid().ToString("N"))
    $temporarySupabase = Join-Path $temporaryRoot "supabase"
    New-Item -ItemType Directory -Path $temporarySupabase | Out-Null
    $temporaryMigrations = Join-Path $temporarySupabase "migrations"
    New-Item -ItemType Directory -Path $temporaryMigrations | Out-Null
    Copy-Item -LiteralPath "supabase/config.toml" -Destination (Join-Path $temporarySupabase "config.toml")

    $oldSupabaseToken = $env:SUPABASE_ACCESS_TOKEN
    try {
        $env:SUPABASE_ACCESS_TOKEN = $Access.SupabaseToken
        Invoke-NativeCommand -Command "supabase" -Arguments @(
            "link", "--project-ref", $ProductionProjectRef,
            "--workdir", $temporaryRoot, "--yes"
        ) -Quiet | Out-Null

        $linkedRefPath = Join-Path $temporarySupabase ".temp/project-ref"
        if (-not (Test-Path -LiteralPath $linkedRefPath)) {
            throw "The isolated Supabase link did not record a project reference."
        }
        $linkedRef = (Get-Content -LiteralPath $linkedRefPath -Raw).Trim()
        if ($linkedRef -ne $ProductionProjectRef) {
            throw "The isolated Supabase work directory linked to the wrong project."
        }

        $remoteMigrationList = Invoke-NativeCommand -Command "supabase" -Arguments @(
            "migration", "list", "--linked", "--workdir", $temporaryRoot
        ) -Quiet

        # Reconstruct the live history as empty temporary files. This avoids replaying repository
        # migrations whose filenames drifted from the versions recorded in Production.
        $remoteVersions = @(
            [regex]::Matches($remoteMigrationList, "(?m)\b20\d{12}\b") |
                ForEach-Object { $_.Value } |
                Sort-Object -Unique
        )
        if ($remoteVersions.Count -eq 0) {
            throw "No Production migration history was returned."
        }

        $requiredVersions = @($RequiredMigrations | ForEach-Object { $_.Substring(0, 14) })
        foreach ($version in $remoteVersions) {
            if ($requiredVersions -contains $version) {
                continue
            }
            "-- Temporary placeholder for Production migration history $version." |
                Set-Content -LiteralPath (Join-Path $temporaryMigrations "${version}_remote_history.sql") -Encoding utf8
        }

        foreach ($migration in $RequiredMigrations) {
            $source = Join-Path "supabase/migrations" $migration
            if (-not (Test-Path -LiteralPath $source)) {
                throw "Approved migration file is missing: $migration"
            }
            Copy-Item -LiteralPath $source -Destination (Join-Path $temporaryMigrations $migration)
        }
    }
    catch {
        Remove-IsolatedProductionWorkdir -Path $temporaryRoot
        throw
    }
    finally {
        $env:SUPABASE_ACCESS_TOKEN = $oldSupabaseToken
    }

    Write-Host "Isolated Supabase link is pinned to Production with $($remoteVersions.Count) live history records; the repository link remains on Dev." -ForegroundColor Green
    return $temporaryRoot
}

function Remove-IsolatedProductionWorkdir {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) {
        return
    }

    $resolvedPath = [IO.Path]::GetFullPath($Path)
    $temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $expectedPrefix = Join-Path $temporaryRoot "sportstack-production-release-"
    if (-not $resolvedPath.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        Write-Warning "Refused to remove unexpected temporary path: $resolvedPath"
        return
    }

    [IO.Directory]::Delete($resolvedPath, $true)
}

function Test-InstalledMigrations {
    param(
        [System.Collections.IDictionary]$Access,
        [string]$SupabaseWorkdir,
        [string]$MigrationList = ""
    )

    if ([string]::IsNullOrWhiteSpace($MigrationList)) {
        $oldSupabaseToken = $env:SUPABASE_ACCESS_TOKEN
        try {
            $env:SUPABASE_ACCESS_TOKEN = $Access.SupabaseToken
            $MigrationList = Invoke-NativeCommand -Command "supabase" -Arguments @(
                "migration", "list", "--linked", "--workdir", $SupabaseWorkdir
            ) -Quiet
        }
        finally {
            $env:SUPABASE_ACCESS_TOKEN = $oldSupabaseToken
        }
    }

    foreach ($migration in $RequiredMigrations) {
        $version = $migration.Substring(0, 14)
        $line = @($MigrationList -split "`r?`n" | Where-Object { $_ -match $version })
        if ($line.Count -eq 0 -or ([regex]::Matches(($line -join " "), $version).Count -lt 2)) {
            return $false
        }
    }

    return $true
}

function Get-ProductionMigrationState {
    param(
        [System.Collections.IDictionary]$Access,
        [string]$SupabaseWorkdir
    )

    Write-Step "Dry-run the exact Production migrations"

    $oldSupabaseToken = $env:SUPABASE_ACCESS_TOKEN
    try {
        $env:SUPABASE_ACCESS_TOKEN = $Access.SupabaseToken
        $dryRun = Invoke-NativeCommand -Command "supabase" -Arguments @(
            "db", "push", "--dry-run", "--linked", "--workdir", $SupabaseWorkdir
        ) -Quiet
    }
    finally {
        $env:SUPABASE_ACCESS_TOKEN = $oldSupabaseToken
    }

    $pendingMigrations = @(
        [regex]::Matches($dryRun, "(?m)\b20\d{12}_[A-Za-z0-9_]+\.sql\b") |
            ForEach-Object { $_.Value } |
            Sort-Object -Unique
    )
    if ($pendingMigrations.Count -gt 0) {
        Assert-EqualSet -Actual $pendingMigrations -Expected $RequiredMigrations -Description "Pending Production migrations"
        Write-Host "Only the two approved Umpire Portal migrations are pending." -ForegroundColor Green
        return "Pending"
    }

    if (Test-InstalledMigrations -Access $Access -SupabaseWorkdir $SupabaseWorkdir) {
        Write-Host "Both approved migrations are already applied; a guarded release can resume." -ForegroundColor Green
        return "Applied"
    }

    throw "The Production migration state is neither the approved pending set nor the fully applied set."
}

function New-ProductionBackup {
    param(
        [System.Collections.IDictionary]$Access,
        [string]$SupabaseWorkdir,
        [string]$ReleaseCommit
    )

    Write-Step "Create and verify a fresh Production logical backup"

    $commit = $ReleaseCommit.Substring(0, 7)
    $stamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
    $backupRoot = Join-Path $env:LOCALAPPDATA "SportStack\backups\prod\$stamp-pre-umpire-portal-$commit"
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

    $oldSupabaseToken = $env:SUPABASE_ACCESS_TOKEN
    try {
        $env:SUPABASE_ACCESS_TOKEN = $Access.SupabaseToken
        Invoke-NativeCommand -Command "supabase" -Arguments @(
            "db", "dump", "--linked", "--workdir", $SupabaseWorkdir,
            "--role-only", "--file", (Join-Path $backupRoot "roles.sql")
        ) -Quiet | Out-Null
        Invoke-NativeCommand -Command "supabase" -Arguments @(
            "db", "dump", "--linked", "--workdir", $SupabaseWorkdir,
            "--file", (Join-Path $backupRoot "schema.sql")
        ) -Quiet | Out-Null
        Invoke-NativeCommand -Command "supabase" -Arguments @(
            "db", "dump", "--linked", "--workdir", $SupabaseWorkdir,
            "--data-only", "--use-copy", "--file", (Join-Path $backupRoot "data.sql")
        ) -Quiet | Out-Null
    }
    finally {
        $env:SUPABASE_ACCESS_TOKEN = $oldSupabaseToken
    }

    $minimumBytes = @{
        "roles.sql" = 1
        "schema.sql" = 1024
        "data.sql" = 1024
    }
    $manifestFiles = @()
    foreach ($name in $minimumBytes.Keys) {
        $path = Join-Path $backupRoot $name
        $file = Get-Item -LiteralPath $path
        if ($file.Length -lt $minimumBytes[$name]) {
            throw "Backup verification failed for $name. No migration will be applied."
        }
        $manifestFiles += [ordered]@{
            name = $name
            bytes = $file.Length
            sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }

    [ordered]@{
        createdAt = (Get-Date).ToString("o")
        productionProjectRef = $ProductionProjectRef
        sourceCommit = $ReleaseCommit
        files = $manifestFiles
    } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupRoot "manifest.json") -Encoding utf8

    Write-Host "Verified backup: $backupRoot" -ForegroundColor Green
    return $backupRoot
}

function Get-VerifiedExistingBackup {
    param([string]$ReleaseCommit)

    Write-Step "Verify the existing pre-migration backup for this release"

    $shortCommit = $ReleaseCommit.Substring(0, 7)
    $backupParent = Join-Path $env:LOCALAPPDATA "SportStack\backups\prod"
    $candidates = @(
        Get-ChildItem -LiteralPath $backupParent -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like "*-pre-umpire-portal-$shortCommit" } |
            Sort-Object LastWriteTime -Descending
    )

    foreach ($candidate in $candidates) {
        $manifestPath = Join-Path $candidate.FullName "manifest.json"
        if (-not (Test-Path -LiteralPath $manifestPath)) {
            continue
        }

        $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        if ($manifest.productionProjectRef -ne $ProductionProjectRef -or $manifest.sourceCommit -ne $ReleaseCommit) {
            continue
        }

        $verified = $true
        foreach ($entry in @($manifest.files)) {
            $path = Join-Path $candidate.FullName $entry.name
            if (-not (Test-Path -LiteralPath $path)) {
                $verified = $false
                break
            }
            $file = Get-Item -LiteralPath $path
            $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($file.Length -ne [long]$entry.bytes -or $hash -ne [string]$entry.sha256) {
                $verified = $false
                break
            }
        }

        if ($verified -and @($manifest.files).Count -eq 3) {
            Write-Host "Verified resumable backup: $($candidate.FullName)" -ForegroundColor Green
            return $candidate.FullName
        }
    }

    throw "The migrations are already applied, but no verified pre-migration backup exists for release $shortCommit. Stop for manual review."
}

function Invoke-DatabaseRelease {
    param(
        [System.Collections.IDictionary]$Access,
        [string]$SupabaseWorkdir
    )

    Write-Step "Apply the approved Production migrations"

    $oldSupabaseToken = $env:SUPABASE_ACCESS_TOKEN
    try {
        $env:SUPABASE_ACCESS_TOKEN = $Access.SupabaseToken
        Invoke-NativeCommand -Command "supabase" -Arguments @(
            "db", "push", "--linked", "--workdir", $SupabaseWorkdir, "--yes"
        ) -Quiet | Out-Null

        $migrationList = Invoke-NativeCommand -Command "supabase" -Arguments @(
            "migration", "list", "--linked", "--workdir", $SupabaseWorkdir
        ) -Quiet
    }
    finally {
        $env:SUPABASE_ACCESS_TOKEN = $oldSupabaseToken
    }

    if (-not (Test-InstalledMigrations -Access $Access -SupabaseWorkdir $SupabaseWorkdir -MigrationList $migrationList)) {
        throw "The approved migrations could not be verified as installed. Stop before frontend promotion."
    }

    Write-Host "Both Production migrations are recorded as applied." -ForegroundColor Green
}

function Set-ProductionFunctionConfiguration {
    param([System.Collections.IDictionary]$Access)

    Write-Step "Set Production Edge Function configuration"

    $temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) ("sportstack-production-release-secrets-" + [guid]::NewGuid().ToString("N"))
    $temporaryEnvFile = Join-Path $temporaryDirectory "function.env"
    New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null

    $oldSupabaseToken = $env:SUPABASE_ACCESS_TOKEN
    try {
        $env:SUPABASE_ACCESS_TOKEN = $Access.SupabaseToken
        @(
            "TURNSTILE_SECRET_KEY=$($Access.TurnstileSecretKey)",
            "PUBLIC_UMPIRE_PORTAL_ENABLED=true",
            "PUBLIC_UMPIRE_ASSOCIATION_ID=$AssociationId",
            "PUBLIC_UMPIRE_ALLOWED_ORIGINS=$AllowedOrigin"
        ) | Set-Content -LiteralPath $temporaryEnvFile -Encoding utf8

        Invoke-NativeCommand -Command "supabase" -Arguments @(
            "secrets", "set", "--project-ref", $ProductionProjectRef,
            "--env-file", $temporaryEnvFile
        ) -Quiet | Out-Null
    }
    finally {
        $env:SUPABASE_ACCESS_TOKEN = $oldSupabaseToken
        Remove-IsolatedProductionWorkdir -Path $temporaryDirectory
    }

    Write-Host "Production function settings were applied without logging their values." -ForegroundColor Green
}

function Deploy-ProductionFunction {
    param([System.Collections.IDictionary]$Access)

    Write-Step "Deploy the approved Production Edge Function"

    $oldSupabaseToken = $env:SUPABASE_ACCESS_TOKEN
    try {
        $env:SUPABASE_ACCESS_TOKEN = $Access.SupabaseToken
        Invoke-NativeCommand -Command "supabase" -Arguments @(
            "functions", "deploy", $RequiredFunction,
            "--project-ref", $ProductionProjectRef,
            "--no-verify-jwt", "--use-api"
        ) -Quiet | Out-Null
    }
    finally {
        $env:SUPABASE_ACCESS_TOKEN = $oldSupabaseToken
    }

    Write-Host "Production Edge Function deployed." -ForegroundColor Green
}

function Set-ProductionVercelEnvironment {
    param([System.Collections.IDictionary]$Access)

    Write-Step "Set the Production Turnstile site key in Vercel"

    $oldVercelToken = $env:VERCEL_TOKEN
    try {
        $env:VERCEL_TOKEN = $Access.VercelToken

        # The site key is public by design, but stdin keeps it out of the command line and logs.
        $output = $Access.TurnstileSiteKey | & vercel env add VITE_UMPIRE_TURNSTILE_SITE_KEY production `
            --project $Access.VercelProject `
            --scope $Access.VercelTeam `
            --force --no-sensitive --yes --no-color 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) {
            throw "Vercel environment update failed. Stop before promoting the prod branch."
        }

        $environmentList = Invoke-NativeCommand -Command "vercel" -Arguments @(
            "env", "list", "production",
            "--project", $Access.VercelProject,
            "--scope", $Access.VercelTeam,
            "--json", "--no-color"
        ) -Quiet
        if ($environmentList -notmatch "VITE_UMPIRE_TURNSTILE_SITE_KEY") {
            throw "Vercel did not report the required Production site-key setting."
        }
    }
    finally {
        $env:VERCEL_TOKEN = $oldVercelToken
    }

    Write-Host "The Production Vercel setting is ready for the new deployment." -ForegroundColor Green
}

function Test-ProductionFunction {
    Write-Step "Smoke-test the Production Edge Function"

    $headers = @{
        Origin = $ProductionUrl
        "Content-Type" = "application/json"
    }
    $body = @{ action = "match-options" } | ConvertTo-Json -Compress
    $response = Invoke-RestMethod -Method Post -Uri $ProductionFunctionUrl -Headers $headers -Body $body
    if ($response.association.id -ne $AssociationId) {
        throw "The Production function returned the wrong association."
    }
    if (@($response.fixtures).Count -eq 0) {
        throw "The Production function returned no eligible fixtures. Stop before frontend promotion."
    }

    Write-Host "Production function returned $(@($response.fixtures).Count) eligible fixtures." -ForegroundColor Green
}

function Promote-ProductionBranch {
    param([string]$ReleaseCommit)

    Write-Step "Fast-forward and push the prod branch"

    Invoke-NativeCommand -Command "git" -Arguments @("fetch", "origin", "main", "prod", "--prune") -Quiet | Out-Null
    $currentMain = (Invoke-NativeCommand -Command "git" -Arguments @("rev-parse", "origin/main") -Quiet).Trim()
    if ($currentMain -ne $ReleaseCommit) {
        throw "origin/main changed after preflight. Stop and review the new commit before Production."
    }
    & git merge-base --is-ancestor origin/prod $ReleaseCommit
    if ($LASTEXITCODE -ne 0) {
        throw "origin/prod changed and is no longer a clean ancestor of the approved release commit."
    }

    $startingBranch = (Invoke-NativeCommand -Command "git" -Arguments @("branch", "--show-current") -Quiet).Trim()
    try {
        Invoke-NativeCommand -Command "git" -Arguments @("switch", "prod") -Quiet | Out-Null
        Invoke-NativeCommand -Command "git" -Arguments @("merge", "--ff-only", $ReleaseCommit) -Quiet | Out-Null
        Invoke-NativeCommand -Command "git" -Arguments @("push", "origin", "prod") -Quiet | Out-Null
    }
    finally {
        if ($startingBranch -and ((Invoke-NativeCommand -Command "git" -Arguments @("branch", "--show-current") -Quiet).Trim() -ne $startingBranch)) {
            Invoke-NativeCommand -Command "git" -Arguments @("switch", $startingBranch) -Quiet | Out-Null
        }
    }

    Write-Host "The prod branch was pushed without rewriting history." -ForegroundColor Green
}

function Test-ProductionWebsite {
    Write-Step "Wait for and verify the Production website"

    $deadline = (Get-Date).AddMinutes(10)
    $lastFailure = "The new deployment has not appeared yet."
    do {
        try {
            $cacheBuster = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            $response = Invoke-WebRequest -Uri "$ProductionUrl/umpire?release=$cacheBuster" -MaximumRedirection 5
            if ($response.StatusCode -ne 200) {
                throw "Production /umpire returned HTTP $($response.StatusCode)."
            }

            $assetMatch = [regex]::Match($response.Content, 'src="(?<path>/assets/[^"?]+\.js)"')
            if (-not $assetMatch.Success) {
                throw "Could not find the Production JavaScript asset."
            }
            $bundle = (Invoke-WebRequest -Uri ($ProductionUrl + $assetMatch.Groups["path"].Value)).Content
            if ($bundle -notmatch $ProductionProjectRef -or $bundle -match $DevelopmentProjectRef) {
                throw "The deployed bundle is not yet pinned only to SportStack Production."
            }
            if ($bundle -notmatch "Umpire Login without account" -or $bundle -notmatch "Login with account") {
                throw "The new Umpire Portal bundle is not live yet."
            }

            $lastFailure = ""
            break
        }
        catch {
            $lastFailure = $_.Exception.Message
            if ((Get-Date) -lt $deadline) {
                Start-Sleep -Seconds 10
            }
        }
    } while ((Get-Date) -lt $deadline)

    if ($lastFailure) {
        throw "Production deployment verification timed out: $lastFailure"
    }

    Write-Host "Production /umpire is live, uses Production Supabase and contains both login choices." -ForegroundColor Green
}

if ($Mode -eq "ConfigureAccess") {
    Save-AccessConfiguration
    return
}

if ($Mode -eq "Verify") {
    Write-Step "Verify the completed Production release"
    Invoke-NativeCommand -Command "git" -Arguments @("fetch", "origin", "main", "prod", "--prune") -Quiet | Out-Null
    $mainCommit = (Invoke-NativeCommand -Command "git" -Arguments @("rev-parse", "origin/main") -Quiet).Trim()
    $prodCommit = (Invoke-NativeCommand -Command "git" -Arguments @("rev-parse", "origin/prod") -Quiet).Trim()
    if ($mainCommit -ne $prodCommit) {
        throw "Production does not yet match main. Verification mode cannot mark the release complete."
    }
    Test-ProductionFunction
    Test-ProductionWebsite
    Write-Host "`nPRODUCTION VERIFICATION PASSED at $($prodCommit.Substring(0, 7))" -ForegroundColor Green
    return
}

$access = $null
$supabaseWorkdir = $null
try {
    $releaseCommit = Assert-LocalReleaseState
    $access = Get-AccessConfiguration
    Assert-RemoteAccess -Access $access
    $supabaseWorkdir = New-IsolatedProductionWorkdir -Access $access
    $migrationState = Get-ProductionMigrationState -Access $access -SupabaseWorkdir $supabaseWorkdir

    if ($Mode -eq "Preflight") {
        if ($migrationState -eq "Applied") {
            Get-VerifiedExistingBackup -ReleaseCommit $releaseCommit | Out-Null
        }
        Write-Host "`nPREFLIGHT PASSED — no Production changes were made." -ForegroundColor Green
        Write-Host "Release commit: $($releaseCommit.Substring(0, 7))"
        Write-Host "Migration state: $migrationState"
        return
    }

    if ($Confirmation -ne $RequiredConfirmation) {
        throw "Release mode requires the exact confirmation: $RequiredConfirmation"
    }

    Write-Host "`nApproved commits:" -ForegroundColor Yellow
    Invoke-NativeCommand -Command "git" -Arguments @("log", "--oneline", "origin/prod..$releaseCommit")

    if ($migrationState -eq "Pending") {
        $backupPath = New-ProductionBackup -Access $access -SupabaseWorkdir $supabaseWorkdir -ReleaseCommit $releaseCommit
        Invoke-DatabaseRelease -Access $access -SupabaseWorkdir $supabaseWorkdir
    }
    else {
        $backupPath = Get-VerifiedExistingBackup -ReleaseCommit $releaseCommit
    }
    Set-ProductionFunctionConfiguration -Access $access
    Deploy-ProductionFunction -Access $access
    Test-ProductionFunction
    Set-ProductionVercelEnvironment -Access $access
    Promote-ProductionBranch -ReleaseCommit $releaseCommit
    Test-ProductionWebsite

    Write-Host "`nPRODUCTION RELEASE COMPLETE" -ForegroundColor Green
    Write-Host "Verified backup: $backupPath"
}
finally {
    Remove-IsolatedProductionWorkdir -Path $supabaseWorkdir

    # Remove plaintext credential references from this process as soon as possible.
    if ($null -ne $access) {
        foreach ($key in @("VercelToken", "SupabaseToken", "TurnstileSiteKey", "TurnstileSecretKey")) {
            $access[$key] = $null
        }
    }
}
