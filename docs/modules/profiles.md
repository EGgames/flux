# Gestión de Perfiles y Workspaces

Flux está diseñado para ser multitenant a nivel local. Esto significa que diferentes operadores o diferentes tipos de emisión pueden coexistir en la misma computadora utilizando **Perfiles**.

## Qué es un Perfil
Un perfil en Flux no es solo un nombre de usuario; es un silo de datos que incluye:
- Su propia biblioteca de **Playlists**.
- Sus propios **Programas** y horarios.
- Su propia configuración de **Hardware de Audio** (salidas).
- Su propio **Layout de UI** (posición de paneles, colores).

## Modo Multi-Perfil
Al iniciar la aplicación, Flux carga el perfil marcado como `isDefault`. Desde la configuración, el usuario puede crear nuevos perfiles.

### Cambio de Perfil
Cuando se cambia de perfil:
1. El **Playout Service** detiene cualquier reproducción activa para evitar fugas de audio entre perfiles.
2. El **Scheduler** limpia los crons del perfil anterior y carga los nuevos.
3. El **Renderer** recarga las preferencias visuales y limpia el estado global.

## Implementación Técnica
- **DB**: La tabla `Profile` es la raíz de casi todas las relaciones en `schema.prisma`.
- **Almacenamiento**: Las preferencias visuales (layout, modo oscuro, etc.) se guardan como un JSON string en el campo `preferences` de la tabla `Profile`.
- **Capa IPC**: Los servicios del backend siempre requieren un `profileId` para filtrar las consultas a la base de datos.
