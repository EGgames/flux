---
id: SPEC-001
status: IMPLEMENTED
feature: robustness-v1
created: 2026-04-26
updated: 2026-04-26
author: spec-generator
version: "1.0"
related-specs: []
---

# SPEC-001 · Robustness v1

Endurecimiento integral de FLUX para operación 24/7. Cubre los 5 ítems críticos del audit + 2 importantes.

## 1. REQUERIMIENTOS

### HU-1 · Captura global de errores
**Como** operador de radio
**Quiero** que la aplicación nunca quede en pantalla blanca cuando ocurra una excepción
**Para que** pueda seguir transmitiendo aún ante bugs imprevistos.

**Criterios:**
- **Dado** un error en cualquier componente React **Cuando** se dispara durante render **Entonces** se muestra un panel de fallback con botón "Reiniciar app" y el resto del UI no se pierde.
- **Dado** un `uncaughtException` o `unhandledRejection` en main **Cuando** ocurre **Entonces** se loguea con stack completo en `flux.log` y la app sigue corriendo.

### HU-2 · Watchdog de avance de playout
**Como** operador
**Quiero** que si el track actual deja de avanzar la app salte automáticamente al siguiente
**Para que** nunca haya silencio al aire.

**Criterios:**
- **Dado** estado `playing` con un track cargado **Cuando** la posición no avanza por más de `STALL_THRESHOLD_MS` (3000 ms) **Entonces** se invoca `playout.next()` y se loguea `playout_stall` con el track id.
- **Dado** un track que dispara `loaderror` en Howler **Cuando** ocurre **Entonces** se invoca `playout.next()` y se loguea `track_load_failed`.

### HU-3 · Backup automático de SQLite + migrations versionadas
**Como** operador
**Quiero** que mi base de datos se respalde automáticamente y las migraciones se apliquen al iniciar
**Para que** nunca pierda configuración ni quede en estado inconsistente tras un upgrade.

**Criterios:**
- **Dado** el arranque de la app **Cuando** existe `flux.db` **Entonces** se copia a `backups/flux.db.<ISO>.bak` antes de cualquier operación.
- **Dado** más de `MAX_BACKUPS` (7) backups en la carpeta **Cuando** se crea uno nuevo **Entonces** se eliminan los más antiguos.
- **Dado** una migración de Prisma pendiente **Cuando** la app inicia **Entonces** se ejecuta `prisma migrate deploy` y, si falla, se intenta restaurar desde el último backup.

### HU-4 · Reconexión de stream con backoff exponencial
**Como** operador
**Quiero** que si Icecast/Shoutcast cae el stream se reconecte solo
**Para que** el corte sea el más breve posible sin intervención.

**Criterios:**
- **Dado** una conexión Icecast/Shoutcast activa **Cuando** se desconecta inesperadamente **Entonces** se reintenta con delays 1s, 2s, 4s, 8s, 16s, 32s, 60s (cap 60s).
- **Dado** una reconexión exitosa **Cuando** ocurre **Entonces** el contador de delay vuelve a 1s.
- **Dado** `disconnect()` explícito por el usuario **Cuando** se llama **Entonces** se cancela el timer de reconexión.

### HU-5 · Validación de IPC con Zod
**Como** desarrollador
**Quiero** que cada handler IPC valide su payload con un schema Zod
**Para que** datos malformados no corrompan la DB ni revienten la app.

**Criterios:**
- **Dado** un payload inválido enviado por IPC **Cuando** se invoca un handler validado **Entonces** se rechaza con `Error("IPC validation failed: <ruta del campo>: <mensaje>")` y no se ejecuta el handler.
- **Dado** un payload válido **Cuando** se invoca **Entonces** el handler corre normalmente.

### HU-6 · Endurecimiento Electron
**Como** ingeniero de seguridad
**Quiero** baseline OWASP-Electron aplicado
**Para que** un eventual XSS no comprometa el sistema.

**Criterios:**
- `webPreferences.contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`, `sandbox: true` (donde compatible).
- CSP estricta en `index.html`: `default-src 'self'; media-src 'self' http://127.0.0.1:* local-audio:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'`.
- `setWindowOpenHandler` ya devuelve `deny` (mantener).

### HU-7 · Detección de cambio de dispositivo de audio
**Como** operador
**Quiero** que si conecto/desconecto la placa de audio se notifique
**Para que** pueda reasignar outputs sin reiniciar.

**Criterios:**
- **Dado** un cambio en `mediaDevices` **Cuando** ocurre **Entonces** se emite evento al renderer y aparece un toast no bloqueante.

## 2. DISEÑO

### Arquitectura

#### Backend (main)
- `src/main/services/loggerService.ts` — wrapper de `electron-log` con rotación 10 MB / 5 archivos. Expone `installGlobalHandlers()`.
- `src/main/services/backupService.ts` — `createBackup()`, `pruneOldBackups()`, `restoreLatest()`.
- `src/main/services/migrationService.ts` — `runMigrations()` que ejecuta `prisma migrate deploy` vía CLI; en error intenta restore.
- `src/main/services/audioWatchdogService.ts` — `track(getPositionMs)` y `untrack()`. Emite `playout:stall` por IPC.
- `src/main/services/streamingService.ts` — refactor `scheduleReconnect` con backoff exponencial real (intenta reconectar, no solo emite).
- `src/main/services/autoUpdaterService.ts` — wrapper opcional de `electron-updater` (disabled si `UPDATE_FEED_URL` no está).
- `src/main/utils/ipcValidation.ts` — `validatedHandle(channel, schema, fn)`.

#### Frontend (renderer)
- `src/renderer/src/components/ErrorBoundary/ErrorBoundary.tsx` — class component con `getDerivedStateFromError`.
- `src/renderer/src/hooks/useDeviceChange.ts` — listener de `navigator.mediaDevices.ondevicechange`.
- `src/renderer/src/components/Toast/StallToast.tsx` — toast on `playout:stall`.
- `App.tsx` — wrap routes en `<ErrorBoundary>`, instalar handlers globales (`window.onerror`, `window.onunhandledrejection`).

### Contratos IPC nuevos
- `playout:stall` (main → renderer): `{ trackId: string, reason: 'no_progress' | 'load_error' }`.
- `device:change` (renderer interno via mediaDevices).
- `app:log` (renderer → main): `{ level, message, context? }` para enviar errores del renderer al log persistente.

## 3. LISTA DE TAREAS

### Backend
- [x] `loggerService` con rotación + global handlers
- [x] `backupService` con createBackup / pruneOldBackups / restoreLatest
- [x] `migrationService` con prisma migrate deploy + fallback
- [x] `audioWatchdogService` con detección de stall
- [x] `streamingService` refactor backoff exponencial
- [x] `autoUpdaterService` opcional
- [x] `ipcValidation` helper con Zod
- [x] Aplicar validación a IPC `playlist:*` como ejemplo
- [x] Wire-up en `main/index.ts`

### Frontend
- [x] `ErrorBoundary` con fallback UI
- [x] `useDeviceChange` hook
- [x] `StallToast` component
- [x] `App.tsx` wrap + handlers globales
- [x] CSP en `index.html`

### QA
- [x] Tests unit: logger, backup, migration, watchdog, streaming reconnect, ipcValidation
- [x] Tests unit renderer: ErrorBoundary, useDeviceChange
- [x] E2E feature: robustness.feature
- [x] CI workflow GH Actions
- [x] Runbook + ADR

## Definición de Hecho
- 100% de tests verde (incluye tests nuevos)
- Coverage no baja del actual
- Sin nuevos errores TS strict
