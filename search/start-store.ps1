# Starts the conversational search ("Pregúntale a…") of a client store next to Arisma's. It reads that store's
# catalog and keeps its own index. It needs stores/<slug>.json: the words of that store's trade (copy arisma.json
# and adapt it); without it the store works, only its assistant stays off.
#   ./start-store.ps1 <slug>
param([Parameter(Mandatory = $true)][string]$Slug)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if ($Slug -notmatch '^[a-z][a-z0-9]{1,30}$') { throw 'Nombre de tienda inválido.' }
$store = @{}
$file = "..\tiendas\$Slug\.env"
if (-not (Test-Path $file)) { throw "No existe la tienda $Slug." }
Get-Content $file | ForEach-Object { if ($_ -notmatch '^\s*#') { $pair = $_.Split('=', 2); if ($pair.Length -eq 2) { $store[$pair[0].Trim()] = $pair[1].Trim() } } }
if (-not (Test-Path "stores\$Slug.json")) { throw "Falta stores\$Slug.json: copia stores\arisma.json con las palabras del negocio de $Slug." }

$env:STORE_PROFILE = $Slug
$env:SEARCH_PORT = $store['SEARCH_PORT']
$env:CATALOG_URL = "http://127.0.0.1:$($store['PORT'])"
$env:SEARCH_DATA = (Join-Path $PSScriptRoot "..\tiendas\$Slug\search-index.json")
Write-Host "Buscador de ${Slug} en http://127.0.0.1:$($store['SEARCH_PORT'])"
pnpm start
