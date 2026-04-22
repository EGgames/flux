---
id: SPEC-002
status: IN_PROGRESS
feature: flux-mvp-local
created: 2026-04-22
updated: 2026-04-22
author: spec-generator
version: "1.1"
stack: "Electron 33 + React 19 + Vite + TypeScript + Prisma + SQLite"
related-specs: []
---

# Spec: FLUX MVP Local

> **Estado:** `DRAFT` → aprobar con `status: APPROVED` antes de iniciar implementacion.
> **Ciclo de vida:** DRAFT → APPROVED → IN_PROGRESS → IMPLEMENTED → DEPRECATED

---

## 1. REQUERIMIENTOS

### Descripcion
El sistema debe proveer una plataforma de automatizacion radial de escritorio local para Windows, con capacidad de reproduccion musical, automatizacion de tandas, botonera de disparo rapido, gestion de listas y programacion de programas. Debe operar en modo local-first, con salida de audio local y emision por Icecast y Shoutcast.

### Requerimiento de Negocio
Fuente principal: `.github/requirements/flux-mvp-local.md`.

Resumen del requerimiento base:
- Producto de escritorio local en Windows con potencial de evolucion a web y multi OS.
- Soporte de fuentes de audio locales y streaming.
- Tandas publicitarias con reglas mixtas configurables.
- Botonera de 16 botones configurables.
- Gestion de playlists y programas de radio configurables.
- Perfiles locales sin password.
- Integraciones de salida: PC local, Icecast y Shoutcast.
- Todo el alcance definido es obligatorio en MVP.

### Historias de Usuario

#### HU-01: Reproducir musica desde multiples fuentes

```
Como:        Usuario operador
Quiero:      reproducir audio desde fuentes locales y streaming
Para:        mantener continuidad de emision sin interrupciones

Prioridad:   Alta
Estimacion:  L
Dependencias: Ninguna
Capa:        Ambas
```

#### Criterios de Aceptacion — HU-01

**Happy Path**
```gherkin
CRITERIO-1.1: Reproduccion continua en playout
  Dado que:  el Usuario tiene libreria y playlist cargadas
  Cuando:    inicia la reproduccion automatica
  Entonces:  el sistema reproduce audio en continuidad sin cortes perceptibles
  Y:         la salida local de PC permanece activa
```

**Error Path**
```gherkin
CRITERIO-1.2: Fuente no disponible
  Dado que:  una fuente de streaming configurada esta caida
  Cuando:    el sistema intenta reproducir esa fuente
  Entonces:  se registra el error y se salta a la siguiente fuente valida
  Y:         la emision no se detiene
```

**Edge Case** *(si aplica)*
```gherkin
CRITERIO-1.3: Cambio de fuente en caliente
  Dado que:  hay reproduccion activa
  Cuando:    el Usuario cambia de una fuente local a una fuente streaming
  Entonces:  la transicion se realiza sin reiniciar la aplicacion
```

#### HU-02: Configurar y ejecutar tandas publicitarias mixtas

```
Como:        Usuario operador
Quiero:      definir tandas por horario, por cantidad de canciones y manual
Para:        automatizar bloques publicitarios segun necesidad operativa

Prioridad:   Alta
Estimacion:  L
Dependencias: HU-01
Capa:        Ambas
```

#### Criterios de Aceptacion — HU-02

**Happy Path**
```gherkin
CRITERIO-2.1: Tanda por reglas mixtas
  Dado que:  el Usuario configuro reglas de tanda mixtas
  Cuando:    se cumple una condicion de disparo
  Entonces:  se ejecuta la tanda correspondiente
  Y:         al finalizar retorna al flujo musical esperado
```

**Error Path**
```gherkin
CRITERIO-2.2: Regla invalida
  Dado que:  el Usuario intenta guardar una regla incompleta
  Cuando:    confirma la configuracion
  Entonces:  el sistema rechaza el guardado y muestra mensaje de validacion
```

**Edge Case** *(si aplica)*
```gherkin
CRITERIO-2.3: Colision de reglas
  Dado que:  dos reglas se cumplen al mismo tiempo
  Cuando:    llega el momento de ejecucion
  Entonces:  se aplica la prioridad definida por configuracion
```

