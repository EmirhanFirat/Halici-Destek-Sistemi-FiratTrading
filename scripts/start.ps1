param([int]$Port = 5080, [switch]$Background)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sdkCommand = Get-Command dotnet -ErrorAction SilentlyContinue
$dotnetExe = if ($sdkCommand) { $sdkCommand.Source } elseif (Test-Path "$env:TEMP/halici-dotnet/dotnet.exe") { "$env:TEMP/halici-dotnet/dotnet.exe" } else { throw '.NET 10 SDK kurun: https://dotnet.microsoft.com/download/dotnet/10.0' }
$env:ASPNETCORE_ENVIRONMENT = 'Development'
if ($Background) {
    try {
        $health = Invoke-RestMethod "http://localhost:$Port/health" -TimeoutSec 2
        if ($health.status -eq 'ok') {
            Write-Host "Site zaten çalışıyor: http://localhost:$Port"
            exit 0
        }
    } catch { }
    $projectPath = Join-Path $projectRoot 'src/Halici.Web'
    & $dotnetExe build "$projectPath/Halici.Web.csproj" --nologo
    if ($LASTEXITCODE -ne 0) { throw 'Derleme başarısız; sunucu başlatılmadı.' }
    $logDirectory = Join-Path $projectPath 'App_Data'
    New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
    $server = Start-Process -FilePath $dotnetExe -ArgumentList @('bin/Debug/net10.0/Halici.Web.dll', '--urls', "http://localhost:$Port") -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru -RedirectStandardOutput "$logDirectory/server.log" -RedirectStandardError "$logDirectory/server-error.log"
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($server.HasExited) { throw "Sunucu durdu. Ayrıntılar: $logDirectory/server-error.log" }
        try {
            $health = Invoke-RestMethod "http://localhost:$Port/health" -TimeoutSec 1
            if ($health.status -eq 'ok') {
                Set-Content -LiteralPath "$logDirectory/server.pid" -Value $server.Id
                Write-Host "Site arka planda çalışıyor: http://localhost:$Port (PID: $($server.Id))"
                exit 0
            }
        } catch { }
        Start-Sleep -Milliseconds 300
    }
    throw "Sunucu zamanında yanıt vermedi. Günlük: $logDirectory/server.log"
}
Write-Host "Vitrin: http://localhost:$Port"
Write-Host "Yönetim: http://localhost:$Port/admin.html"
Write-Host 'İlk giriş bilgileri: src/Halici.Web/App_Data/initial-admin.txt'
& $dotnetExe run --project "$projectRoot/src/Halici.Web/Halici.Web.csproj" --urls "http://localhost:$Port"
exit $LASTEXITCODE
