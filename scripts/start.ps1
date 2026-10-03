param([int]$Port = 5080)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sdkCommand = Get-Command dotnet -ErrorAction SilentlyContinue
$dotnetExe = if ($sdkCommand) { $sdkCommand.Source } elseif (Test-Path "$env:TEMP/halici-dotnet/dotnet.exe") { "$env:TEMP/halici-dotnet/dotnet.exe" } else { throw '.NET 10 SDK kurun: https://dotnet.microsoft.com/download/dotnet/10.0' }
$env:ASPNETCORE_ENVIRONMENT = 'Development'
Write-Host "Vitrin: http://localhost:$Port"
Write-Host "Yönetim: http://localhost:$Port/admin.html"
Write-Host 'İlk giriş bilgileri: src/Halici.Web/App_Data/initial-admin.txt'
& $dotnetExe run --project "$projectRoot/src/Halici.Web/Halici.Web.csproj" --urls "http://localhost:$Port"
exit $LASTEXITCODE
