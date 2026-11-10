<#
  Opens a public HTTPS tunnel to the local API so PayHere can send payment notifications,
  stores the notify URL in user secrets and restarts the API (via the dev runner's .restart file).
  Keep this window open while testing payments. Press Ctrl+C to close the tunnel.
#>
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$exe = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $exe) {
    foreach ($p in @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe",
                     "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe")) {
        if (Test-Path $p) { $exe = $p; break }
    }
}
if (-not $exe) {
    Write-Host "cloudflared isn't installed. Install it with:" -ForegroundColor Yellow
    Write-Host "    winget install --id Cloudflare.cloudflared" -ForegroundColor Cyan
    Write-Host "then run payhere-tunnel.cmd again."
    exit 1
}

New-Item -ItemType Directory -Force logs | Out-Null
$log = Join-Path $PSScriptRoot 'logs\tunnel.log'
Remove-Item $log -ErrorAction SilentlyContinue

Write-Host "Starting tunnel to http://localhost:5080 ..."
$proc = Start-Process -FilePath $exe -ArgumentList 'tunnel', '--no-autoupdate', '--url', 'http://localhost:5080' `
    -RedirectStandardError $log -RedirectStandardOutput (Join-Path $PSScriptRoot 'logs\tunnel-out.log') -NoNewWindow -PassThru

$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $log) {
        $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
        if ($m) { $url = $m.Matches[0].Value }
    }
    if ($proc.HasExited) { break }
}
if (-not $url) {
    Write-Host "Couldn't get a tunnel URL. See logs\tunnel.log" -ForegroundColor Red
    if (-not $proc.HasExited) { Stop-Process -Id $proc.Id }
    exit 1
}

$notify = "$url/api/v1/payments/payhere/notify"
& dotnet user-secrets set 'PayHere:NotifyUrl' $notify --project ShoeStore.Api | Out-Null
New-Item -ItemType File -Force '.restart' | Out-Null

Write-Host ""
Write-Host "Tunnel ready: $url" -ForegroundColor Green
Write-Host "PayHere notify URL saved: $notify"
Write-Host "The dev runner is restarting the API to pick it up."
Write-Host ""
Write-Host "Keep this window open while testing payments. Press Ctrl+C to close the tunnel." -ForegroundColor Yellow
try { Wait-Process -Id $proc.Id } finally { if (-not $proc.HasExited) { Stop-Process -Id $proc.Id } }
