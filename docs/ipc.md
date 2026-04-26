# Catálogo de Canales IPC

La comunicación entre el proceso **Renderer** y el proceso **Main** se realiza mediante canales IPC (Inter-Process Communication). Flux utiliza un esquema de "Invocar y Esperar" (`ipcMain.handle` / `ipcRenderer.invoke`).

Todos los métodos están disponibles bajo `window.electronAPI.<namespace>`.

## 1. `profiles`
Gestión de perfiles de usuario y configuración de entorno.
- `getAll()`: Retorna todos los perfiles.
- `getById(id)`: Retorna un perfil específico.
- `create(data)`: Crea un nuevo perfil.
- `update(id, data)`: Actualiza preferencias o nombre.
- `delete(id)`: Elimina perfil y datos asociados.

## 2. `playout`
Control del motor de reproducción.
- `start(profileId, playlistId?, index?)`: Inicia la reproducción.
- `pause()` / `resume()` / `stop()`: Controles de transporte.
- `next()` / `previous()`: Salto de tracks.
- `getStatus()`: Obtiene el estado actual (track, posición, estado de la cola).

## 3. `playlists`
Gestión de la biblioteca de audio.
- `getAll(profileId)`: Lista todas las playlists del perfil.
- `getById(id)`: Detalles y items de una playlist.
- `save(data)`: Crea o actualiza una playlist.
- `addItem(playlistId, assetId)`: Añade un audio a la lista.

## 4. `audioAssets`
Gestión de archivos físicos.
- `scan(path)`: Escanea un archivo o carpeta para importar.
- `getMetadata(id)`: Retorna info de ffprobe.
- `update(id, data)`: Actualiza tags, fade-in/out.

## 5. `adBlocks` (Tandas)
Configuración de cortes publicitarios.
- `getAll(profileId)`: Lista bloques de tandas.
- `saveRule(rule)`: Configura cuándo debe dispararse una tanda (por hora o por hits).

## 6. `programs` (Scheduler)
Planificación de programas automáticos.
- `getAll(profileId)`: Lista programas cron.
- `save(program)`: Crea/actualiza un horario y su playlist asociada.

## 7. `outputs`
Configuración de hardware de audio.
- `getDevices()`: Lista dispositivos de salida detectados por el sistema.
- `saveConfiguration(config)`: Guarda qué dispositivo es Principal y cuál es Monitor.

## 8. `soundboard`
Configuración de la botonera instantánea.
- `getButtons(profileId)`: Retorna la grilla de sonidos.
- `assign(buttonId, assetId)`: Asocia un audio a un botón.

---

## Eventos (Main -> Renderer)
Canales a los que el Renderer se suscribe mediante `window.electronAPI.on(...)`:
- `flux:playout-status-changed`: Notifica cambios en el track actual o estado de reproducción.
- `flux:outputs-changed`: Notifica cuando el usuario cambia el dispositivo de salida en la configuración.
- `flux:ad-break-start / end`: Indica el inicio/fin de una tanda publicitaria.
