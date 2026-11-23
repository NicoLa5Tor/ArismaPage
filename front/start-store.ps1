# Starts the store front of a client store (set up with back/scripts/new-store.cjs) next to Arisma's, against that
# store's own backend and search service. Until the store has its own home, "/" opens the catalog.
#   ./start-store.ps1 <slug>
param([Parameter(Mandatory = $true)][string]$Slug)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if ($Slug -notmatch '^[a-z][a-z0-9]{1,30}$') { throw 'Nombre de tienda inválido.' }
$store = @{}
$file = "..\tiendas\$Slug\.env"
if (-not (Test-Path $file)) { throw "No existe la tienda $Slug. Créala con: node ..\back\scripts\new-store.cjs crear $Slug" }
Get-Content $file | ForEach-Object { if ($_ -notmatch '^\s*#') { $pair = $_.Split('=', 2); if ($pair.Length -eq 2) { $store[$pair[0].Trim()] = $pair[1].Trim() } } }

$env:ARISMA_ADMIN_API_URL = "http://127.0.0.1:$($store['PORT'])"
$env:ARISMA_SEARCH_URL = "http://127.0.0.1:$($store['SEARCH_PORT'])"
$env:NEXT_DIST_DIR = ".next-$Slug"
$env:STORE_HOME = if ($store['STORE_HOME']) { $store['STORE_HOME'] } else { 'catalogo' }
# its own logo files in public/brand; none shows the store's name
$env:NEXT_PUBLIC_BRAND_LOGO = if ($store['BRAND_LOGO']) { $store['BRAND_LOGO'] } else { 'none' }
$env:NEXT_PUBLIC_BRAND_ICON = if ($store['BRAND_ICON']) { $store['BRAND_ICON'] } else { 'none' }
Write-Host "Tienda ${Slug}: abre http://${Slug}.localhost:$($store['FRONT_PORT']) (panel en /admin)"
npx next dev -p $store['FRONT_PORT']
