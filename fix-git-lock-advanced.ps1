# Script avanzado para eliminar el archivo index.lock de Git bloqueado
# Ejecutar como Administrador

param(
    [switch]$Force
)

$projectPath = $PSScriptRoot
$lockFile = Join-Path $projectPath ".git\index.lock"

Write-Host "=== Solucionador de index.lock ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $lockFile)) {
    Write-Host "No se encontro el archivo index.lock. Todo esta bien!" -ForegroundColor Green
    exit 0
}

Write-Host "Archivo encontrado: $lockFile" -ForegroundColor Yellow
Write-Host ""

# Intentar encontrar que proceso esta usando el archivo
Write-Host "Buscando procesos que puedan estar bloqueando el archivo..." -ForegroundColor Yellow
$processes = Get-Process | Where-Object {
    $_.Path -like "*OneDrive*" -or 
    $_.ProcessName -like "*git*" -or
    $_.ProcessName -like "*node*"
}

if ($processes) {
    Write-Host "Procesos encontrados que podrian estar bloqueando:" -ForegroundColor Yellow
    $processes | ForEach-Object {
        Write-Host "  - $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Gray
    }
    Write-Host ""
}

# Detener OneDrive
Write-Host "Deteniendo OneDrive..." -ForegroundColor Yellow
Get-Process -Name "OneDrive" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# Detener cualquier proceso de Git
Write-Host "Deteniendo procesos de Git..." -ForegroundColor Yellow
Get-Process -Name "git*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Intentar eliminar el archivo
Write-Host "Intentando eliminar el archivo..." -ForegroundColor Yellow
$maxAttempts = 5
$attempt = 0
$success = $false

while ($attempt -lt $maxAttempts -and -not $success) {
    $attempt++
    Write-Host "Intento $attempt de $maxAttempts..." -ForegroundColor Gray
    
    try {
        # Intentar tomar propiedad del archivo
        if ($Force) {
            $acl = Get-Acl $lockFile
            $permission = $acl.Access | Where-Object { $_.IdentityReference -eq $env:USERNAME }
            if (-not $permission) {
                Write-Host "  Tomando propiedad del archivo..." -ForegroundColor Gray
                takeown /F $lockFile 2>$null
                icacls $lockFile /grant "${env:USERNAME}:F" 2>$null
            }
        }
        
        Remove-Item $lockFile -Force -ErrorAction Stop
        Write-Host "  Archivo eliminado exitosamente!" -ForegroundColor Green
        $success = $true
    }
    catch {
        if ($attempt -lt $maxAttempts) {
            Write-Host "  Fallo. Esperando 2 segundos..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }
        else {
            Write-Host ""
            Write-Host "ERROR: No se pudo eliminar el archivo despues de $maxAttempts intentos." -ForegroundColor Red
            Write-Host "Error: $_" -ForegroundColor Red
            Write-Host ""
            Write-Host "SOLUCION MANUAL:" -ForegroundColor Yellow
            Write-Host "1. Cierra todas las ventanas de Cursor/VS Code" -ForegroundColor White
            Write-Host "2. Cierra OneDrive desde la bandeja del sistema" -ForegroundColor White
            Write-Host "3. Elimina manualmente el archivo desde el Explorador de Windows:" -ForegroundColor White
            Write-Host "   $lockFile" -ForegroundColor Gray
            Write-Host "4. Reinicia OneDrive y Cursor" -ForegroundColor White
            exit 1
        }
    }
}

# Reiniciar OneDrive
Write-Host ""
Write-Host "Reiniciando OneDrive..." -ForegroundColor Yellow
$oneDrivePath = "$env:LOCALAPPDATA\Microsoft\OneDrive\OneDrive.exe"
if (Test-Path $oneDrivePath) {
    Start-Process $oneDrivePath
    Start-Sleep -Seconds 2
    Write-Host "OneDrive reiniciado" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Problema resuelto! ===" -ForegroundColor Green
Write-Host "Ahora puedes ejecutar 'git add .' sin problemas." -ForegroundColor Green
Write-Host ""
Write-Host "Para evitar este problema en el futuro, consulta ONEDRIVE_CONFIG.md" -ForegroundColor Cyan
