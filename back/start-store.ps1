# Starts the backend of a client store set up with scripts/new-store.cjs, next to Arisma's (which keeps using
# start-local.ps1 and quarkus:dev). Every store runs the same packaged build, kept in tiendas/_app; -Build makes it
# again after changing the backend code.
#   ./start-store.ps1 <slug> [-Build]
param([Parameter(Mandatory = $true)][string]$Slug, [switch]$Build)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if ($Slug -notmatch '^[a-z][a-z0-9]{1,30}$') { throw 'Nombre de tienda inválido.' }

function Read-Env($file) {
  $out = @{}
  if (Test-Path $file) { Get-Content $file | ForEach-Object { if ($_ -notmatch '^\s*#') { $pair = $_.Split('=', 2); if ($pair.Length -eq 2) { $out[$pair[0].Trim()] = $pair[1].Trim() } } } }
  return $out
}
$local = Read-Env '.env'
$store = Read-Env "..\tiendas\$Slug\.env"
if (-not $store['DB_URL']) { throw "No existe la tienda $Slug. Créala con: node scripts/new-store.cjs crear $Slug" }

# docker and mvn write progress to stderr; Windows PowerShell would take it for an error, so only the exit code counts
function Invoke-Tool([scriptblock]$run, [string]$problem) {
  $ErrorActionPreference = 'Continue'
  & $run 2>&1 | ForEach-Object { Write-Host $_ }
  if ($LASTEXITCODE -ne 0) { throw $problem }
}
Invoke-Tool { docker compose -p arisma-quarkus up -d } 'No fue posible iniciar Postgres y MinIO.'

$app = Join-Path $PSScriptRoot '..\tiendas\_app'
if ($Build -or -not (Test-Path (Join-Path $app 'quarkus-run.jar'))) {
  Write-Host 'Empaquetando el backend (si el de Arisma corre en modo dev, puede recargarse una vez)...'
  Invoke-Tool { mvn -q package -DskipTests } 'No se pudo empaquetar el backend.'
  if (Test-Path $app) { Remove-Item -Recurse -Force $app }
  Copy-Item -Recurse 'target\quarkus-app' $app
}

$env:PORT = $store['PORT']
$env:DB_URL = $store['DB_URL']
$env:DB_PASSWORD = $local['ARISMA_DB_PASSWORD']
$env:AWS_ACCESS_KEY_ID = $local['ARISMA_S3_ACCESS_KEY']
$env:AWS_SECRET_ACCESS_KEY = $local['ARISMA_S3_SECRET_KEY']
$env:ARISMA_S3_BUCKET = $store['ARISMA_S3_BUCKET']
$env:ARISMA_S3_ENDPOINT = 'http://127.0.0.1:19010'
$env:ARISMA_SECRETS_KEY = $store['ARISMA_SECRETS_KEY']
$env:ARISMA_PUBLIC_URL = $store['ARISMA_PUBLIC_URL']
$env:ARISMA_COOKIE_SECURE = 'false'
$env:ARISMA_TRACKING_PLAN = $store['ARISMA_TRACKING_PLAN']
if ($store['ARISMA_TRACKING_KEY']) { $env:ARISMA_TRACKING_KEY = $store['ARISMA_TRACKING_KEY'] } else { Remove-Item Env:ARISMA_TRACKING_KEY -ErrorAction SilentlyContinue }
foreach ($name in 'ARISMA_TURNSTILE_SITE_KEY', 'ARISMA_TURNSTILE_SECRET') { if ($store[$name]) { Set-Item "Env:$name" $store[$name] } else { Remove-Item "Env:$name" -ErrorAction SilentlyContinue } }
Write-Host "Tienda ${Slug}: backend en http://127.0.0.1:$($store['PORT'])"
java -jar (Join-Path $app 'quarkus-run.jar')
