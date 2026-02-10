# Configuración Node.js en Hostinger – Error "Cannot find module .../dist/server.js"

Si ves en los logs:

- `Cannot find module '.../public_html//dist/server.js'` (con **doble barra** `//`)
- `Error setting directory to: .../public_html/` (ENOENT)

es que la **ruta de la aplicación** o el **archivo de entrada** en Hostinger están mal configurados.

## Cómo debe quedar en el panel de Hostinger

En la sección donde configuras la **aplicación Node.js** (Application / Node.js app):

| Campo | Valor correcto | Evitar |
|-------|----------------|--------|
| **Application root** (o "Start path") | `public_html` **sin barra al final** | `public_html/` |
| **Entry file** (o "Application startup file") | `dist/server.js` **sin barra al inicio** | `/dist/server.js` |

La ruta final que debe usar Hostinger es:

- `public_html` + `dist/server.js` → `public_html/dist/server.js`

Si pones **Application root** con barra al final (`public_html/`) y **Entry** con barra al inicio (`/dist/server.js`), puede generarse `public_html//dist/server.js` y fallar.

## Comprobar que `dist` existe

En el **Administrador de archivos** de Hostinger, dentro de la carpeta donde está el proyecto (por ejemplo `public_html`), debe existir:

```
public_html/
  dist/
    server.js   ← este archivo debe existir
  node_modules/
  package.json
```

Si no hay carpeta `dist` o no está `server.js`, el deploy no ha compilado bien. Asegúrate de que en el despliegue se ejecute:

1. `npm install`
2. `npm run build` (que genera `dist/`)

y que el **Application root** apunte a la carpeta que **contiene** a `dist` (normalmente `public_html`).

## Resumen

1. **Application root**: carpeta del proyecto, **sin** `/` al final (ej: `public_html`).
2. **Entry file**: `dist/server.js`, **sin** `/` al inicio.
3. Tras cambiar, guardar y reiniciar la aplicación Node.js en el panel.
