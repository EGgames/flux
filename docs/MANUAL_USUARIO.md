# Manual de Usuario — Flux

**Flux** es un software de automatización de radio para escritorio. Permite reproducir música en vivo, programar tandas publicitarias, organizar grillas semanales, ejecutar efectos desde un soundboard y transmitir a salidas locales y servidores de streaming (Icecast/Shoutcast).

---

## Tabla de Contenidos

1. [Conceptos básicos](#1-conceptos-básicos)
2. [Primeros pasos](#2-primeros-pasos)
3. [Playout — Panel de transmisión](#3-playout--panel-de-transmisión)
4. [Playlists — Gestión de listas](#4-playlists--gestión-de-listas)
5. [Tandas — Bloques publicitarios](#5-tandas--bloques-publicitarios)
6. [Programas — Grilla semanal](#6-programas--grilla-semanal)
7. [Soundboard — Efectos rápidos](#7-soundboard--efectos-rápidos)
8. [Perfiles — Configuraciones independientes](#8-perfiles--configuraciones-independientes)
9. [Integraciones — Salidas de audio](#9-integraciones--salidas-de-audio)
10. [Atajos y consejos](#10-atajos-y-consejos)
11. [Solución de problemas](#11-solución-de-problemas)

---

## 1. Conceptos básicos

| Término | Definición |
|---------|-----------|
| **Perfil** | Configuración independiente (playlists, tandas, programas, salidas). Permite separar varias emisoras en una misma instalación. |
| **Playlist** | Lista ordenada de pistas de audio reutilizable. |
| **Tanda** | Bloque de audios publicitarios disparable de forma manual o automática. |
| **Regla de tanda** | Condición que decide cuándo se dispara una tanda (horario fijo o cada N canciones). |
| **Programa** | Franja horaria con un horario y, opcionalmente, una playlist asociada. |
| **Sink / Salida** | Dispositivo físico o stream a donde sale el audio. |
| **Monitor** | Salida secundaria pensada para los auriculares de cabina. |

---

## 2. Primeros pasos

1. **Abrir la aplicación.** Se carga automáticamente el perfil por defecto.
2. **Configurar la salida** ([Integraciones](#9-integraciones--salidas-de-audio)): elegí la tarjeta de sonido principal y, si querés transmitir, completá los datos de Icecast o Shoutcast.
3. **Crear una playlist** ([Playlists](#4-playlists--gestión-de-listas)) e importar audios.
4. **(Opcional) Crear tandas** ([Tandas](#5-tandas--bloques-publicitarios)) y reglas de disparo.
5. **(Opcional) Definir la grilla semanal** ([Programas](#6-programas--grilla-semanal)).
6. **Iniciar la transmisión** desde [Playout](#3-playout--panel-de-transmisión).

---

## 3. Playout — Panel de transmisión

Es la pantalla central de operación. Muestra el estado en vivo y agrupa todos los controles de transporte.

### 3.1 Transporte

| Control | Acción |
|---------|--------|
| **Iniciar** | Comienza la reproducción de la playlist seleccionada. |
| **Stop** | Detiene la transmisión. |
| **⏮ / ⏭** | Pista anterior / siguiente. |
| **Cambiar** | Cambia de playlist con un *fade* automático para evitar cortes bruscos. |
| **Selector de playlist** | Elige manualmente la lista a reproducir. |

### 3.2 Ahora reproduciendo

Muestra el nombre de la pista, el archivo de origen, el tiempo transcurrido y la duración total. La barra de progreso permite hacer **seek**: hacé click en cualquier punto para saltar dentro del tema.

### 3.3 Cola

Lista las próximas pistas. Acciones:

- **Click**: selecciona la pista.
- **Doble click**: salta inmediatamente a esa pista.

### 3.4 Monitor de tandas

- **Tanda en curso**: cronómetro de tiempo transcurrido y restante estimado.
- **Próxima tanda**: cuenta regresiva si hay reglas horarias activas.
- **Aviso de tanda pendiente**: cuando una regla por horario se cumple durante un tema, aparece un mensaje del tipo *"La tanda X saldrá al terminar el tema actual"*. Esto evita cortar canciones por la mitad.

### 3.5 Ecualizador

EQ de 3 bandas con rango de **-12 dB a +12 dB**:

- **Bajos** (lowshelf @ 120 Hz)
- **Medios** (peaking @ 1 kHz)
- **Agudos** (highshelf @ 4.5 kHz)

Botones de **on/off** y **Reset**. Los cambios se aplican en tiempo real con una rampa suave (50 ms) para evitar clicks. El EQ se enruta automáticamente a la misma salida que el resto del audio (incluso si usás un *sink* personalizado).

### 3.6 Soundboard inline

Grid de pads para disparar efectos sin salir de Playout. Botones globales **Stop / Pausar / Reanudar todo** afectan a todos los pads activos.

### 3.7 Estadísticas

Muestra estado actual, número de pistas en cola y cantidad de canciones desde la última tanda (útil para reglas de tipo *cada N canciones*).

---

## 4. Playlists — Gestión de listas

### 4.1 Crear una playlist

1. Escribí el nombre en el input superior.
2. Click en **Crear**.

### 4.2 Agregar audios

Dos formas:

- Botón **+ Agregar audio** → abre el explorador de archivos.
- **Drag & drop** desde el explorador del sistema sobre la zona indicada.

Formatos soportados: **MP3, WAV, FLAC, M4A, AAC, OGG**.

### 4.3 Editar pistas

Cada fila muestra posición, nombre, duración y un botón ✕ para eliminarla. **Doble click** sobre una pista la reproduce inmediatamente (si no hay nada sonando, inicia la transmisión desde ese tema).

---

## 5. Tandas — Bloques publicitarios

Una **tanda** es un conjunto ordenado de audios publicitarios. Cada tanda puede tener varias **reglas de disparo**.

### 5.1 Crear una tanda

1. Escribí el nombre y click en **+ Crear**.
2. Seleccioná la tanda en la lista.
3. Click en **+ Audio** para sumar archivos.

### 5.2 Disparar manualmente

En la lista de tandas, junto al botón ✕ de eliminar, está el botón **▶ Disparar**. Inicia la tanda inmediatamente: hace fade out del tema actual, reproduce los audios en orden y al finalizar regresa a la playlist.

### 5.3 Reglas automáticas

Cada tanda puede tener varias reglas:

| Tipo | Cuándo dispara |
|------|---------------|
| **Horario** | A una hora específica de un día determinado de la semana. Podés agregar varias horas al mismo día. |
| **Nº de canciones** | Cada vez que se reproducen N canciones consecutivas sin tanda. |
| **Manual** | Sólo se dispara con el botón **▶ Disparar**. |

> **Importante:** Las reglas por **horario** no cortan el tema en curso. Esperan a que termine y disparan al inicio del próximo bloque (se muestra el aviso *"saldrá al terminar el tema actual"*).

> **Validación:** Una tanda debe tener al menos un audio antes de poder crear reglas.

---

## 6. Programas — Grilla semanal

Permite definir qué playlist suena en cada franja horaria de la semana.

### 6.1 Crear un programa

1. En la columna del día, click **+ Agregar**.
2. Completar:
   - **Nombre** (obligatorio).
   - **Hora inicio** y **Hora fin**.
   - **Playlist asociada** (opcional).
3. Guardar.

### 6.2 Visualización

Cada día muestra sus programas como tarjetas con nombre y horario. Para eliminar uno, usar el botón dentro de la tarjeta.

**Caso típico:** *Matutino 06:00–10:00 → Playlist A*, *Vespertino 10:00–14:00 → Playlist B*. Flux cambia de lista automáticamente al inicio de cada franja.

---

## 7. Soundboard — Efectos rápidos

Página dedicada a un grid de pads para jingles, separadores y efectos.

### 7.1 Asignar audio

Click en un pad vacío → se abre el selector de archivo. El nombre del audio aparece como etiqueta del pad.

### 7.2 Reproducir

Un click en un pad con audio asignado lo reproduce. Los pads son independientes entre sí: pueden sonar varios en simultáneo.

### 7.3 Controles globales

- **Stop todo**: detiene todos los efectos activos.
- **Pausar / Reanudar todo**: alterna pausa global.

---

## 8. Perfiles — Configuraciones independientes

Cada **perfil** es un universo separado: tiene sus propias playlists, tandas, programas y configuración de salidas.

### 8.1 Acciones

| Acción | Cómo |
|--------|------|
| **Crear** | Input nombre + **+ Crear**. |
| **Activar** | Botón **Seleccionar** en la tarjeta. |
| **Eliminar** | Botón ✕ (no se puede eliminar el perfil por defecto). |

El perfil activo se indica con un badge **Activo**.

**Caso típico:** una emisora con dos identidades (FM y online) usa un perfil distinto para cada una.

---

## 9. Integraciones — Salidas de audio

Configura *dónde* suena la radio. Se pueden activar varias salidas en simultáneo y los cambios se aplican **en vivo** sobre el track en reproducción (no hace falta detener ni reiniciar).

### 9.1 Salidas locales

- **Local (Tarjeta de sonido)**: salida principal por la que sale el audio al aire.
- **Monitor (cabina)**: salida secundaria, pensada para auriculares del locutor. Reproduce el mismo audio en paralelo en otro dispositivo físico.

**Cómo seleccionar el dispositivo:**

1. La primera vez que abrís Integraciones, el sistema solicita permiso de audio (necesario para que Windows/Chromium expongan los nombres reales de las tarjetas de sonido). Aceptalo.
2. Desplegá el selector y elegí el dispositivo. Aparece la lista completa de salidas que detecta el sistema operativo (incluyendo HDMI, USB, Bluetooth, virtual cables, etc.).
3. **El cambio se guarda y se aplica al instante**: no hace falta apretar Guardar. Vas a ver en el panel de Logs una entrada `Salida principal -> XXXXX…` o `Monitor -> XXXXX…` confirmando el ruteo.
4. El botón **Guardar** queda solo como respaldo manual.
5. El toggle **Habilitado** prende o apaga la salida (también se aplica en vivo).

> Caso típico de monitor: enviás el aire a la consola por la salida principal y escuchás el preview por unos auriculares enchufados a otra placa USB.

### 9.2 Streaming

| Servidor | Campos requeridos |
|----------|-------------------|
| **Icecast** | Host, Puerto, Mountpoint, Usuario, Contraseña |
| **Shoutcast** | Host, Puerto, Contraseña, Station ID |

Cada uno tiene:

- **Probar conexión**: verifica que el servidor responda.
- **Indicador visual** (dot): gris = deshabilitado, verde = conectado, rojo = error.
- **Guardar** persiste los cambios.

> Las salidas son acumulativas: podés transmitir a Icecast **y** sacar audio local al mismo tiempo.

---

## 10. Atajos y consejos

- **Layout de Playout**: los paneles son arrastrables y redimensionables. El layout se guarda por perfil.
- **EQ siempre activo**: dejarlo en 0 dB no afecta el sonido. Está pre-conectado al iniciar cada tema para evitar glitches al activarlo a mitad de canción.
- **Doble click** sobre una pista de la cola o de una playlist la reproduce al instante.
- **Cambiar de playlist en vivo**: usá el botón **Cambiar** (con fade) en lugar de **Stop → Iniciar** para no dejar silencio al aire.
- **Tandas de emergencia**: dejar reglas de tipo **Manual** para tandas que sólo se disparan cuando el operador lo decide.

---

## 11. Solución de problemas

| Problema | Causa probable / Solución |
|----------|--------------------------|
| **No se escucha nada** | Verificar en Integraciones que la salida local esté activa y apunte al device correcto. Mirar el panel de Logs: si dice `setSinkId fallo (NotFoundError…)` significa que el dispositivo ya no existe o el SO le cambió el ID — volver a seleccionarlo del selector. |
| **Los nombres de las tarjetas aparecen como `Salida abc123…`** | Falta el permiso de audio. Reiniciar la app y aceptar el prompt de micrófono. Sin ese permiso Chromium devuelve los `deviceId` anonimizados y `setSinkId` falla. |
| **Cambié el dispositivo pero el audio sigue saliendo por el anterior** | El cambio es instantáneo: revisá el panel de Logs, debe aparecer `Salida principal -> …` con el nuevo device. Si no aparece, presioná **Guardar** manualmente. |
| **Iniciar después de Detener no arranca el primer tema** | Resuelto: si seguís viéndolo, asegurate de estar en la última versión. |
| **El log se llena con entradas duplicadas** | Resuelto: `appendLog` deduplica entradas idénticas dentro de 1 segundo. |
| **El tema parece reiniciarse al activar EQ** | Resuelto: el EQ ahora se enruta a la misma salida configurada. Si persiste, verificar que el sink del navegador soporte `setSinkId` (Chromium 110+). |
| **La tanda no se dispara** | (1) Verificar que la tanda tenga al menos un audio. (2) Si es por horario, esperar a que termine el tema en curso (aparece el aviso). (3) Para disparo inmediato usar el botón **▶ Disparar**. |
| **El stream Icecast/Shoutcast no conecta** | Usar **Probar conexión**. Verificar host, puerto, credenciales y que el servidor esté online. |
| **El monitor de cabina no suena** | Confirmar que el toggle esté activo y que el dispositivo seleccionado **no sea el mismo** que la salida principal. Mirar el panel de Logs: debe aparecer `Monitor -> …` con el device correcto. |
| **Las playlists desaparecieron** | Probablemente cambiaste de **Perfil**. Cada perfil tiene sus propias listas. |
| **Cambios en la grilla no se aplican** | Los Programas se evalúan al iniciar la franja. Si ya está sonando otra playlist, esperar al próximo cambio o usar **Cambiar** manualmente. |

---

*Versión del documento: 1.1 — Actualizado: salidas de audio en vivo, monitor multi-device y diagnóstico via panel de Logs.*
