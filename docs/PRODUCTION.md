# FLUX — Checklist de Producción

> Guía de release, prerequisitos del sistema, rollback y hotfix para operadores y mantenedores.

---

## 1. Prerequisitos del sistema

Antes de instalar o distribuir FLUX, verificar que el sistema destino cumple:

| Requisito | Versión mínima | Verificación |
|-----------|---------------|--------------|
| **Windows** | 10 64-bit (build 1903+) | `winver` |
| **macOS** | 12 Monterey+ | `sw_vers -productVersion` |
| **Linux** | Ubuntu 20.04+ / Fedora 34+ | `uname -r` |
| **FFmpeg** | 4.4+ | `ffmpeg -version` |
| **ffprobe** | (incluido con FFmpeg) | `ffprobe -version` |
| RAM | 4 GB mínimo, 8 GB recomendado | — |
| Disco | 500 MB libres (+ librería de audio) | — |

### Instalación de FFmpeg

FLUX requiere `ffmpeg` y `ffprobe` en el `PATH` del sistema para análisis y conversión de audio.

**Windows:**
```powershell
# Con winget (recomendado)
winget install Gyan.FFmpeg

# O descargar desde https://ffmpeg.org/download.html y agregar al PATH
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt install ffmpeg
```

Verificar:
```bash
ffmpeg -version
ffprobe -version
```

---

## 2. Checklist pre-release

Ejecutar antes de cada publicación de release:

### 2.1 Tests

- [ ] `npm run test` — todos los tests pasan (187/187)
- [ ] `npm run test:coverage` — cobertura ≥ 80% en `src/main/` y `src/renderer/`
- [ ] E2E ejecutados en staging: `npm run e2e:serenity`

### 2.2 Build

- [ ] `npm run build` sin errores ni warnings de TypeScript
- [ ] `npm run dist` genera instalador en `bin/` (Windows: `.exe`, macOS: `.dmg`, Linux: `.AppImage`)
- [ ] Instalador probado en máquina limpia (sin node_modules)
- [ ] `better-sqlite3` se carga correctamente desde el instalador (verificar `asarUnpack`)

### 2.3 Funcionalidad crítica

- [ ] Playout: reproducción continua sin cortes en ≥ 30 min
- [ ] Soundboard: 16 botones responden sin latencia perceptible
- [ ] Tandas: disparo por regla horaria funciona
- [ ] Streaming Icecast: conexión, reconexión automática, desconexión limpia
- [ ] Backups automáticos: archivo `.bak` generado en `userData/backups/`
- [ ] Watchdog: stall detectado y `next()` invocado en ≤ 4 s
- [ ] Auto-updater: si `UPDATE_FEED_URL` está seteado, notificación de update aparece

### 2.4 Configuración de producción

- [ ] `.env.production` creado desde `.env.production.example` con valores reales
- [ ] `UPDATE_FEED_URL` apunta al feed correcto (GitHub Releases o S3)
- [ ] Contraseñas de Icecast/Shoutcast cambiadas desde valores default
- [ ] `LOG_LEVEL=info` (no `debug` en producción)

### 2.5 Base de datos

- [ ] `prisma/schema.prisma` y `prisma/migrations/` en sync
- [ ] Migración ejecutada correctamente en instalación limpia
- [ ] Backup manual creado antes del deploy

### 2.6 Seguridad

- [ ] `contextIsolation: true` en BrowserWindow
- [ ] `nodeIntegration: false`
- [ ] `webSecurity: true`
- [ ] Sin `allowRunningInsecureContent: true`
- [ ] Protocol `local-audio://` registrado con validación de ruta

### 2.7 Versionado

- [ ] `package.json` → `version` actualizado (semver)
- [ ] Tag de git creado: `git tag v<version>`
- [ ] CHANGELOG actualizado (si existe)
- [ ] GitHub Release creado con artefactos adjuntos

---

## 3. Procedimiento de release

```bash
# 1. Asegurarse en main actualizado
git checkout main
git pull origin main

# 2. Actualizar versión
npm version patch   # o minor / major según semver

# 3. Construir distributable
npm run dist

# 4. Crear tag y push (dispara CI)
git push origin main --tags
```

El CI (`.github/workflows/`) compila para las 3 plataformas y publica el GitHub Release automáticamente al detectar un tag `v*`.

---

## 4. Auto-updater — Setup

El auto-updater usa `electron-updater` con provider `generic`. Para activarlo:

1. Publicar el release en GitHub (o subir artefactos a S3).
2. Asegurarse de que `latest.yml` / `latest-mac.yml` / `latest-linux.yml` están accesibles públicamente.
3. Configurar `UPDATE_FEED_URL` en producción:
   - **GitHub Releases:** `https://github.com/<org>/flux/releases/latest/download`
   - **S3:** `https://s3.amazonaws.com/<bucket>/`
4. El updater verifica en segundo plano al iniciar la app. Si hay update disponible, notifica al usuario con opción de instalar.

### Rollback de auto-updater

Si un update falla o la nueva versión es inestable:

1. Descargar el instalador de la versión anterior desde GitHub Releases.
2. Ejecutar el instalador — sobreescribe la versión actual.
3. Si la DB tiene schema incompatible: ver sección 5 (rollback de base de datos).

---

## 5. Rollback de base de datos

### Rollback automático (arranque)

Si `prisma migrate deploy` falla al iniciar, la app restaura automáticamente el backup más reciente desde `userData/backups/` y registra el evento en `flux.log`.

### Rollback manual

```bash
# 1. Cerrar FLUX

# 2. Ir al directorio userData
# Windows: %APPDATA%\flux
# macOS:   ~/Library/Application Support/flux
# Linux:   ~/.config/flux

# 3. Listar backups disponibles
ls backups/

# 4. Restaurar el backup deseado
cp backups/flux.db.<TIMESTAMP>.bak flux.db

# 5. Reiniciar FLUX
```

---

## 6. Procedimiento de hotfix

Para bugs críticos en producción:

```bash
# 1. Crear rama de hotfix desde el tag de producción
git checkout -b hotfix/v<version>-fix v<version>

# 2. Aplicar el fix
# ...editar archivos...

# 3. Tests
npm run test

# 4. Actualizar versión patch
npm version patch

# 5. PR → main + merge
git push origin hotfix/v<version>-fix
# Crear PR, revisar, merge

# 6. Tag y release
git tag v<nueva-version>
git push origin main --tags
```

---

## 7. SLAs de referencia (MVP)

| Métrica | Objetivo |
|---------|---------|
| Latencia de reproducción (play → audio) | ≤ 200 ms |
| Detección de stall por watchdog | ≤ 4 s |
| Reconexión Icecast (intento 1) | ≤ 2 s |
| Tiempo de arranque (cold start) | ≤ 5 s |
| Disponibilidad (uptime diario) | ≥ 99 % |

---

## 8. Contacto y escalación

| Nivel | Contacto |
|-------|---------|
| L1 — Operativo | Ver [RUNBOOK.md](RUNBOOK.md) — diagnóstico rápido |
| L2 — Técnico | Revisar `flux.log` + abrir issue en GitHub |
| L3 — Crítico | Rollback inmediato → hotfix |
