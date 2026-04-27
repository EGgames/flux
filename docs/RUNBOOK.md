# Runbook de operación - FLUX Radio Automation

> Guía rápida para operadores y SRE. Cubre incidentes operativos comunes y herramientas de diagnóstico introducidas por SPEC-001 (Robustness v1).

## 1. Logs

- Ubicación: `userData/logs/flux.log` (rotación a 10 MB).
  - **Windows**: `%APPDATA%/flux/logs/flux.log`
  - **macOS**: `~/Library/Logs/flux/flux.log`
  - **Linux**: `~/.config/flux/logs/flux.log`
- Niveles disponibles: `info`, `warn`, `error`. Errores no atrapados (`uncaughtException`, `unhandledRejection`, `window.onerror`) se persisten automáticamente.
- Para reportar bugs incluir las últimas ~200 líneas + `flux.db` (con cuidado de privacidad).

## 2. Backups de base de datos

- Ubicación: `userData/backups/flux.db.<ISO_TIMESTAMP>.bak`
- Política: se conservan los **7 backups más recientes**. Mas viejos se eliminan automáticamente.
- Se crea un backup antes de cada `prisma migrate deploy` durante el arranque.

### Restaurar manualmente
1. Cerrar la app.
2. Renombrar `userData/flux.db` → `flux.db.broken`.
3. Copiar el backup deseado → `userData/flux.db`.
4. Iniciar la app.

### Restauración automática
Si la migración falla en arranque, la app intentará restaurar el backup más reciente y registrar el evento en `flux.log` (`[migrations] backup restored after failure`). Si la restauración también falla, la app continúa con la DB anterior y deja un `error` en el log.

## 3. Streaming - Reconexión

El cliente Icecast/Shoutcast aplica **backoff exponencial**:

| Intento | Delay |
|--------:|------:|
| 1       | 1 s   |
| 2       | 2 s   |
| 3       | 4 s   |
| 4       | 8 s   |
| 5       | 16 s  |
| 6       | 32 s  |
| 7+      | 60 s (cap) |

- El status `reconnecting` se emite por IPC `streaming:status-changed` con `message: "attempt #N"`.
- Al hacer **disconnect manual** la reconexión queda inhibida hasta el próximo `connectIcecast`/`connectShoutcast`.
- Forzar reconexión manual: `Disconnect` → `Connect` desde la pestaña Integraciones.

## 4. Watchdog de audio

- Polling cada 1 s, umbral de stall **3 s** sin progreso de posición.
- Solo activo cuando `isPlaying === true`.
- Se resetea automáticamente al cambiar de track o al pausar.
- Cuando dispara: emite IPC `playout:stall { trackId, reason }`. El renderer muestra un toast (`StallToast`) y la spec espera que `usePlayout` invoque `next()`.

### Si el watchdog dispara en falso
1. Verificar `flux.log` por errores de Howler o de la salida HTTP de audio.
2. Revisar el dispositivo de salida (puede haberse desconectado — ver hook `useDeviceChange`).
3. Aumentar `stallThresholdMs` solo en última instancia (requiere build custom).

## 5. ErrorBoundary

Si una excepción no controlada ocurre en el árbol React, se muestra un panel modal con:
- Mensaje del error
- Stack trace
- Botones **Reintentar** (limpia el estado del boundary) y **Reiniciar app** (`window.location.reload`).

El error se reporta vía IPC `app:log` y queda persistido en `flux.log` con `componentStack`.

## 6. Auto-updater

- Solo se activa si la variable de entorno `UPDATE_FEED_URL` está definida.
- Usa `electron-updater` (provider `generic`).
- Logs específicos con prefijo `[auto-updater]`.

## 7. Preflight checklist (al aire)

| Verificación | Comando / lugar |
|---|---|
| Backup reciente existe | `ls -lt userData/backups \| head` |
| Logs sin errores recientes | `tail -100 userData/logs/flux.log` |
| Stream test | botón "Test conexión" en Integraciones |
| Dispositivo audio | Configuración → Salida |
| Programa cargado | Dashboard → Programa actual |

## 8. Diagnóstico rápido

### "El audio se trabó"
1. ¿Apareció `StallToast`? → Sí: el watchdog ya saltó al siguiente track. Verificar el track origen en `flux.log`.
2. No apareció: revisar `useDeviceChange` (cambio de placa) y verificar que el archivo existe.

### "El stream no se conecta"
1. Probar `testConnection` en Integraciones.
2. Revisar `flux.log` por `[stream:<id>]` — busca status `error` y `attempt #N`.
3. Si está en `reconnecting attempt #7`+, está capeado en 60 s. Forzar disconnect/connect.

### "La app no abre"
1. Renombrar `userData/flux.db` y reabrir → si abre, el problema es la DB; restaurar backup.
2. Borrar `userData/logs/` por si rotación corrupta.
3. Revisar `flux.log` previo si quedó.
