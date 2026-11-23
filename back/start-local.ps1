$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$config = @{}
Get-Content .env | ForEach-Object { $pair = $_.Split('=', 2); if ($pair.Length -eq 2) { $config[$pair[0]] = $pair[1] } }
docker compose -p arisma-quarkus up -d
if ($LASTEXITCODE -ne 0) { throw 'No fue posible iniciar los servicios locales.' }
$env:MC_HOST_arisma = 'http://' + $config['ARISMA_S3_ACCESS_KEY'] + ':' + $config['ARISMA_S3_SECRET_KEY'] + '@objectstore:9000'
try {
  docker run --rm --network arisma-quarkus_default -e MC_HOST_arisma cgr.dev/chainguard/minio-client:latest mb --ignore-existing arisma/arisma-media
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible preparar el bucket local.' }
} finally { Remove-Item Env:MC_HOST_arisma -ErrorAction SilentlyContinue }
$env:DB_PASSWORD = $config['ARISMA_DB_PASSWORD']
$env:AWS_ACCESS_KEY_ID = $config['ARISMA_S3_ACCESS_KEY']
$env:AWS_SECRET_ACCESS_KEY = $config['ARISMA_S3_SECRET_KEY']
$env:ARISMA_S3_BUCKET = 'arisma-media'
$env:ARISMA_S3_ENDPOINT = 'http://127.0.0.1:19010'
$env:ARISMA_COOKIE_SECURE = 'false'
# Key that encrypts the payment credentials saved from the panel: 32 random bytes in base64, kept only in .env.
if (-not $config['ARISMA_SECRETS_KEY']) {
  $bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $config['ARISMA_SECRETS_KEY'] = [Convert]::ToBase64String($bytes)
  Add-Content -Path .env -Value ("ARISMA_SECRETS_KEY=" + $config['ARISMA_SECRETS_KEY']) -Encoding ascii
}
$env:ARISMA_SECRETS_KEY = $config['ARISMA_SECRETS_KEY']
# Address shoppers come back to from the payment gateways. Wompi refuses localhost and 127.0.0.1 as a return address,
# but accepts *.localhost, which the browser resolves to this machine: open the store at http://arisma.localhost:8000.
$env:ARISMA_PUBLIC_URL = if ($config['ARISMA_PUBLIC_URL']) { $config['ARISMA_PUBLIC_URL'] } else { 'http://arisma.localhost:8000' }
# Automatic shipment tracking (17TRACK): the key and the store's plan (free or plus) come from .env when present.
if ($config['ARISMA_TRACKING_KEY']) { $env:ARISMA_TRACKING_KEY = $config['ARISMA_TRACKING_KEY'] }
if ($config['ARISMA_TRACKING_PLAN']) { $env:ARISMA_TRACKING_PLAN = $config['ARISMA_TRACKING_PLAN'] }
# Cloudflare Turnstile on sign-in: both keys from .env, or no challenge at all.
if ($config['ARISMA_TURNSTILE_SITE_KEY']) { $env:ARISMA_TURNSTILE_SITE_KEY = $config['ARISMA_TURNSTILE_SITE_KEY'] }
if ($config['ARISMA_TURNSTILE_SECRET']) { $env:ARISMA_TURNSTILE_SECRET = $config['ARISMA_TURNSTILE_SECRET'] }
mvn quarkus:dev
