# Documentación de Flux

Bienvenido a la documentación técnica de **Flux**, software de automatización de radio para escritorio.

Esta documentación está diseñada para desarrolladores y personal técnico que desee entender la arquitectura, el funcionamiento interno y los procesos de construcción del sistema.

## Índice de Contenidos

### 🏗️ Arquitectura y Diseño
- [Arquitectura General](architecture.md): Visión general de las capas Main, Preload y Renderer.
- [Audio Pipeline](audio-pipeline.md): Deep-dive en el routing de audio, EQ y multinivel de salida.
- [Modelo de Datos](data-model.md): Estructura de la base de datos SQLite y entidades Prisma.
- [Catálogo IPC](ipc.md): Lista de canales y protocolos de comunicación entre procesos.

### 🧩 Módulos del Sistema
- [Playout](modules/playout.md): El motor de reproducción, máquinas de estado y crossfade.
- [Playlists](modules/playlists.md): Gestión de bibliotecas y listas de reproducción.
- [Soundboard](modules/soundboard.md): Disparadores instantáneos de audio.
- [Tandas (Ad Breaks)](modules/ad-breaks.md): Reglas de inserción publicitaria automática.
- [Programas (Scheduler)](modules/programs.md): Programación horaria mediante Cron.
- [Integraciones](modules/integrations.md): Salidas físicas, monitoreo y streaming.
- [Perfiles](modules/profiles.md): Gestión multitenant local y workspaces.

### 🛠️ Guías de Desarrollo
- [Comenzando](getting-started.md): Requisitos, instalación y flujo de trabajo.
- [Testing](testing.md): Estrategia de pruebas unitarias y E2E.
- [Build y Release](build-and-release.md): Proceso de empaquetado y distribución.

### 📄 Decisiones Arquitectónicas (ADRs)
- [ADR 0001: Stack Base](adr/0001-electron-vite-stack.md)
- [ADR 0002: EQ via MediaElementSource](adr/0002-eq-via-mediaelementsource.md)

---
Para una visión general rápida orientada al usuario, consulta el [README.md](../README.md) en la raíz del proyecto.
