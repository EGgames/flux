# flux

Radio automation desktop software con playout local, programación de tandas, soundboard, ecualizador paramétrico, mixer DJ, VU meter estéreo y monitoreo en tiempo real.

---

## Tabla de Contenidos

- [Características](#características)
- [Stack](#stack)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Scripts](#scripts)
- [Arquitectura](#arquitectura)
- [Módulos principales](#módulos-principales)
  - [Playout](#playout)
  - [Ecualizador (10 bandas ISO)](#ecualizador-10-bandas-iso)
  - [Panel de Logs](#panel-de-logs)
  - [Soundboard](#soundboard)
  - [Tandas / Ad Blocks](#tandas--ad-blocks)
  - [Programs / Scheduler](#programs--scheduler)
  - [Streaming Icecast/Shoutcast](#streaming-icecastshoutcast)
  - [Salidas de audio (sinkId + Monitor)](#salidas-de-audio-sinkid--monitor)
  - [VU Meter estéreo](#vu-meter-estéreo)
  - [Profiles](#profiles)
- [Testing](#testing)
- [Documentación adicional](#documentación-adicional)

---

## Características

- Reproducción continua de playlists con avance automático y crossfade-friendly (`Howler.js` + HTML5 audio pool).
- **Ecualizador paramétrico de 10 bandas ISO** estilo Winamp con presets predefinidos (Flat, Rock, Jazz, Pop, Clásico, Bass Boost, Treble Boost, Vocal, Dance, Loudness) y presets custom persistidos por perfil.
- **Panel de Logs** integrado al workspace de playout: registra cada cambio (track inicio/fin, tandas disparadas, errores de carga, conexión del EQ) con la hora del sistema.
- **Soundboard** con grilla de botones de disparo rápido (jingles, efectos).
- **Ad Blocks** programados por hora del día y/o cada N tracks.
- **Programs** con cron expressions (basado en `node-cron`).
- **Streaming** a servidores Icecast / Shoutcast.
- **Profiles** independientes (cada perfil tiene su biblioteca, EQ, layout y configuración).
- **Workspace personalizable**: paneles arrastrables y persistidos en `localStorage`.
- **Multi-output en vivo**: enrutado de la reproducción a una **salida principal** y un **monitor de cabina** independiente, ambos cambiables al instante sin detener el track (`HTMLMediaElement.setSinkId`). Los `deviceId` reales requieren permiso de audio (`media`), otorgado automáticamente por el proceso main. Self-healing: si Chromium pausa el `<audio>` tras un `setSinkId` fallido, el hook lo reanuda automáticamente y existe un botón **"Reaplicar salidas"** en el panel VU como recurso manual.
- **VU Meter estéreo** (L/R) en dBFS con zonas verde / amarillo / rojo, basado en `AnalyserNode` del Web Audio API. Las lecturas se cuantizan a 1 dB para evitar re-renders por frame.
- **Workspace personalizable**: paneles arrastrables, redimensionables y persistidos por perfil (en DB). Botón **Auto-ajustar** que reorganiza automáticamente la grilla con márgenes cómodos.

---

## Stack

| Capa | Tecnología |
|---|---|
| Desktop shell | Electron 33 |
| UI | React 19 + Vite 6 (electron-vite 2.3) |
| Lenguaje | TypeScript 5.7 (strict) |
| Estilos | CSS Modules |
| DB local | SQLite + Prisma 5.22 |
| Audio | Web Audio API + Howler.js 2.2 |
| Scheduling | node-cron 3.0 |
| Streaming | Custom encoder → Icecast/Shoutcast (HTTP) |
| Tests unitarios | Vitest 2.1 + Testing Library + jsdom |
| Tests E2E | Serenity BDD + Cucumber + Playwright/WebDriver |

---

## Requisitos

- **Node.js** ≥ 20 LTS
- **npm** ≥ 10
- **FFmpeg / ffprobe** en `PATH` (para detectar duraciones reales de los audios)
- **Java 17+** y **Maven 3.9+** sólo si vas a correr los tests E2E (Serenity)

---

## Instalación

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

---

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Levanta Electron en modo desarrollo (HMR) |
| `npm run build` | Build de producción (electron-vite) |
| `npm run dist` | Empaqueta instalador (electron-builder) |
| `npm run test` | Vitest run (one-shot) |
| `npm run test:watch` | Vitest watch |
| `npm run test:coverage` | Vitest con coverage v8 (umbral objetivo ≥ 90%) |
| `npm run e2e:serenity` | Suite E2E completa via `run-e2e.sh` |
| `npm run e2e:serenity:report` | Agrega el reporte HTML de Serenity |

---

## Arquitectura

Electron multi-proceso con tres capas TS estrictas:

- **Main** (`src/main/`) — acceso a DB vía Prisma, IPC handlers, services de playout/scheduler/streaming, servidor HTTP local que sirve archivos de audio con CORS habilitado.
- **Preload** (`src/preload/`) — expone `window.electronAPI` con tipado estricto al renderer.
- **Renderer** (`src/renderer/src/`) — React app con hooks por dominio, services delgados envolviendo IPC, páginas y componentes con CSS Modules.

Flujo IPC: `Page` → `Hook` (estado + acciones) → `service` (cliente IPC) → `electronAPI` (preload bridge) → `*.ipc.ts` (handler) → Prisma / Service.

---

## Módulos principales

### Playout

- Cola dinamica con preload del siguiente track.
- Progress bar real basada en `track.durationMs` (de la DB) con upgrade monotónico cuando `<audio>` reporta una duración más precisa.
- Dedupe de "start" por `track.id` para evitar reinicios espontáneos.
- Disparo automático de tandas según reglas (hora o conteo).
- Hook principal: `usePlayout()` (`src/renderer/src/hooks/usePlayout.ts`).

### Ecualizador (10 bandas ISO)

Ecualizador paramétrico estilo Winamp implementado con `BiquadFilterNode` del Web Audio API.

| Característica | Detalle |
|---|---|
| Bandas | 10 (ISO octava): 31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz |
| Tipos | `lowshelf` (31Hz) + 8× `peaking` (Q=√2) + `highshelf` (16kHz) |
| Rango | ±12 dB por banda |
| Presets built-in | Flat, Rock, Jazz, Pop, Clásico, Bass Boost, Treble Boost, Vocal, Dance, Loudness |
| Presets custom | Guardar / Eliminar (no permite borrar built-in ni nombres duplicados) |
| Persistencia | `localStorage` clave `eq:v2:<profileId>` |
| On/Off | Bypass via ganancia 0 dB en todas las bandas (biquads con gain=0 son identidad matemática) |
| Topología | Grafo Web Audio estático: `source → nodes[0..9] → destination`. Jamás se reconfigura en runtime (evita glitches). |
| CORS | El constructor global `window.Audio` se parchea para que TODO `<audio>` nazca con `crossOrigin='anonymous'`, requisito para que `createMediaElementSource()` reciba samples reales en lugar de silencio. |
| Cache | `WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>` para reusar nodos cuando Howler recicla elementos del pool. |

Spec: [.github/specs/ecualizador-configurable.spec.md](.github/specs/ecualizador-configurable.spec.md) (status `IMPLEMENTED`).

### Panel de Logs

Registro de actividad en tiempo real, integrado como panel del workspace de playout.

- Niveles: `info` / `warn` / `error`.
- Buffer en memoria: últimas 500 entradas (constante `MAX_LOG_ENTRIES`).
- Cada entrada se renderiza con la hora local (`toLocaleTimeString()`).
- Botón "Limpiar" para resetear el log.
- Eventos registrados: track inicio/fin, tanda disparada, errores de carga, conexión/error del EQ, cambios de sink, etc.

### Soundboard

Grilla configurable de botones por perfil. Cada botón dispara un audio asset con polifonía (varios pueden sonar simultáneamente).

### Tandas / Ad Blocks

Bloques de avisos disparables por:
- **Tiempo**: hora exacta (con o sin día de la semana).
- **Conteo**: cada N tracks reproducidos.

El scheduler interno calcula el próximo disparo y lo encola sin interrumpir el track actual (espera al final).

### Programs / Scheduler

Programación de programas con expresiones cron via `node-cron`. Cada programa apunta a una playlist y se activa automáticamente.

### Streaming Icecast/Shoutcast

El `streamingService` empaqueta el audio capturado del playout y lo envía por HTTP `PUT/SOURCE` a un servidor Icecast (o Shoutcast v1/v2 con compatibilidad).

### Salidas de audio (sinkId + Monitor)

Gestión del enrutado de audio hacia tarjetas físicas configurada en `IntegrationsPage` y aplicada por `usePlayout`.

| Pieza | Detalle |
|---|---|
| Salida principal | Howl HTML5 cuyo `<audio>` se rutea vía `setSinkId(deviceId)` al device elegido. `default` = sink del sistema. |
| Monitor | Howl secundario opcional que reproduce el **mismo source** en paralelo en otro device (uso típico: auriculares de cabina). Se crea/destruye al vuelo. |
| Permisos | Main process otorga `media` automáticamente (`setPermissionRequestHandler`). Sin esto, Chromium devuelve `deviceId` opacos y `setSinkId` rechaza con `NotFoundError`. |
| Hot-reload | `IntegrationsPage` autoguarda al cambiar el dropdown y despacha `window.dispatchEvent(new CustomEvent('flux:outputs-changed'))`. `usePlayout` escucha y reaplica `setSinkId` al Howl actual + crea/destruye `monitorHowl` sin reiniciar el track. |
| Resiliencia | `setSinkId` reintenta hasta 3 veces con 120ms de espera (cubre `AbortError` cuando el `<audio>` aún no adjuntó el src). Éxito parcial sobre el pool html5 de Howler se considera éxito (basta con un nodo enrutado). |
| Auto-recovery | Tras cada `setSinkId` y en el tick de 1 Hz, si el `<audio>` quedó `paused && !ended` se reanuda solo (`audioEl.play()`). Sin esto, un `setSinkId` fallido congelaba la barra de tiempo y dejaba sin audio. |
| Recovery manual | Botón **"Reaplicar salidas"** en el panel VU del workspace de Playout invoca `reapplyOutputs()` que re-lee Local + Monitor desde DB y reaplica `setSinkId` al Howl actual sin reiniciar el track. |
| Logs | Cada cambio se registra en el panel: `Salida principal -> XXXXX…`, `Monitor -> XXXXX…` o `setSinkId fallo (NotFoundError: …)`. |

### VU Meter estéreo

Medidor de niveles L/R en dBFS, integrado como panel del workspace de Playout.

| Pieza | Detalle |
|---|---|
| Análisis | Dos `AnalyserNode` (uno por canal) conectados a un `ChannelSplitterNode` que toma la salida de la cadena del EQ. |
| Escala | dBFS con piso `-Infinity` y techo 0 dB. Zonas: verde (≤-18), amarillo (-18 a -6), rojo (>-6). |
| Performance | Loop `requestAnimationFrame` ~30 fps. Las lecturas se cuantizan a entero (1 dB) y `setVuLevels` solo dispara si cambia el valor: evita re-render storm en `usePlayout` y `PlayoutPage`. |
| Componente | [`src/renderer/src/components/VUMeter/VUMeter.tsx`](src/renderer/src/components/VUMeter/VUMeter.tsx) |

### Profiles

Múltiples perfiles independientes. Cada uno tiene su propia biblioteca, layout, EQ y configuración de outputs/streaming.

### Efectos de Audio (Crossfade + Fades por tema + Mixer DJ)

Página dedicada (`/efectos` en el sidebar) con tres pestañas:

| Pestaña | Detalle |
|---|---|
| **Global** | Activa/desactiva el crossfade automático entre temas. Duración configurable 0.5–15 s. Curva: `equal-power` (recomendada, mantiene volumen percibido constante) o `linear`. Persistencia por perfil en `AudioEffectsConfig`. |
| **Por tema** | Define `fadeInMs` y `fadeOutMs` propios por `AudioAsset`. Rango 0–15 000 ms (valores no positivos = `null`). |
| **Mixer DJ** | Dos decks (A/B) + crossfader equal-power. Cada deck con play/pause, volumen y CUE para enrutar al device de Monitor configurado en Integraciones. Reusable como panel del workspace de Playout. |

**Regla de prioridad (RN-03):** el fade efectivo aplicado al cambiar de tema es `max(crossfade global, fadeInMs/fadeOutMs del asset)`. Si el global está OFF, mandan los fades por tema; si no hay fades por tema, manda el global.

Hooks/servicios: `useMixer` (`src/renderer/src/hooks/useMixer.ts`), `audioEffectsService` (`src/renderer/src/services/audioEffectsService.ts`). IPC: `audio-effects:get`, `audio-effects:update`, `audio-assets:update-fades`.

Spec: [.github/specs/efectos-de-audio.spec.md](.github/specs/efectos-de-audio.spec.md) (status `IMPLEMENTED`).

---

## Testing

- **Unitarios + integración** (Vitest, jsdom): `src/renderer/src/__tests__/**` + `src/main/__tests__/**`.
- **E2E** (Serenity BDD + Cucumber): `e2e-tests/src/test/**`.
- **Cobertura objetivo**: ≥ 90% (statements/branches/functions/lines).
- **Comando**: `npm run test:coverage`. Reporte HTML en `coverage/`.

Alias de paths configurado en `vitest.config.ts`:
- `@renderer/*` → `src/renderer/src/*`

---

## Documentación adicional

- [Manual de Usuario](docs/MANUAL_USUARIO.md)
- [Spec MVP Local (SPEC-002)](.github/specs/radioboss-mvp-local.spec.md)
- [Spec Ecualizador (SPEC-003)](.github/specs/ecualizador-configurable.spec.md)
- [Lineamientos de Desarrollo](.github/docs/lineamientos/dev-guidelines.md)
- [Lineamientos QA](.github/docs/lineamientos/qa-guidelines.md)

