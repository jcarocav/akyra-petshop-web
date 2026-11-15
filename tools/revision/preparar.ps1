# Preparación de la herramienta de revisión (la llama REVISAR-CATALOGO.bat; no hace falta correrla a mano).
#  1. Instala una sola vez rembg (quitar fondos) y zxing-cpp (leer códigos de barras) con Python, y baja el modelo de rembg.
#  2. Crea una sola vez la regla del Firewall de Windows para el puerto de la herramienta, SOLO en redes privadas
#     (Windows pide "Permitir" / "Sí" una vez).
param([int]$Puerto = 8090)
$ErrorActionPreference = 'Continue'
$datos = Join-Path (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))) 'revision-catalogo'
New-Item -ItemType Directory -Force -Path $datos | Out-Null
$marca = Join-Path $datos '.instalado-python'

if (-not (Test-Path $marca)) {
  $python = Get-Command python -ErrorAction SilentlyContinue
  if (-not $python) {
    Write-Host 'Python no esta instalado: la herramienta funciona igual, pero sin quitar el fondo de las fotos ni leer codigos de barras.'
  } else {
    Write-Host 'Instalando (una sola vez) lo necesario para quitar fondos y leer codigos de barras. Puede tardar unos minutos...'
    & python -m pip install --user --quiet --disable-pip-version-check rembg onnxruntime zxing-cpp pillow
    Write-Host 'Bajando el modelo para quitar fondos (una sola vez, ~170 MB)...'
    & python -c "from rembg import new_session; new_session('u2net')"
    if ($LASTEXITCODE -eq 0) { Set-Content -Path $marca -Value (Get-Date -Format s) -Encoding utf8 }
  }
}

$nombreRegla = "Akyra revision catalogo (puerto $Puerto)"
$regla = Get-NetFirewallRule -DisplayName $nombreRegla -ErrorAction SilentlyContinue
if (-not $regla) {
  Write-Host 'Windows va a pedir permiso para que el celular pueda conectarse a este PC (solo en redes privadas). Responde "Si".'
  $orden = "New-NetFirewallRule -DisplayName '$nombreRegla' -Direction Inbound -Protocol TCP -LocalPort $Puerto -Profile Private -Action Allow | Out-Null"
  try { Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command', $orden } catch { Write-Host 'No se creo la regla del firewall: el celular podria no conectarse.' }
}