#### HU-03: Usar botonera de 16 botones configurables

```
Como:        Usuario operador
Quiero:      disparar audio desde una botonera de 16 botones
Para:        reaccionar rapido en vivo con jingles, efectos o pistas

Prioridad:   Alta
Estimacion:  M
Dependencias: HU-01
Capa:        Frontend
```

#### Criterios de Aceptacion — HU-03

**Happy Path**
```gherkin
CRITERIO-3.1: Disparo de boton configurado
  Dado que:  el Usuario configuro un boton con un recurso de audio
  Cuando:    presiona ese boton
  Entonces:  el recurso se dispara de inmediato
  Y:         el estado visual del boton refleja la ejecucion
```

**Error Path**
```gherkin
CRITERIO-3.2: Boton sin asignacion
  Dado que:  un boton no tiene recurso configurado
  Cuando:    el Usuario intenta dispararlo
  Entonces:  el sistema no reproduce audio y muestra aviso
```

**Edge Case** *(si aplica)*
```gherkin
CRITERIO-3.3: Reconfiguracion en operacion
  Dado que:  hay reproduccion activa
  Cuando:    el Usuario modifica la asignacion de un boton
  Entonces:  el nuevo recurso queda disponible sin reiniciar
```

#### HU-04: Gestionar playlists y programas de radio

```
Como:        Usuario operador
Quiero:      crear playlists y programas con reglas por franja
Para:        estructurar la emision diaria

Prioridad:   Alta
Estimacion:  L
Dependencias: HU-01
Capa:        Ambas
```

#### Criterios de Aceptacion — HU-04

**Happy Path**
```gherkin
CRITERIO-4.1: Programacion por grilla
  Dado que:  el Usuario creo programas y asigno playlists
  Cuando:    llega la franja horaria de un programa
  Entonces:  el sistema activa el programa correcto
```

**Error Path**
```gherkin
CRITERIO-4.2: Playlist inexistente
  Dado que:  un programa referencia una playlist eliminada
  Cuando:    el sistema intenta ejecutar el programa
  Entonces:  se informa el error y se aplica fallback configurado
```

**Edge Case** *(si aplica)*
```gherkin
CRITERIO-4.3: Solapamiento de programas
  Dado que:  dos programas se superponen en horario
  Cuando:    comienza el rango compartido
  Entonces:  el sistema aplica la prioridad definida por Usuario
```

#### HU-05: Crear perfiles locales sin password

```
Como:        Usuario operador
Quiero:      crear y seleccionar mi Perfil sin password
Para:        separar configuraciones operativas rapidamente

Prioridad:   Alta
Estimacion:  S
Dependencias: Ninguna
Capa:        Ambas
```

#### Criterios de Aceptacion — HU-05

**Happy Path**
```gherkin
CRITERIO-5.1: Alta de Perfil local
  Dado que:  la app esta instalada en Windows
  Cuando:    el Usuario crea un nuevo Perfil
  Entonces:  el Perfil queda disponible para seleccion inmediata
```

**Error Path**
```gherkin
CRITERIO-5.2: Nombre de Perfil duplicado
  Dado que:  ya existe un Perfil con el mismo nombre
  Cuando:    el Usuario intenta crearlo nuevamente
  Entonces:  el sistema impide el duplicado
```

**Edge Case** *(si aplica)*
```gherkin
CRITERIO-5.3: Cambio de Perfil en operacion
  Dado que:  hay una sesion activa
  Cuando:    el Usuario cambia de Perfil
  Entonces:  se cargan las configuraciones del nuevo Perfil
```

#### HU-06: Emitir por salida local, Icecast y Shoutcast

```
Como:        Usuario operador
Quiero:      enviar audio a salida local y servidores de streaming
Para:        cubrir emision local y online en simultaneo

Prioridad:   Alta
Estimacion:  M
Dependencias: HU-01
Capa:        Backend
```

#### Criterios de Aceptacion — HU-06

