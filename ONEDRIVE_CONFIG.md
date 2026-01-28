# Configuración de OneDrive para Excluir .git

Este documento explica cómo configurar OneDrive para excluir la carpeta `.git` y evitar problemas de bloqueo de archivos.

## Método 1: Exclusión Manual (Recomendado)

### Pasos:

1. **Abre la configuración de OneDrive:**
   - Haz clic en el ícono de OneDrive en la bandeja del sistema (systray)
   - O ve a: `Configuración > Cuenta > Administrar almacenamiento`

2. **Accede a la configuración de sincronización:**
   - Haz clic derecho en el ícono de OneDrive
   - Selecciona "Configuración" o "Settings"
   - Ve a la pestaña "Sincronización" o "Sync"

3. **Excluye carpetas:**
   - Haz clic en "Sincronizar carpetas" o "Choose folders"
   - Busca la opción "Excluir carpetas" o "Exclude folders"
   - Agrega la ruta: `Documentos\Projects\api-vencedora-pagos-proveedores\.git`

## Método 2: Usando PowerShell (Avanzado)

Ejecuta el siguiente comando en PowerShell como Administrador:

```powershell
# Detener OneDrive temporalmente
Stop-Process -Name "OneDrive" -Force -ErrorAction SilentlyContinue

# Eliminar el archivo de bloqueo
Remove-Item ".git\index.lock" -Force -ErrorAction SilentlyContinue

# Reiniciar OneDrive
Start-Process "$env:LOCALAPPDATA\Microsoft\OneDrive\OneDrive.exe"
```

## Método 3: Mover el Proyecto Fuera de OneDrive (Más Seguro)

Si trabajas frecuentemente con Git, considera mover tus proyectos de desarrollo fuera de OneDrive:

1. Mueve el proyecto a: `C:\Users\Juan\Documents\Projects\` (fuera de OneDrive)
2. O crea una carpeta dedicada: `C:\Dev\Projects\`

**Ventajas:**
- No hay conflictos de sincronización
- Mejor rendimiento
- Menos problemas con archivos temporales

## Solución Temporal Rápida

Si necesitas trabajar ahora mismo y el archivo está bloqueado:

1. Pausa temporalmente la sincronización de OneDrive
2. Elimina manualmente `.git\index.lock` desde el Explorador de Windows
3. Reanuda la sincronización

## Nota Importante

OneDrive sincroniza archivos en tiempo real, lo que puede causar problemas con:
- Archivos de bloqueo de Git (`.git/index.lock`)
- Archivos temporales de compilación
- Archivos de cache

**Recomendación:** Para proyectos de desarrollo, considera usar una carpeta fuera de OneDrive o configurar exclusiones específicas.
