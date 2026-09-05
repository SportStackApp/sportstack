#requires -Version 7.0

<#
.SYNOPSIS
Safely checks or releases the frozen Player MVP deadline-lifecycle Production follow-up.

.DESCRIPTION
This script is deliberately pinned to one reviewed commit, its exact Production parent and one
database migration. Preflight is read-only. Release refuses to run unless the exact confirmation
phrase is supplied, creates and verifies a logical Production backup before the migration, applies
only the approved migration, then fast-forwards the Production branch to the frozen commit.

The migration creates one database schedule. The script never deploys Edge Functions, changes
secrets, changes scraper workflows or sends tally email.
#>

[CmdletBinding()]
param(
    [ValidateSet("ConfigureAccess", "SelfTest", "Preflight", "Release", "Verify")]
    [string]$Mode = "Preflight",

    [string]$Confirmation = "",

    [string]$CandidateRoot = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProductionProjectRef = "svierarfcolhcfjpmwck"
$DevelopmentProjectRef = "icqegnpjbizccjebjfhb"
$ProductionUrl = "https://sportstack.grampianshockey.com.au"
$ExpectedRemote = "https://github.com/SportStackApp/sportstack.git"
$ExpectedGitName = "Aaron Mullane"
$ExpectedGitEmail = "admin@sportstackapp.com.au"
$ExpectedGitHubAccount = "SportStackApp"
$ProductionBaseCommit = "15223e9f72f36307c1e09d96a1b1bdb9472f6d72"
$ReleaseCommit = "a1d23c741b79de02c32763a879597192a1c1ebd5"
$ReleaseBranch = "codex/player-mvp-lifecycle-production-slice"
$RequiredConfirmation = "RELEASE PLAYER MVP LIFECYCLE a1d23c7 TO PRODUCTION"
$MigrationName = "20260905131718_restore_player_mvp_voting_lifecycle_after_production_slice.sql"
$MigrationPath = "supabase/migrations/$MigrationName"
$MigrationBlob = "cbb7558a68af1270acd02a1f4da60e736b42263e"
$CredentialDirectory = Join-Path $env:LOCALAPPDATA "SportStack\release"
$CredentialPath = Join-Path $CredentialDirectory "player-mvp-tally-production-access.json"

$AllowedPaths = @($MigrationPath)

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

    # Capturing output lets every failed command stop the release before the next action.
    $output = & $Command @Arguments 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed. The release stopped immediately.`n$output"
    }

    if (-not $Quiet -and -not [string]::IsNullOrWhiteSpace($output)) {
        Write-Host $output.TrimEnd()
    }

    return $output
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
        throw "$Description does not match the approved allow-list. Found: $($actualNormalised -join ', ')"
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

function Save-AccessConfiguration {
    Write-Step "Store Production Supabase access securely"
    Write-Host "Paste a current Supabase Owner/Admin personal access token. It will not be displayed."
    $token = Read-Host "Supabase personal access token" -AsSecureString
    if ($token.Length -eq 0) {
        throw "A Supabase token is required."
    }

    New-Item -ItemType Directory -Path $CredentialDirectory -Force | Out-Null
    [ordered]@{
        version = 1
        configuredAt = (Get-Date).ToString("o")
        expectedProductionProjectRef = $ProductionProjectRef
        encryptedSupabaseToken = ConvertFrom-SecureString -SecureString $token
    } | ConvertTo-Json | Set-Content -LiteralPath $CredentialPath -Encoding utf8

    Write-Host "Encrypted access saved for this Windows account outside the repository." -ForegroundColor Green
    Write-Host "Next: run this script with -Mode Preflight."
}

function Get-AccessToken {
    if (-not (Test-Path -LiteralPath $CredentialPath)) {
        throw "Production access is not configured. Run this script with -Mode ConfigureAccess."
    }

    $configuration = Get-Content -Raw -LiteralPath $CredentialPath | ConvertFrom-Json
    if ($configuration.version -ne 1 -or
        $configuration.expectedProductionProjectRef -ne $ProductionProjectRef) {
        throw "The encrypted access file is not pinned to the expected Production project."
    }

    $secure = ConvertTo-SecureString -String $configuration.encryptedSupabaseToken
    return ConvertTo-PlainText -SecureValue $secure
}

function Invoke-WithSupabaseToken {
    param(
        [Parameter(Mandatory)]
        [string]$Token,

        [Parameter(Mandatory)]
        [scriptblock]$Action
    )

    $oldToken = $env:SUPABASE_ACCESS_TOKEN
    try {
        $env:SUPABASE_ACCESS_TOKEN = $Token
        return & $Action
    }
    finally {
        $env:SUPABASE_ACCESS_TOKEN = $oldToken
    }
}

function Resolve-CandidateRoot {
    if (-not [string]::IsNullOrWhiteSpace($CandidateRoot)) {
        return (Resolve-Path -LiteralPath $CandidateRoot).Path
    }

    $repositoryRoot = Split-Path $PSScriptRoot -Parent
    $projectsRoot = Split-Path $repositoryRoot -Parent
    $defaultRoot = Join-Path $projectsRoot "sportstack-mvp-lifecycle-release"
    return (Resolve-Path -LiteralPath $defaultRoot).Path
}

function Assert-LocalReleaseState {
    param([string]$Root)

    Write-Step "Verify the frozen Git release"
    foreach ($command in @("git", "gh", "node", "supabase")) {
        Assert-CommandAvailable -Command $command
    }

    Invoke-NativeCommand -Command "git" -Arguments @("-C", $Root, "fetch", "origin", "prod", $ReleaseBranch, "--prune") -Quiet | Out-Null

    $remote = (Invoke-NativeCommand -Command "git" -Arguments @("-C", $Root, "remote", "get-url", "origin") -Quiet).Trim()
    if ($remote -ne $ExpectedRemote) {
        throw "The Git remote is not the approved SportStack repository."
    }

    $trackedChanges = (Invoke-NativeCommand -Command "git" -Arguments @(
        "-C", $Root, "status", "--porcelain", "--untracked-files=no"
    ) -Quiet).Trim()
    if ($trackedChanges) {
        throw "The frozen candidate has tracked working-tree changes."
    }

    $head = (Invoke-NativeCommand -Command "git" -Arguments @("-C", $Root, "rev-parse", "HEAD") -Quiet).Trim()
    $remoteCandidate = (Invoke-NativeCommand -Command "git" -Arguments @(
        "-C", $Root, "rev-parse", "origin/$ReleaseBranch"
    ) -Quiet).Trim()
    $remoteProduction = (Invoke-NativeCommand -Command "git" -Arguments @("-C", $Root, "rev-parse", "origin/prod") -Quiet).Trim()
    $parent = (Invoke-NativeCommand -Command "git" -Arguments @("-C", $Root, "rev-parse", "$ReleaseCommit^") -Quiet).Trim()

    if ($head -ne $ReleaseCommit -or $remoteCandidate -ne $ReleaseCommit -or $parent -ne $ProductionBaseCommit) {
        throw "The local or remote candidate is not the approved one-commit Production slice."
    }
    if ($remoteProduction -notin @($ProductionBaseCommit, $ReleaseCommit)) {
        throw "Production has moved away from both the approved base and release commits. Re-review is required."
    }

    $name = (Invoke-NativeCommand -Command "git" -Arguments @("-C", $Root, "config", "user.name") -Quiet).Trim()
    $email = (Invoke-NativeCommand -Command "git" -Arguments @("-C", $Root, "config", "user.email") -Quiet).Trim()
    if ($name -ne $ExpectedGitName -or $email -ne $ExpectedGitEmail) {
        throw "The repository Git identity is not the approved SportStack identity."
    }

    $activeAccount = (Invoke-NativeCommand -Command "gh" -Arguments @(
        "api", "user", "--jq", ".login"
    ) -Quiet).Trim()
    if ($activeAccount -ne $ExpectedGitHubAccount) {
        throw "The active GitHub account is '$activeAccount', not '$ExpectedGitHubAccount'."
    }

    $changedPathsOutput = Invoke-NativeCommand -Command "git" -Arguments @(
        "-C", $Root, "diff-tree", "--no-commit-id", "--name-only", "-r", $ReleaseCommit
    ) -Quiet
    $changedPaths = @($changedPathsOutput.Trim() -split "`r?`n" | Where-Object { $_ })
    Assert-EqualSet -Actual $changedPaths -Expected $AllowedPaths -Description "Candidate changed paths"

    $blob = (Invoke-NativeCommand -Command "git" -Arguments @(
        "-C", $Root, "rev-parse", "${ReleaseCommit}:$MigrationPath"
    ) -Quiet).Trim()
    if ($blob -ne $MigrationBlob) {
        throw "The approved migration content has changed."
    }

    Push-Location -LiteralPath $Root
    try {
        Invoke-NativeCommand -Command "node" -Arguments @(
            (Join-Path $PSScriptRoot "verify-player-mvp-lifecycle-production-slice.mjs"),
            "--candidate-root", $Root
        ) -Quiet | Out-Null
    }
    finally {
        Pop-Location
    }

    Write-Host "Frozen candidate verified: $($ReleaseCommit.Substring(0, 7))." -ForegroundColor Green
    Write-Host "Production Git state: $($remoteProduction.Substring(0, 7))." -ForegroundColor Green
    return $remoteProduction
}

function Assert-RemoteAccess {
    param([string]$Token)

    Write-Step "Verify scoped Supabase Production access"
    $projectsJson = Invoke-WithSupabaseToken -Token $Token -Action {
        Invoke-NativeCommand -Command "supabase" -Arguments @("projects", "list", "-o", "json") -Quiet
    }
    $projects = $projectsJson | ConvertFrom-Json
    $production = @($projects | Where-Object { $_.id -eq $ProductionProjectRef })
    if ($production.Count -ne 1 -or $production[0].status -ne "ACTIVE_HEALTHY") {
        throw "The Supabase token cannot see a healthy SportStack Production project. Refresh access and retry."
    }

    Write-Host "SportStack Production is visible and healthy." -ForegroundColor Green
}

function Test-CurrentProductionWebsite {
    param([string]$ExpectedGitState)

    Write-Step "Verify the current Production website"
    $cacheBuster = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $response = Invoke-WebRequest -Uri "$ProductionUrl/?preflight=$cacheBuster" -MaximumRedirection 5
    if ($response.StatusCode -ne 200) {
        throw "Production returned HTTP $($response.StatusCode)."
    }
    $assetMatch = [regex]::Match($response.Content, 'src="(?<path>/assets/[^"?]+\.js)"')
    if (-not $assetMatch.Success) {
        throw "The current Production JavaScript asset could not be identified."
    }
    $bundle = (Invoke-WebRequest -Uri ($ProductionUrl + $assetMatch.Groups["path"].Value)).Content
    if ($bundle -notmatch $ProductionProjectRef -or $bundle -match $DevelopmentProjectRef) {
        throw "The current website is not pinned only to SportStack Production."
    }

    if ($ExpectedGitState -eq $ProductionBaseCommit) {
        if ($bundle -notmatch $ProductionBaseCommit.Substring(0, 7) -or
            $bundle -match $ReleaseCommit.Substring(0, 7) -or
            $bundle -notmatch "Player MVP Season Tally") {
            throw "The public Production bundle no longer matches the approved tally baseline."
        }
        Write-Host "Public Production still matches tally baseline $($ProductionBaseCommit.Substring(0, 7))." -ForegroundColor Green
    }
    elseif ($ExpectedGitState -eq $ReleaseCommit) {
        if ($bundle -notmatch $ReleaseCommit.Substring(0, 7) -or
            $bundle -notmatch "Player MVP Season Tally") {
            throw "Production Git is released, but the public lifecycle-release bundle is not ready."
        }
        Write-Host "Public Production matches tally release $($ReleaseCommit.Substring(0, 7))." -ForegroundColor Green
    }

    return $assetMatch.Groups["path"].Value
}

function Remove-IsolatedWorkdir {
    param([AllowNull()][string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) {
        return
    }

    # Resolve and validate the exact temporary path before any recursive removal.
    $resolved = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path).Path)
    $temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $requiredPrefix = Join-Path $temporaryRoot "sportstack-player-mvp-lifecycle-release-"
    if (-not $resolved.StartsWith($requiredPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove an unexpected path: $resolved"
    }

    Remove-Item -LiteralPath $resolved -Recurse -Force
}

function New-IsolatedSupabaseWorkdir {
    param(
        [string]$Token,
        [string]$Root
    )

    Write-Step "Create an isolated Production database connection"
    $temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) (
        "sportstack-player-mvp-lifecycle-release-" + [guid]::NewGuid().ToString("N")
    )
    $temporarySupabase = Join-Path $temporaryRoot "supabase"
    $temporaryMigrations = Join-Path $temporarySupabase "migrations"
    New-Item -ItemType Directory -Path $temporaryMigrations -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $Root "supabase\config.toml") -Destination $temporarySupabase

    try {
        $remoteList = Invoke-WithSupabaseToken -Token $Token -Action {
            Invoke-NativeCommand -Command "supabase" -Arguments @(
                "link", "--project-ref", $ProductionProjectRef, "--workdir", $temporaryRoot, "--yes"
            ) -Quiet | Out-Null
            Invoke-NativeCommand -Command "supabase" -Arguments @(
                "migration", "list", "--linked", "--workdir", $temporaryRoot
            ) -Quiet
        }

        $remoteVersions = @(
            [regex]::Matches($remoteList, "(?m)\b20\d{12}\b") |
                ForEach-Object { $_.Value } |
                Sort-Object -Unique
        )
        if ($remoteVersions.Count -eq 0) {
            throw "No Production migration history was returned."
        }

        foreach ($version in $remoteVersions) {
            if ($version -eq $MigrationName.Substring(0, 14)) {
                continue
            }
            "-- Production migration history placeholder $version." |
                Set-Content -LiteralPath (Join-Path $temporaryMigrations "${version}_remote_history.sql") -Encoding utf8
        }
        Copy-Item -LiteralPath (Join-Path $Root $MigrationPath) -Destination $temporaryMigrations

        return [ordered]@{
            Root = $temporaryRoot
            MigrationList = $remoteList
        }
    }
    catch {
        Remove-IsolatedWorkdir -Path $temporaryRoot
        throw
    }
}

function Invoke-ProductionQuery {
    param(
        [string]$Token,
        [string]$SupabaseWorkdir,
        [string]$Sql
    )

    return Invoke-WithSupabaseToken -Token $Token -Action {
        Invoke-NativeCommand -Command "supabase" -Arguments @(
            "db", "query", $Sql, "--linked", "--workdir", $SupabaseWorkdir
        ) -Quiet
    }
}

function Get-ProductionMigrationState {
    param(
        [string]$Token,
        [string]$SupabaseWorkdir,
        [string]$MigrationList
    )

    Write-Step "Check Production lifecycle state"
    $dependencySql = @"
select case when
  (select count(*) = 6 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p') and c.relname in (
      'mvp_result_checks','mvp_vote_audit','mvp_vote_submissions','mvp_votes',
      'mvp_voting_sessions','notifications'))
  and to_regtype('public.mvp_session_status') is not null
  and to_regclass('cron.job') is not null
  and exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'mvp_session_status' and e.enumlabel = 'CLOSED')
  and exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'mvp_session_status' and e.enumlabel = 'RESULT_DISPUTED')
then 'PLAYER_MVP_LIFECYCLE_DEPENDENCIES_OK'
else 'PLAYER_MVP_LIFECYCLE_DEPENDENCIES_MISSING' end as result;
"@
    $dependencyResult = Invoke-ProductionQuery -Token $Token -SupabaseWorkdir $SupabaseWorkdir -Sql $dependencySql
    if ($dependencyResult -notmatch "PLAYER_MVP_LIFECYCLE_DEPENDENCIES_OK") {
        throw "Production no longer has the rehearsed Player MVP lifecycle dependencies."
    }

    $stateSql = @"
select 'LIFECYCLE_SNAPSHOT|' || json_build_object(
  'sessions', (select count(*) from public.mvp_voting_sessions),
  'overdueOpen', (select count(*) from public.mvp_voting_sessions where status = 'OPEN' and closes_at <= now()),
  'closed', (select count(*) from public.mvp_voting_sessions where status = 'CLOSED'),
  'disputed', (select count(*) from public.mvp_voting_sessions where status = 'RESULT_DISPUTED'),
  'concernedOverdue', (select count(*) from public.mvp_voting_sessions session where
    session.status = 'OPEN' and session.closes_at <= now() and exists (
      select 1 from public.mvp_result_checks result_check
      where result_check.session_id = session.id
        and result_check.result_check_round = session.result_check_round
        and result_check.response = 'INCORRECT')),
  'audit', (select count(*) from public.mvp_vote_audit),
  'notifications', (select count(*) from public.notifications),
  'emailEvents', (select count(*) from public.mvp_voting_email_events),
  'emailTeams', (select count(*) from public.teams where mvp_notifications_enabled is true),
  'presentations', (select count(*) from public.mvp_tally_presentations),
  'recipients', (select count(*) from public.mvp_tally_recipients),
  'closeFunction', to_regprocedure('private.close_due_mvp_voting_sessions()') is not null,
  'deadlineFunction', to_regprocedure('private.enforce_mvp_voting_deadline()') is not null,
  'triggers', (select count(*) from pg_trigger where not tgisinternal and tgname in (
    'enforce_mvp_voting_deadline_on_votes','enforce_mvp_voting_deadline_on_submissions')),
  'jobs', (select count(*) from cron.job where jobname = 'close-due-player-mvp-voting')
)::text || '|END' as result;
"@
    $stateResult = Invoke-ProductionQuery -Token $Token -SupabaseWorkdir $SupabaseWorkdir -Sql $stateSql
    $snapshotMatch = [regex]::Match($stateResult, 'LIFECYCLE_SNAPSHOT\|(?<json>\{.*\})\|END')
    if (-not $snapshotMatch.Success) {
        throw "The Production lifecycle snapshot could not be parsed."
    }
    # Supabase CLI table output escapes the JSON field's quote characters.
    $snapshotJson = $snapshotMatch.Groups['json'].Value -replace '\\"', '"'
    $snapshot = $snapshotJson | ConvertFrom-Json
    $migrationApplied = $MigrationList -match [regex]::Escape($MigrationName.Substring(0, 14))
    $objectsApplied = $snapshot.closeFunction -and $snapshot.deadlineFunction -and
        [int]$snapshot.triggers -eq 2 -and [int]$snapshot.jobs -eq 1
    $objectsPending = -not $snapshot.closeFunction -and -not $snapshot.deadlineFunction -and
        [int]$snapshot.triggers -eq 0 -and [int]$snapshot.jobs -eq 0

    if ($objectsPending -and -not $migrationApplied) {
        $dryRun = Invoke-WithSupabaseToken -Token $Token -Action {
            Invoke-NativeCommand -Command "supabase" -Arguments @(
                "db", "push", "--dry-run", "--linked", "--workdir", $SupabaseWorkdir
            ) -Quiet
        }
        if ($dryRun -notmatch [regex]::Escape($MigrationName)) {
            throw "The dry-run did not identify exactly the approved lifecycle migration."
        }
        Write-Host "Production is ready for the single pending lifecycle migration." -ForegroundColor Green
        return [ordered]@{ State = 'Pending'; Snapshot = $snapshot }
    }

    if ($objectsApplied -and $migrationApplied) {
        if ([int]$snapshot.overdueOpen -ne 0) {
            throw "The lifecycle migration is recorded but overdue OPEN sessions remain."
        }
        Write-Host "The lifecycle migration is already applied; safe resume checks are required." -ForegroundColor Yellow
        return [ordered]@{ State = 'Applied'; Snapshot = $snapshot }
    }

    throw "Production lifecycle objects and migration history are inconsistent. Stop for manual review."
}

function Assert-PendingBaseline {
    param([object]$Snapshot)

    $expected = [ordered]@{
        sessions = 647
        overdueOpen = 355
        closed = 5
        disputed = 0
        concernedOverdue = 0
        audit = 40
        notifications = 24
        emailEvents = 328
        emailTeams = 96
        presentations = 1
        recipients = 26
    }
    foreach ($name in $expected.Keys) {
        if ([long]$Snapshot.$name -ne [long]$expected[$name]) {
            throw "Production '$name' changed from the reviewed baseline. Expected $($expected[$name]); found $($Snapshot.$name)."
        }
    }
}

function Assert-ReleaseDelta {
    param(
        [object]$Before,
        [object]$After
    )

    $unchanged = @('sessions', 'disputed', 'concernedOverdue', 'notifications', 'emailEvents', 'emailTeams', 'presentations', 'recipients')
    foreach ($name in $unchanged) {
        if ([long]$After.$name -ne [long]$Before.$name) {
            throw "Release changed protected '$name' count."
        }
    }
    if ([long]$After.overdueOpen -ne 0) {
        throw "Overdue OPEN Player MVP sessions remain after release."
    }
    if ([long]$After.closed -ne ([long]$Before.closed + [long]$Before.overdueOpen)) {
        throw "Closed-session reconciliation count is not exact."
    }
    if ([long]$After.audit -ne ([long]$Before.audit + [long]$Before.overdueOpen)) {
        throw "Audit reconciliation count is not exact."
    }
}

function Assert-ReleaseConfirmation {
    param([string]$Value)
    if ($Value -ne $RequiredConfirmation) {
        throw "Release mode requires the exact confirmation: $RequiredConfirmation"
    }
}

function Test-BackupReadiness {
    param(
        [string]$Token,
        [string]$SupabaseWorkdir
    )

    Write-Step "Check Production backup readiness"
    $physicalBackups = Invoke-WithSupabaseToken -Token $Token -Action {
        Invoke-NativeCommand -Command "supabase" -Arguments @(
            "backups", "list", "--project-ref", $ProductionProjectRef
        ) -Quiet
    }
    if ([string]::IsNullOrWhiteSpace($physicalBackups)) {
        Write-Warning "No physical backup listing was returned. A verified logical backup is still mandatory before release."
    }
    else {
        Write-Host "Supabase backup metadata is available." -ForegroundColor Green
    }

    Invoke-WithSupabaseToken -Token $Token -Action {
        Invoke-NativeCommand -Command "supabase" -Arguments @(
            "db", "dump", "--dry-run", "--linked", "--workdir", $SupabaseWorkdir
        ) -Quiet | Out-Null
    }
    Write-Host "Logical backup command is available; no backup was created during pre-flight." -ForegroundColor Green
}

function New-ProductionBackup {
    param(
        [string]$Token,
        [string]$SupabaseWorkdir,
        [object]$BeforeSnapshot
    )

    Write-Step "Create and verify a fresh Production logical backup"
    $stamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
    $backupRoot = Join-Path $env:LOCALAPPDATA (
        "SportStack\backups\prod\$stamp-pre-player-mvp-lifecycle-$($ReleaseCommit.Substring(0, 7))"
    )
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

    Invoke-WithSupabaseToken -Token $Token -Action {
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

    $minimumBytes = @{ "roles.sql" = 1; "schema.sql" = 1024; "data.sql" = 1024 }
    $manifestFiles = @()
    foreach ($name in $minimumBytes.Keys) {
        $path = Join-Path $backupRoot $name
        $file = Get-Item -LiteralPath $path
        if ($file.Length -lt $minimumBytes[$name]) {
            throw "Backup verification failed for $name. The migration was not applied."
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
        productionBaseCommit = $ProductionBaseCommit
        releaseCommit = $ReleaseCommit
        migration = $MigrationName
        migrationBlob = $MigrationBlob
        reconciliationSnapshot = $BeforeSnapshot
        files = $manifestFiles
    } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupRoot "manifest.json") -Encoding utf8

    Write-Host "Verified logical backup: $backupRoot" -ForegroundColor Green
    return $backupRoot
}

function Get-VerifiedExistingBackup {
    $backupParent = Join-Path $env:LOCALAPPDATA "SportStack\backups\prod"
    $candidates = @(
        Get-ChildItem -LiteralPath $backupParent -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like "*-pre-player-mvp-lifecycle-$($ReleaseCommit.Substring(0, 7))" } |
            Sort-Object LastWriteTime -Descending
    )

    foreach ($candidate in $candidates) {
        $manifestPath = Join-Path $candidate.FullName "manifest.json"
        if (-not (Test-Path -LiteralPath $manifestPath)) {
            continue
        }
        $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
        if ($manifest.productionProjectRef -ne $ProductionProjectRef -or
            $manifest.productionBaseCommit -ne $ProductionBaseCommit -or
            $manifest.releaseCommit -ne $ReleaseCommit -or
            $manifest.migrationBlob -ne $MigrationBlob) {
            continue
        }

        $valid = @($manifest.files).Count -eq 3
        foreach ($entry in @($manifest.files)) {
            $path = Join-Path $candidate.FullName $entry.name
            if (-not (Test-Path -LiteralPath $path)) {
                $valid = $false
                break
            }
            $file = Get-Item -LiteralPath $path
            $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($file.Length -ne [long]$entry.bytes -or $hash -ne [string]$entry.sha256) {
                $valid = $false
                break
            }
        }

        if ($valid) {
            Write-Host "Verified resumable backup: $($candidate.FullName)" -ForegroundColor Green
            return $candidate.FullName
        }
    }

    throw "The migration appears applied, but no verified pre-migration backup exists for this release."
}

function Invoke-DatabaseRelease {
    param(
        [string]$Token,
        [string]$SupabaseWorkdir,
        [object]$BeforeSnapshot
    )

    Write-Step "Apply the one approved Production migration"
    Invoke-WithSupabaseToken -Token $Token -Action {
        Invoke-NativeCommand -Command "supabase" -Arguments @(
            "db", "push", "--linked", "--workdir", $SupabaseWorkdir, "--yes"
        ) -Quiet | Out-Null
    }

    $list = Invoke-WithSupabaseToken -Token $Token -Action {
        Invoke-NativeCommand -Command "supabase" -Arguments @(
            "migration", "list", "--linked", "--workdir", $SupabaseWorkdir
        ) -Quiet
    }
    if ($list -notmatch [regex]::Escape($MigrationName.Substring(0, 14))) {
        throw "The approved migration was not recorded. Stop before the application deployment."
    }

    $state = Get-ProductionMigrationState -Token $Token -SupabaseWorkdir $SupabaseWorkdir -MigrationList $list
    if ($state.State -ne "Applied") {
        throw "The approved lifecycle schema could not be verified after migration."
    }
    Assert-ReleaseDelta -Before $BeforeSnapshot -After $state.Snapshot
    Write-Host "Lifecycle reconciliation counts are exact and email/notification counts are unchanged." -ForegroundColor Green
    return $state
}

function Promote-ProductionBranch {
    param([string]$Root)

    Write-Step "Fast-forward Production to the frozen lifecycle commit"
    Invoke-NativeCommand -Command "git" -Arguments @(
        "-C", $Root, "fetch", "origin", "prod", $ReleaseBranch, "--prune"
    ) -Quiet | Out-Null
    $production = (Invoke-NativeCommand -Command "git" -Arguments @(
        "-C", $Root, "rev-parse", "origin/prod"
    ) -Quiet).Trim()
    $candidate = (Invoke-NativeCommand -Command "git" -Arguments @(
        "-C", $Root, "rev-parse", "origin/$ReleaseBranch"
    ) -Quiet).Trim()

    if ($candidate -ne $ReleaseCommit) {
        throw "The remote candidate moved. Stop before Production promotion."
    }
    if ($production -eq $ReleaseCommit) {
        Write-Host "Production already points to the frozen commit." -ForegroundColor Yellow
        return
    }
    if ($production -ne $ProductionBaseCommit) {
        throw "Production moved after pre-flight. Stop and re-review the release."
    }

    Invoke-NativeCommand -Command "git" -Arguments @(
        "-C", $Root, "push", "origin", "${ReleaseCommit}:refs/heads/prod"
    ) -Quiet | Out-Null
    Write-Host "The Production branch was fast-forwarded without rewriting history." -ForegroundColor Green
}

function Test-ProductionWebsite {
    Write-Step "Verify the Production deployment"
    $deadline = (Get-Date).AddMinutes(10)
    $lastFailure = "The frozen deployment has not appeared yet."

    do {
        try {
            $cacheBuster = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            $response = Invoke-WebRequest -Uri "$ProductionUrl/?release=$cacheBuster" -MaximumRedirection 5
            if ($response.StatusCode -ne 200) {
                throw "Production returned HTTP $($response.StatusCode)."
            }
            $assetMatch = [regex]::Match($response.Content, 'src="(?<path>/assets/[^"?]+\.js)"')
            if (-not $assetMatch.Success) {
                throw "The Production JavaScript asset could not be identified."
            }
            $bundle = (Invoke-WebRequest -Uri ($ProductionUrl + $assetMatch.Groups["path"].Value)).Content
            if ($bundle -notmatch $ProductionProjectRef -or $bundle -match $DevelopmentProjectRef) {
                throw "The deployed application is not pinned only to SportStack Production."
            }
            if ($bundle -notmatch $ReleaseCommit.Substring(0, 7)) {
                throw "The Production bundle does not contain the frozen lifecycle commit."
            }
            if ($bundle -notmatch "Player MVP Season Tally" -or $bundle -notmatch "Tally presentations") {
                throw "The Player MVP tally bundle is not live yet."
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
    Write-Host "Production serves the tally bundle and only the Production Supabase project." -ForegroundColor Green
}

if ($Mode -eq "ConfigureAccess") {
    Save-AccessConfiguration
    return
}

if ($Mode -eq "SelfTest") {
    $selfTestRoot = Resolve-CandidateRoot
    Assert-LocalReleaseState -Root $selfTestRoot | Out-Null

    Assert-ReleaseConfirmation -Value $RequiredConfirmation
    $wrongConfirmationStopped = $false
    try { Assert-ReleaseConfirmation -Value "WRONG" } catch { $wrongConfirmationStopped = $true }
    if (-not $wrongConfirmationStopped) { throw "Wrong-confirmation self-test did not stop." }

    $unexpectedPathStopped = $false
    try { Assert-EqualSet -Actual @($MigrationPath, 'src/App.tsx') -Expected $AllowedPaths -Description 'Self-test allow-list' }
    catch { $unexpectedPathStopped = $true }
    if (-not $unexpectedPathStopped) { throw "Unexpected-path self-test did not stop." }

    $before = [pscustomobject]@{
        sessions = 647; overdueOpen = 355; closed = 5; disputed = 0; concernedOverdue = 0; audit = 40
        notifications = 24; emailEvents = 328; emailTeams = 96; presentations = 1; recipients = 26
    }
    $after = [pscustomobject]@{
        sessions = 647; overdueOpen = 0; closed = 360; disputed = 0; concernedOverdue = 0; audit = 395
        notifications = 24; emailEvents = 328; emailTeams = 96; presentations = 1; recipients = 26
    }
    Assert-PendingBaseline -Snapshot $before
    Assert-ReleaseDelta -Before $before -After $after

    $changedEmail = [pscustomobject]@{
        sessions = 647; overdueOpen = 0; closed = 360; disputed = 0; concernedOverdue = 0; audit = 395
        notifications = 24; emailEvents = 329; emailTeams = 96; presentations = 1; recipients = 26
    }
    $emailChangeStopped = $false
    try { Assert-ReleaseDelta -Before $before -After $changedEmail } catch { $emailChangeStopped = $true }
    if (-not $emailChangeStopped) { throw "Email-change self-test did not stop." }

    Write-Host "SELF_TEST_PASS" -ForegroundColor Green
    return
}

$root = Resolve-CandidateRoot
$token = $null
$isolated = $null
$isolatedPath = $null
try {
    $productionGitState = Assert-LocalReleaseState -Root $root
    $productionAsset = Test-CurrentProductionWebsite -ExpectedGitState $productionGitState
    if ($Mode -eq "Release") {
        Assert-ReleaseConfirmation -Value $Confirmation
    }
    $token = Get-AccessToken
    Assert-RemoteAccess -Token $token
    $isolated = New-IsolatedSupabaseWorkdir -Token $token -Root $root
    $isolatedPath = $isolated.Root
    $migrationState = Get-ProductionMigrationState -Token $token -SupabaseWorkdir $isolated.Root -MigrationList $isolated.MigrationList

    if ($Mode -eq "Preflight") {
        if ($migrationState.State -eq 'Pending') {
            Assert-PendingBaseline -Snapshot $migrationState.Snapshot
        }
        Test-BackupReadiness -Token $token -SupabaseWorkdir $isolated.Root
        Write-Host "`nPREFLIGHT_PASS — no Production changes were made." -ForegroundColor Green
        Write-Host "Release commit: $($ReleaseCommit.Substring(0, 7))"
        Write-Host "Migration state: $($migrationState.State)"
        Write-Host "Current Production asset: $productionAsset"
        Write-Host "Expected reconciliation: $($migrationState.Snapshot.overdueOpen) overdue OPEN sessions."
        Write-Host "Next: review the frozen packet and obtain exact Production approval."
        return
    }

    if ($Mode -eq "Verify") {
        if ($productionGitState -ne $ReleaseCommit -or $migrationState.State -ne "Applied") {
            throw "Production does not match the complete approved release."
        }
        Test-ProductionWebsite
        Write-Host "`nPRODUCTION VERIFICATION PASSED at $($ReleaseCommit.Substring(0, 7))." -ForegroundColor Green
        return
    }

    if ($migrationState.State -eq "Pending") {
        Assert-PendingBaseline -Snapshot $migrationState.Snapshot
        $backupPath = New-ProductionBackup -Token $token -SupabaseWorkdir $isolated.Root -BeforeSnapshot $migrationState.Snapshot
        Invoke-DatabaseRelease -Token $token -SupabaseWorkdir $isolated.Root -BeforeSnapshot $migrationState.Snapshot | Out-Null
    }
    else {
        $backupPath = Get-VerifiedExistingBackup
    }

    Promote-ProductionBranch -Root $root
    Test-ProductionWebsite
    Write-Host "`nPRODUCTION RELEASE COMPLETE" -ForegroundColor Green
    Write-Host "Verified backup: $backupPath"
    Write-Host "Manual owner smoke test is still required before a real player presentation."
}
finally {
    Remove-IsolatedWorkdir -Path $isolatedPath
    $token = $null
}