**Happy Path**
```gherkin
CRITERIO-6.1: Emision multi salida
  Dado que:  el Usuario configuro salida local, Icecast y Shoutcast
  Cuando:    inicia la emision
  Entonces:  el audio se transmite por los tres canales
```

**Error Path**
```gherkin
CRITERIO-6.2: Falla de una integracion
  Dado que:  Icecast rechaza la conexion
  Cuando:    se inicia la emision
  Entonces:  la salida local y Shoutcast continan activas
  Y:         se registra error de Icecast
```

**Edge Case** *(si aplica)*
```gherkin
CRITERIO-6.3: Reconexion automatica
  Dado que:  una conexion de streaming se interrumpe
  Cuando:    el sistema detecta corte
  Entonces:  intenta reconectar con politica configurable
```

### Reglas de Negocio
1. La botonera debe tener exactamente 16 botones configurables por Perfil.
2. Todas las funcionalidades del alcance son obligatorias en el MVP, sin excluir modulos.
3. El sistema debe permitir reglas mixtas de tanda y resolver conflictos por prioridad configurable.
4. Los programas de radio y playlists deben poder asociarse por franja horaria configurable.
5. Los perfiles son locales y no requieren password en MVP.
6. La salida local de PC debe mantenerse disponible aun si fallan integraciones de streaming.

---

## 2. DISENO

### Modelos de Datos

#### Entidades afectadas
| Entidad | Almacen | Cambios | Descripcion |
|---------|---------|---------|-------------|
| `profile` | coleccion `profiles` | nueva | Perfil local de Usuario |
| `audio_asset` | coleccion `audio_assets` | nueva | Recurso de audio local o streaming |
| `playlist` | coleccion `playlists` | nueva | Lista ordenada de recursos |
| `ad_block` | coleccion `ad_blocks` | nueva | Tanda publicitaria configurable |
| `ad_rule` | coleccion `ad_rules` | nueva | Regla de disparo de tanda |
| `soundboard_button` | coleccion `soundboard_buttons` | nueva | Configuracion de botonera |
| `radio_program` | coleccion `radio_programs` | nueva | Programa y franja horaria |
| `output_integration` | coleccion `output_integrations` | nueva | Configuracion de salidas local/stream |
| `playout_event` | coleccion `playout_events` | nueva | Registro operacional y auditoria |

#### Campos del modelo
| Campo | Tipo | Obligatorio | Validacion | Descripcion |
|-------|------|-------------|------------|-------------|
| `uid` | string | si | unico | Identificador del recurso |
| `name` | string | si | max 120 chars | Nombre visible |
| `created_at` | datetime (UTC) | si | auto generado | Timestamp creacion |
| `updated_at` | datetime (UTC) | si | auto generado | Timestamp actualizacion |

Campos adicionales por entidad (resumen):
- `profile`: display_name, is_default, preferences
- `audio_asset`: source_type (local/stream), source_path_or_url, duration_ms, tags
- `playlist`: profile_uid, items_order, enabled
- `ad_block`: profile_uid, items_order, enabled
- `ad_rule`: trigger_type (time/song_count/manual), trigger_config, priority
- `soundboard_button`: profile_uid, slot_index (1-16), audio_asset_uid, mode
- `radio_program`: profile_uid, day_of_week, start_time, end_time, playlist_uid, priority
- `output_integration`: profile_uid, output_type (local/icecast/shoutcast), config, enabled
- `playout_event`: profile_uid, event_type, payload, status

#### Indices / Constraints
- Unico compuesto en `soundboard_buttons(profile_uid, slot_index)`.
- Indice en `radio_programs(profile_uid, day_of_week, start_time)` para scheduler.
- Indice en `ad_rules(profile_uid, trigger_type, priority)` para evaluacion rapida.
- Unico en `profiles(name)` por instalacion local.

### API Endpoints

#### Profiles
- `POST /api/v1/profiles`
- `GET /api/v1/profiles`
- `PUT /api/v1/profiles/{uid}`
- `DELETE /api/v1/profiles/{uid}`

