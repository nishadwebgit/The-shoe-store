<#
  Nishoes API - development runner.

  Double-click dev-api.cmd (which runs this script). It will:
    1. check the .NET SDK and install the local dotnet-ef tool,
    2. create a development JWT signing key in user secrets (once),
    3. build the solution and run the unit tests,
    4. create EF Core migrations when the model changes,
    5. start the API on http://localhost:5080 (Swagger: /swagger), which applies
       migrations to SQL Server and seeds the catalogue on startup.

  If the build fails it waits for a source file to change and tries again.
  Creating a file named ".restart" in this folder rebuilds and restarts the API.
  Logs are written to the logs\ folder. Close the window (or press Ctrl+C) to stop.
#>
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
Set-Location $root
$logs = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$statusLog = Join-Path $logs 'status.log'
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_NOLOGO = '1'

function Write-Status([string]$message, [string]$color = 'Cyan') {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $message"
    Add-Content -Path $statusLog -Value $line -Encoding UTF8
    Write-Host $line -ForegroundColor $color
}

# Runs a command through cmd so its output is written to the log as-is (UTF-8), then shows the tail.
function Invoke-Logged([string]$command, [string]$logName, [int]$tail = 25) {
    $log = Join-Path $logs $logName
    cmd /c "$command > `"$log`" 2>&1"
    $code = $LASTEXITCODE
    Get-Content $log -Tail $tail | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    return $code
}

function Wait-ForChange {
    Write-Status 'Waiting for a source change (or a .restart file)...' 'Yellow'
    $watcher = New-Object System.IO.FileSystemWatcher $root
    $watcher.IncludeSubdirectories = $true
    $watcher.NotifyFilter = [System.IO.NotifyFilters]'FileName, LastWrite, DirectoryName'
    try {
        while ($true) {
            $result = $watcher.WaitForChanged([System.IO.WatcherChangeTypes]::All, 1000)
            if ($result.TimedOut) { continue }
            if ($result.Name -match '(^|\\)(bin|obj|logs|uploads|\.vs)(\\|$)') { continue }
            break
        }
    } finally { $watcher.Dispose() }
    Start-Sleep -Seconds 3
    if (Test-Path (Join-Path $root '.restart')) { Remove-Item (Join-Path $root '.restart') -Force }
}

Write-Status '=== Nishoes API dev runner ===' 'Green'
$sdks = (& dotnet --list-sdks) -join '; '
Write-Status "Installed .NET SDKs: $sdks"
if ($sdks -notmatch '(^|; )(9|1\d)\.') {
    Write-Status 'The .NET 9 SDK (or newer) is required: https://dotnet.microsoft.com/download' 'Red'
    Read-Host 'Press Enter to close'
    exit 1
}

# Local dotnet-ef tool (versions are kept in .config\dotnet-tools.json).
if (-not (Test-Path (Join-Path $root '.config\dotnet-tools.json'))) {
    Invoke-Logged 'dotnet new tool-manifest' 'tools.log' 5 | Out-Null
}
$toolList = (& dotnet tool list --local) -join "`n"
if ($toolList -notmatch 'dotnet-ef') {
    Write-Status 'Installing dotnet-ef (local tool)...'
    Invoke-Logged 'dotnet tool install dotnet-ef --version 9.*' 'tools.log' 5 | Out-Null
}
Invoke-Logged 'dotnet tool restore' 'tools.log' 3 | Out-Null

# Development JWT signing key in user secrets (never committed to source control).
$secrets = (& dotnet user-secrets list --project ShoeStore.Api 2>&1) -join "`n"
if ($secrets -notmatch 'Jwt:SigningKey') {
    $bytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $key = [Convert]::ToBase64String($bytes)
    & dotnet user-secrets set 'Jwt:SigningKey' $key --project ShoeStore.Api | Out-Null
    Write-Status 'Created a development JWT signing key in user secrets.'
}

while ($true) {
    Write-Status 'Restoring and building...'
    $code = Invoke-Logged 'dotnet build ShoeStore.sln -nologo -clp:ErrorsOnly' 'build.log'
    if ($code -ne 0) {
        Write-Status 'BUILD FAILED (see logs\build.log)' 'Red'
        Wait-ForChange
        continue
    }
    Write-Status 'BUILD OK' 'Green'

    $testCode = Invoke-Logged 'dotnet test ShoeStore.Tests --no-build -nologo' 'test.log' 6
    if ($testCode -eq 0) { Write-Status 'TESTS PASSED' 'Green' } else { Write-Status "TESTS FAILED (see logs\test.log)" 'Red' }

    $ef = 'dotnet ef --project ShoeStore.Infrastructure --startup-project ShoeStore.Api'
    $migrationsDir = Join-Path $root 'ShoeStore.Infrastructure\Persistence\Migrations'
    if (-not (Test-Path $migrationsDir)) {
        Write-Status 'Creating the initial EF Core migration...'
        $code = Invoke-Logged "$ef migrations add InitialCreate --output-dir Persistence\Migrations --no-build" 'migrations.log'
        if ($code -ne 0) { Write-Status 'MIGRATION FAILED (see logs\migrations.log)' 'Red'; Wait-ForChange; continue }
        Write-Status 'MIGRATION CREATED: InitialCreate' 'Green'
        continue   # rebuild so the migration is compiled in
    }

    $code = Invoke-Logged "$ef migrations has-pending-model-changes --no-build" 'migrations-check.log' 3
    if ($code -ne 0) {
        $name = 'Update' + (Get-Date -Format 'yyyyMMddHHmmss')
        Write-Status "Model changed: creating migration $name..."
        $code = Invoke-Logged "$ef migrations add $name --output-dir Persistence\Migrations --no-build" 'migrations.log'
        if ($code -ne 0) { Write-Status 'MIGRATION FAILED (see logs\migrations.log)' 'Red'; Wait-ForChange; continue }
        Write-Status "MIGRATION CREATED: $name" 'Green'
        continue
    }

    $apiLog = Join-Path $logs 'api.log'
    $apiErr = Join-Path $logs 'api-errors.log'
    $process = Start-Process -FilePath 'dotnet' `
        -ArgumentList 'run --no-build --project ShoeStore.Api --launch-profile http' `
        -WorkingDirectory $root -NoNewWindow -PassThru `
        -RedirectStandardOutput $apiLog -RedirectStandardError $apiErr
    Write-Status "API STARTING (PID $($process.Id)): http://localhost:5080/swagger" 'Green'

    $restart = $false
    while (-not $process.HasExited) {
        if (Test-Path (Join-Path $root '.restart')) {
            Remove-Item (Join-Path $root '.restart') -Force
            $restart = $true
            Write-Status 'Restart requested: stopping the API...' 'Yellow'
            & taskkill /PID $process.Id /T /F | Out-Null
            Start-Sleep -Seconds 2
            break
        }
        Start-Sleep -Seconds 1
    }
    if (-not $restart) {
        Write-Status "API STOPPED (exit code $($process.ExitCode)). See logs\api.log" 'Red'
        Wait-ForChange
    }
}
