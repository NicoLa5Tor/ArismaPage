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
mvn quarkus:dev