#### Audio Assets y Playlists
- `POST /api/v1/audio-assets`
- `GET /api/v1/audio-assets`
- `POST /api/v1/playlists`
- `GET /api/v1/playlists`
- `PUT /api/v1/playlists/{uid}`
- `POST /api/v1/playlists/{uid}/play`

#### Tandas y Reglas
- `POST /api/v1/ad-blocks`
- `GET /api/v1/ad-blocks`
- `POST /api/v1/ad-rules`
- `GET /api/v1/ad-rules`
- `PUT /api/v1/ad-rules/{uid}`
- `POST /api/v1/ad-blocks/{uid}/trigger`

#### Botonera
- `GET /api/v1/soundboard`
- `PUT /api/v1/soundboard/{slot_index}`
- `POST /api/v1/soundboard/{slot_index}/trigger`

#### Programacion
- `POST /api/v1/radio-programs`
- `GET /api/v1/radio-programs`
- `PUT /api/v1/radio-programs/{uid}`
- `DELETE /api/v1/radio-programs/{uid}`

#### Integraciones y Emision
- `POST /api/v1/outputs`
- `GET /api/v1/outputs`
- `POST /api/v1/outputs/test`
- `POST /api/v1/playout/start`
- `POST /api/v1/playout/stop`
- `GET /api/v1/playout/status`

Codigos HTTP esperados:
- 200/201 en operaciones exitosas.
- 400 por validaciones.
- 404 por recurso inexistente.
- 409 por conflictos de unicidad o asignacion.
- 503 si motor de audio no disponible.

### Diseno Frontend

#### Componentes nuevos
| Componente | Archivo | Props principales | Descripcion |
|------------|---------|------------------|-------------|
| `NowPlayingPanel` | `frontend/src/components/NowPlayingPanel.jsx` | `track, source, status` | Estado de emision en vivo |
| `SoundboardGrid` | `frontend/src/components/SoundboardGrid.jsx` | `buttons, onTrigger, onAssign` | Grilla 4x4 de botonera |
| `AdRuleEditor` | `frontend/src/components/AdRuleEditor.jsx` | `rules, onSave` | Configuracion de reglas mixtas |
| `ProgramScheduler` | `frontend/src/components/ProgramScheduler.jsx` | `programs, onSave` | Grilla de programas |
| `OutputIntegrationPanel` | `frontend/src/components/OutputIntegrationPanel.jsx` | `outputs, onTest, onSave` | Salidas local/Icecast/Shoutcast |

#### Paginas nuevas
| Pagina | Archivo | Ruta | Protegida |
|--------|---------|------|-----------|
| `PlayoutPage` | `frontend/src/pages/PlayoutPage.jsx` | `/playout` | si |
| `PlaylistsPage` | `frontend/src/pages/PlaylistsPage.jsx` | `/playlists` | si |
| `AdBreaksPage` | `frontend/src/pages/AdBreaksPage.jsx` | `/ad-breaks` | si |
| `SoundboardPage` | `frontend/src/pages/SoundboardPage.jsx` | `/soundboard` | si |
| `ProgramsPage` | `frontend/src/pages/ProgramsPage.jsx` | `/programs` | si |
| `ProfilesPage` | `frontend/src/pages/ProfilesPage.jsx` | `/profiles` | si |
| `IntegrationsPage` | `frontend/src/pages/IntegrationsPage.jsx` | `/integrations` | si |

#### Hooks y State
| Hook | Archivo | Retorna | Descripcion |
|------|---------|---------|-------------|
| `usePlayout` | `frontend/src/hooks/usePlayout.js` | `{ status, start, stop, next }` | Control central de emision |
| `useSoundboard` | `frontend/src/hooks/useSoundboard.js` | `{ buttons, assign, trigger }` | Estado y acciones botonera |
| `useAdAutomation` | `frontend/src/hooks/useAdAutomation.js` | `{ rules, blocks, saveRule, trigger }` | Tandas y reglas |
| `usePrograms` | `frontend/src/hooks/usePrograms.js` | `{ programs, save, remove }` | Programacion por franja |
| `useProfiles` | `frontend/src/hooks/useProfiles.js` | `{ profiles, active, create, select }` | Perfiles locales |

