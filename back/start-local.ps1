# Starts the NorPress backend of this installation in dev mode, with its Postgres and MinIO. Everything specific to the
# installation (database, bucket, public address, keys) comes from back/.env; every NORPRESS_* line there reaches the
# backend as configuration (NORPRESS_TRACKING_KEY → norpress.tracking.key, NORPRESS_LOGTO_ISSUER → norpress.logto.issuer…).
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$config = @{}
Get-Content .env | ForEach-Object { if ($_ -notmatch '^\s*#') { $pair = $_.Split('=', 2); if ($pair.Length -eq 2) { $config[$pair[0].Trim()] = $pair[1].Trim() } } }
$value = { param($key, $default) if ($config[$key]) { $config[$key] } else { $default } }
$project = & $value 'NORPRESS_COMPOSE_PROJECT' 'norpress'
$bucket = & $value 'NORPRESS_S3_BUCKET' 'norpress-media'

# docker writes its progress to stderr; Windows PowerShell would take it for an error, so only the exit code counts
function Invoke-Tool([scriptblock]$run, [string]$problem) {
  $ErrorActionPreference = 'Continue'
  & $run 2>&1 | ForEach-Object { Write-Host $_ }
  if ($LASTEXITCODE -ne 0) { throw $problem }
}
Invoke-Tool { docker compose -p $project up -d } 'No fue posible iniciar los servicios locales.'
$env:MC_HOST_local = 'http://' + $config['NORPRESS_S3_ACCESS_KEY'] + ':' + $config['NORPRESS_S3_SECRET_KEY'] + '@objectstore:9000'
try {
  Invoke-Tool { docker run --rm --network "${project}_default" -e MC_HOST_local cgr.dev/chainguard/minio-client:latest mb --ignore-existing "local/$bucket" } 'No fue posible preparar el bucket local.'
} finally { Remove-Item Env:MC_HOST_local -ErrorAction SilentlyContinue }

# Key that encrypts the payment credentials saved from the panel: 32 random bytes in base64, kept only in .env.
if (-not $config['NORPRESS_SECRETS_KEY']) {
  $bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $config['NORPRESS_SECRETS_KEY'] = [Convert]::ToBase64String($bytes)
  Add-Content -Path .env -Value ("NORPRESS_SECRETS_KEY=" + $config['NORPRESS_SECRETS_KEY']) -Encoding ascii
}
# every NORPRESS_* setting of .env (tracking, Turnstile, Logto, public address…) as configuration of the backend
foreach ($key in @($config.Keys)) { if ($key -like 'NORPRESS_*') { Set-Item "Env:$key" $config[$key] } }

$env:DB_USER = & $value 'NORPRESS_DB_USER' 'norpress'
$env:DB_URL = 'jdbc:postgresql://localhost:5433/' + (& $value 'NORPRESS_DB_NAME' 'norpress')
$env:DB_PASSWORD = $config['NORPRESS_DB_PASSWORD']
$env:AWS_ACCESS_KEY_ID = $config['NORPRESS_S3_ACCESS_KEY']
$env:AWS_SECRET_ACCESS_KEY = $config['NORPRESS_S3_SECRET_KEY']
$env:NORPRESS_S3_BUCKET = $bucket
$env:NORPRESS_S3_ENDPOINT = 'http://127.0.0.1:19010'
$env:NORPRESS_COOKIE_SECURE = 'false'
# Address shoppers come back to from the payment gateways. Wompi refuses localhost and 127.0.0.1 as a return address,
# but accepts *.localhost, which the browser resolves to this machine (for example http://tienda.localhost:8000).
$env:NORPRESS_PUBLIC_URL = & $value 'NORPRESS_PUBLIC_URL' 'http://localhost:8000'
mvn quarkus:dev
