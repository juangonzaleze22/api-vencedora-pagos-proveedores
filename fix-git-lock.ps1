# Script para eliminar el archivo index.lock de Git bloqueado por OneDrive
# Ejecutar como Administrador si es necesario

Write-Host "Solucionando problema de index.lock..." -ForegroundColor Cyan

$projectPath = $PSScriptRoot
$lockFile = Join-Path $projectPath ".git\index.lock"

# Verificar si el archivo existe
if (Test-Path $lockFile) {
    Write-Host "Archivo encontrado: $lockFile" -ForegroundColor Yellow
    
    # Intentar detener procesos de OneDrive
    Write-Host "Deteniendo OneDrive temporalmente..." -ForegroundColor Yellow
    Stop-Process -Name "OneDrive" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    
    # Intentar eliminar el archivo
    try {
        Remove-Item $lockFile -Force -ErrorAction Stop
        Write-Host "Archivo index.lock eliminado exitosamente!" -ForegroundColor Green
    }
    catch {
        Write-Host "No se pudo eliminar el archivo: $_" -ForegroundColor Red
        Write-Host "Intenta eliminar manualmente desde el Explorador de Windows" -ForegroundColor Yellow
        Write-Host "Ruta: $lockFile" -ForegroundColor Gray
        exit 1
    }
    
    # Reiniciar OneDrive
    Write-Host "Reiniciando OneDrive..." -ForegroundColor Yellow
    $oneDrivePath = "$env:LOCALAPPDATA\Microsoft\OneDrive\OneDrive.exe"
    if (Test-Path $oneDrivePath) {
        Start-Process $oneDrivePath
        Write-Host "OneDrive reiniciado" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Problema resuelto! Ahora puedes ejecutar 'git add .' sin problemas." -ForegroundColor Green
}
else {
    Write-Host "No se encontro el archivo index.lock. Todo esta bien!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Para evitar este problema en el futuro:" -ForegroundColor Cyan
Write-Host "   1. Configura OneDrive para excluir la carpeta .git" -ForegroundColor Gray
Write-Host "   2. O mueve tus proyectos fuera de OneDrive" -ForegroundColor Gray
Write-Host "   3. Consulta ONEDRIVE_CONFIG.md para mas detalles" -ForegroundColor Gray