#### Services (llamadas API)
| Funcion | Archivo | Endpoint |
|---------|---------|---------|
| `startPlayout()` | `frontend/src/services/playoutService.js` | `POST /api/v1/playout/start` |
| `triggerSoundboard(slot)` | `frontend/src/services/soundboardService.js` | `POST /api/v1/soundboard/{slot}/trigger` |
| `saveAdRule(data)` | `frontend/src/services/adRulesService.js` | `POST /api/v1/ad-rules` |
| `saveProgram(data)` | `frontend/src/services/programsService.js` | `POST /api/v1/radio-programs` |
| `createProfile(data)` | `frontend/src/services/profilesService.js` | `POST /api/v1/profiles` |
| `saveOutput(data)` | `frontend/src/services/outputsService.js` | `POST /api/v1/outputs` |

### Arquitectura y Dependencias
- Backend objetivo: FastAPI + Motor async + MongoDB.
- Frontend objetivo: React + Vite + CSS Modules.
- App desktop Windows: shell de escritorio local (por definir entre Electron/Tauri) sobre frontend+backend local.
- Motor de audio: modulo dedicado para mezcla, cue y continuidad.
- Integraciones externas: Icecast y Shoutcast.

### Notas de Implementacion
- La version MVP prioriza estabilidad de emision sobre efectos avanzados.
- El scheduler de tandas y programas debe definir orden de prioridad deterministico.
- Sin password en perfiles solo para modo local; considerar hardening en fases futuras.
- Se recomienda feature flags para transicion futura a modo web y multi OS.

---

## 3. LISTA DE TAREAS

> Checklist accionable para todos los agentes. Marcar cada item (`[x]`) al completarlo.
> El Orchestrator monitorea este checklist para determinar el progreso.

### Backend

#### Implementacion
- [ ] Crear modelos de dominio para profile, audio_asset, playlist, ad_block, ad_rule, soundboard_button, radio_program, output_integration, playout_event
- [ ] Implementar repositorios MongoDB async para cada agregado
- [ ] Implementar servicios de playout, reglas de tanda, scheduler de programas y salidas
- [ ] Implementar endpoints API v1 definidos en esta spec
- [ ] Implementar adaptadores de salida local/Icecast/Shoutcast
- [ ] Registrar routers en aplicacion principal

#### Tests Backend
- [ ] Test unitario de continuidad de playout ante fallo de fuente
- [ ] Test unitario de prioridad de reglas mixtas de tanda
- [ ] Test unitario de validacion de slot 1-16 en botonera
- [ ] Test unitario de resolucion de solapamiento de programas
- [ ] Test de integracion de inicio de emision multi salida
- [ ] Test de integracion de reconexion de streaming

### Frontend

#### Implementacion
- [ ] Crear paginas protegidas de playout, playlists, tandas, botonera, programas, perfiles e integraciones
- [ ] Implementar SoundboardGrid 4x4 con configuracion por boton
- [ ] Implementar editor de reglas mixtas para tandas
- [ ] Implementar scheduler visual de programas por franja
- [ ] Implementar flujo de alta y seleccion de perfiles locales sin password
- [ ] Implementar panel de estado de salidas local/Icecast/Shoutcast
- [ ] Registrar rutas en App principal

#### Tests Frontend
- [ ] SoundboardGrid dispara recurso correcto por slot
- [ ] SoundboardGrid valida slot sin asignacion
- [ ] AdRuleEditor bloquea configuraciones incompletas
- [ ] ProgramsPage renderiza y guarda grilla por franja
- [ ] ProfilesPage crea Perfil local y evita duplicados
- [ ] IntegrationsPage testea estado de conexion por salida

### QA
- [ ] Ejecutar skill /gherkin-case-generator para HU-01 a HU-06
- [ ] Ejecutar skill /risk-identifier para clasificacion ASD del MVP
- [ ] Validar cobertura de criterios happy path, error path y edge case
- [ ] Validar estabilidad de emision local + streaming simultaneo
- [ ] Actualizar estado spec a APPROVED, IN_PROGRESS e IMPLEMENTED segun avance
