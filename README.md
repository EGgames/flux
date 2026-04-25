# flux

Software de automatización de radio para escritorio. Playout local, programación de tandas y programas, soundboard, salidas de audio múltiples y monitoreo en tiempo real.

---

## Tabla de Contenidos

- [Características](#características)
- [Stack](#stack)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Scripts](#scripts)
- [Arquitectura](#arquitectura)
- [Módulos](#módulos)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Testing](#testing)
- [Build de distribución](#build-de-distribución)

---

## Características

- **Playout** continuo de playlists con cola dinámica, avance automático y barra de progreso real basada en duración probada por `ffprobe`.
- **Workspace personalizable**: paneles arrastrables y redimensionables, persistidos por perfil.
- **Tandas (Ad Blocks)** disparables por hora del día o cada N tracks reproducidos.
- **Programas** con expresiones cron (`node-cron`) que activan playlists automáticamente.
- **Soundboard** con grilla de botones de disparo rápido y polifonía.
- **Múltiples perfiles** independientes (cada uno con su biblioteca, layout, configuración de outputs).
- **Salidas de audio en vivo**: enrutado a una salida principal y un monitor de cabina opcional, ambos configurables al instante sin detener el track (`HTMLMediaElement.setSinkId`).
- **Streaming** a servidores Icecast / Shoutcast.
- **Panel de Logs** integrado con eventos en tiempo real (track inicio/fin, tandas, errores, cambios de salida).

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
| Streaming | HTTP `PUT/SOURCE` a Icecast / Shoutcast |
| Tests unitarios | Vitest 2.1 + Testing Library + jsdom |
| Tests E2E | Serenity BDD + Cucumber |

---

## Requisitos

- **Node.js** ≥ 20 LTS
- **npm** ≥ 10
- **FFmpeg / ffprobe** en `PATH` (para detectar duraciones reales de los audios)
- **Java 17+** y **Maven 3.9+** sólo si vas a correr los tests E2E

---

## Instalación

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

El primer arranque crea la base SQLite en `%APPDATA%\flux\flux.db` (Windows) o equivalente del SO.

---

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Levanta Electron en modo desarrollo (HMR) |
| `npm run build` | Build de producción (electron-vite) |
| `npm run pack` | Empaqueta sin instalador (carpeta `dist/`) |
| `npm run dist` | Empaqueta instalador completo (electron-builder) |
| `npm run dist:win` | Empaqueta instalador para Windows |
| `npm run test` | Vitest run (one-shot) |
| `npm run test:watch` | Vitest watch |
| `npm run test:coverage` | Vitest con coverage v8 |
| `npm run e2e:serenity` | Suite E2E (Serenity + Cucumber) |
| `npm run e2e:serenity:report` | Agrega el reporte HTML de Serenity |

---

## Arquitectura

Electron multi-proceso con tres capas TypeScript estrictas:

- **Main** ([`src/main/`](src/main)) — acceso a DB vía Prisma, IPC handlers, services de playout / scheduler / streaming, servidor HTTP local que sirve archivos de audio con CORS habilitado.
- **Preload** ([`src/preload/`](src/preload)) — expone `window.electronAPI` con tipado estricto al renderer.
- **Renderer** ([`src/renderer/src/`](src/renderer/src)) — React app con hooks por dominio, services delgados envolviendo IPC, páginas y componentes con CSS Modules.

Flujo IPC:

```
Page → Hook (estado + acciones) → service (cliente IPC)
     → window.electronAPI (preload bridge)
     → *.ipc.ts (handler) → Prisma / Service
```

---

## Módulos

| Módulo | Página | Hook |
|---|---|---|
| Playout | `PlayoutPage` | `usePlayout` |
| Playlists | `PlaylistsPage` | — |
| Soundboard | `SoundboardPage` | `useSoundboard` |
| Ad Blocks (tandas) | `AdBreaksPage` | — |
| Programs (cron) | `ProgramsPage` | `usePrograms` |
| Integraciones (salidas + streaming) | `IntegrationsPage` | — |
| Profiles | `ProfilesPage` | `useProfiles` |

### Salidas de audio (sinkId + Monitor)

- **Salida principal**: el `<audio>` del Howl actual se rutea via `setSinkId(deviceId)` al device elegido. `default` = sink del sistema.
- **Monitor**: Howl secundario opcional que reproduce el mismo source en paralelo en otro device (uso típico: auriculares de cabina).
- **Permisos**: el proceso main otorga `media` automáticamente (`setPermissionRequestHandler`) para que Chromium devuelva los `deviceId` reales.
- **Hot-reload**: `IntegrationsPage` autoguarda y dispara `flux:outputs-changed`; `usePlayout` reaplica `setSinkId` sin reiniciar el track.

### Tandas (Ad Blocks)

Bloques de avisos disparables por hora exacta (con o sin día de la semana) o cada N tracks. El scheduler espera al final del track actual antes de inyectar el bloque.

### Programs (Scheduler)

Programación con expresiones cron via `node-cron`. Cada programa apunta a una playlist y se activa automáticamente.

### Streaming

`streamingService` empaqueta el audio del playout y lo envía por HTTP `PUT` (Icecast 2) o `SOURCE` (Shoutcast / Icecast 1).

---

## Estructura del proyecto

```
src/
├── main/                  # proceso main (Electron + Prisma)
│   ├── index.ts           # bootstrap + permission handler + audio HTTP server
│   ├── db.ts              # cliente Prisma
│   ├── ipc/               # handlers IPC por dominio
│   ├── services/          # playout, scheduler, streaming
│   └── utils/audio.ts     # ffprobe, normalización
├── preload/
│   └── index.ts           # bridge tipado: window.electronAPI
└── renderer/src/
    ├── App.tsx            # router + layout
    ├── components/        # Layout, Sidebar, NowPlayingBar, PanelWorkspace, ...
    ├── hooks/             # usePlayout, useSoundboard, useProfiles, usePrograms
    ├── pages/             # una carpeta por página
    ├── services/          # clientes IPC delgados
    ├── styles/
    └── types/
prisma/
└── schema.prisma          # modelo SQLite
e2e-tests/
└── ...                    # Serenity + Cucumber
```

---

## Testing

- **Unitarios + integración** (Vitest, jsdom): `src/renderer/src/__tests__/**` y `src/main/__tests__/**`.
- **E2E** (Serenity BDD + Cucumber): `e2e-tests/src/test/**`.
- **Cobertura**: `npm run test:coverage` (reporte HTML en `coverage/`).

Alias de paths configurado en [vitest.config.ts](vitest.config.ts):

- `@renderer/*` → `src/renderer/src/*`

---

## Build de distribución

```bash
npm run build       # bundles electron-vite
npm run dist:win    # instalador NSIS para Windows
```

Salida en `dist/`. La configuración del empaquetador vive en [electron-builder.yml](electron-builder.yml).

---

## Licencia

Privada / interna del proyecto.
