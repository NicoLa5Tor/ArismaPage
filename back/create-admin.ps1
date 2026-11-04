$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$dbPassword = (Get-Content .env | Where-Object { $_ -like 'ARISMA_DB_PASSWORD=*' } | Select-Object -First 1).Split('=', 2)[1]
$env:DATABASE_URL = "postgresql://arisma:$dbPassword@127.0.0.1:5433/arisma_quarkus"
$env:ADMIN_EMAIL = Read-Host 'Correo del administrador'
$secure = Read-Host 'Contraseña (mínimo 12 caracteres)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  node scripts/create-admin.cjs
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:ADMIN_EMAIL -ErrorAction SilentlyContinue
}
