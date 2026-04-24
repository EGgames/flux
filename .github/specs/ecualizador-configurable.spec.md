---
id: SPEC-003
status: DRAFT
feature: ecualizador-configurable
created: 2026-04-24
updated: 2026-04-24
author: spec-generator
version: "1.0"
related-specs: [SPEC-001]
---

# Spec: Ecualizador 100% Configurable con Templates

> **Estado:** `DRAFT` → aprobar con `status: APPROVED` antes de iniciar implementación.
> **Ciclo de vida:** DRAFT → APPROVED → IN_PROGRESS → IMPLEMENTED → DEPRECATED

---

## 1. REQUERIMIENTOS

### Descripción
Reemplazar el ecualizador fijo de 3 bandas (low/mid/high) por uno **paramétrico configurable** con N bandas (por defecto 10 bandas ISO estándar), donde el Usuario puede agregar / eliminar bandas, ajustar frecuencia, ganancia (dB) y Q de cada una, y aplicar **templates** predefinidos (Flat, Rock, Jazz, Pop, Clásico, Bass Boost, Vocal) o guardar los suyos. La configuración persiste por Perfil en una tabla nueva `EqualizerPreset`.

### Requerimiento de Negocio
> "Necesito test para ecualizador, ademas necesito un ecualizador 100% configurable, donde pueda agregar mas canales de filtracion y templates para rock, jazz por ejemplo."

### Historias de Usuario

#### HU-01: Ecualizador con bandas dinámicas

```
Como:        Usuario
Quiero:      ajustar el sonido con un ecualizador de varias bandas (10 por defecto)
Para:        adaptar la respuesta de frecuencia al género o ambiente de la transmisión

Prioridad:   Alta
Estimación:  L
Dependencias: Ninguna
Capa:        Ambas (DB + Backend IPC + Frontend)
```

#### Criterios de Aceptación — HU-01

**Happy Path**
```gherkin
CRITERIO-1.1: Ajustar ganancia de una banda
  Dado que:  el Usuario tiene el Ecualizador habilitado con la configuración por defecto de 10 bandas
  Cuando:    mueve el slider de la banda de 1 kHz a +6 dB
  Entonces:  el filtro Web Audio API correspondiente actualiza su gain a 6 dB con rampa suave (50 ms)
             y el cambio queda reflejado en la UI
```

```gherkin
CRITERIO-1.2: Aplicar template Rock
  Dado que:  el Usuario está en la pestaña Ecualizador
  Cuando:    selecciona el template "Rock" del dropdown de presets
  Entonces:  todas las bandas adoptan los valores del preset Rock
             y el preset queda marcado como activo
```

```gherkin
CRITERIO-1.3: Guardar preset custom
  Dado que:  el Usuario configuró las 10 bandas con valores propios
  Cuando:    presiona "Guardar como..." e ingresa "Mi Mix"
  Entonces:  se persiste un nuevo EqualizerPreset con name="Mi Mix" y profileId del Perfil activo
             y aparece en la lista de presets disponibles
```

**Error Path**
```gherkin
CRITERIO-1.4: Nombre de preset duplicado
  Dado que:  ya existe un preset "Mi Mix" para el Perfil
  Cuando:    el Usuario intenta guardar otro con el mismo nombre
  Entonces:  el sistema rechaza con mensaje "Ya existe un preset con ese nombre"
             y no se crea el registro
```

```gherkin
CRITERIO-1.5: Eliminar preset built-in
  Dado que:  el preset "Rock" es built-in (isBuiltIn=true)
  Cuando:    el Usuario intenta eliminarlo
  Entonces:  el botón Eliminar no aparece para ese preset
             y el backend rechaza la operación con "No se pueden eliminar presets predefinidos"
```

**Edge Case**
```gherkin
CRITERIO-1.6: Agregar banda nueva
  Dado que:  el Usuario tiene 10 bandas configuradas
  Cuando:    presiona "+ Agregar banda" e ingresa frecuencia 80 Hz / Q 1.0 / tipo peaking
  Entonces:  la cadena Web Audio API se reconstruye en orden ascendente por frecuencia
             y el ecualizador sigue funcionando sin glitch audible
```

```gherkin
CRITERIO-1.7: Eliminar banda
  Dado que:  el Usuario tiene 11 bandas configuradas
  Cuando:    elimina la banda de 80 Hz
  Entonces:  la cadena se reconecta sin esa banda
             y la cantidad mínima permitida es 1 banda (no se permite quedar con 0)
```

```gherkin
CRITERIO-1.8: Reset a Flat
  Dado que:  el Usuario tiene ganancias arbitrarias en todas las bandas
  Cuando:    aplica el template "Flat"
  Entonces:  todas las ganancias quedan en 0 dB conservando frecuencias y Q actuales
```

### Reglas de Negocio
1. **Bandas mínimas/máximas**: 1 ≤ N ≤ 31 bandas por configuración.
2. **Rango de ganancia**: -12 dB ≤ gain ≤ +12 dB (paso 0.5).
3. **Rango de frecuencia**: 20 Hz ≤ frequency ≤ 20000 Hz.
4. **Rango Q**: 0.1 ≤ Q ≤ 10 (solo aplica a tipo `peaking`).
5. **Tipos de filtro permitidos**: `lowshelf` | `peaking` | `highshelf` (por banda).
6. **Presets built-in**: Flat, Rock, Jazz, Pop, Clásico, Bass Boost, Vocal — son `isBuiltIn=true`, no se pueden editar ni eliminar; siempre disponibles para todos los Perfiles (profileId NULL).
7. **Presets custom**: pertenecen a un Perfil (`profileId` no nulo); el nombre es único por Perfil.
8. **Configuración activa**: cada Perfil persiste su `activePresetId` (puede ser NULL = config ad-hoc no guardada) en `profile.preferences`.
9. **Persistencia de bandas ad-hoc**: la configuración no guardada del Perfil se serializa también en `profile.preferences.equalizer` para sobrevivir al cierre de la app.
10. **Estado enabled**: la propiedad `enabled` del EQ es independiente del preset y vive en `profile.preferences.equalizer.enabled`.

---

## 2. DISEÑO

### Modelos de Datos

#### Entidades afectadas
| Entidad | Almacén | Cambios | Descripción |
|---------|---------|---------|-------------|
| `EqualizerPreset` | tabla SQLite `equalizer_preset` | **nueva** | Preset reutilizable con N bandas (built-in o custom por Perfil) |
| `Profile.preferences` | columna existente JSON | **modificada** | agrega `equalizer: { enabled, activePresetId, bands }` |

#### Campos del modelo `EqualizerPreset`

| Campo | Tipo | Obligatorio | Validación | Descripción |
|-------|------|-------------|------------|-------------|
| `id` | string (cuid) | sí | auto-generado | Identificador único |
| `name` | string | sí | 1–60 chars; único por `(profileId, name)` | Nombre del preset (ej. "Rock") |
| `profileId` | string \| null | no | FK → `Profile.id`; NULL para built-in | Perfil dueño; NULL = built-in global |
| `isBuiltIn` | boolean | sí | default false | Si es predefinido (no editable/eliminable) |
| `bands` | string (JSON) | sí | array serializado, ver schema abajo | Definición de las N bandas |
| `created_at` | datetime UTC | sí | auto | |
| `updated_at` | datetime UTC | sí | auto | |

**Schema del JSON `bands`** (validado en backend):
```json
[
  { "frequency": 31,    "gain": 0, "q": 1.0, "type": "lowshelf" },
  { "frequency": 62,    "gain": 0, "q": 1.0, "type": "peaking"  },
  { "frequency": 125,   "gain": 0, "q": 1.0, "type": "peaking"  },
  { "frequency": 250,   "gain": 0, "q": 1.0, "type": "peaking"  },
  { "frequency": 500,   "gain": 0, "q": 1.0, "type": "peaking"  },
  { "frequency": 1000,  "gain": 0, "q": 1.0, "type": "peaking"  },
  { "frequency": 2000,  "gain": 0, "q": 1.0, "type": "peaking"  },
  { "frequency": 4000,  "gain": 0, "q": 1.0, "type": "peaking"  },
  { "frequency": 8000,  "gain": 0, "q": 1.0, "type": "peaking"  },
  { "frequency": 16000, "gain": 0, "q": 1.0, "type": "highshelf"}
]
```

#### Schema Prisma (delta)

```prisma
model EqualizerPreset {
  id        String   @id @default(cuid())
  name      String
  profileId String?
  isBuiltIn Boolean  @default(false)
  bands     String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")

  profile   Profile? @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([profileId, name])
  @@index([profileId])
  @@map("equalizer_preset")
}
```

Y en `Profile`:
```prisma
model Profile {
  // ...existing fields
  equalizerPresets EqualizerPreset[]
}
```

#### Built-in seed (insertados en `db.ts` al iniciar si no existen)

| Nombre | Definición resumida (gain por banda en dB para 31/62/125/250/500/1k/2k/4k/8k/16k Hz) |
|--------|--------------------------------------------------------------------------------------|
| Flat        | 0,0,0,0,0,0,0,0,0,0 |
| Rock        | +5,+4,+3,+1,-1,-1,+2,+4,+5,+5 |
| Jazz        | +4,+3,+1,+2,-2,-2,0,+1,+3,+4 |
| Pop         | -1,-1,0,+2,+4,+4,+2,0,-1,-1 |
| Clásico     | +5,+4,+3,+2,-1,-1,0,+2,+3,+4 |
| Bass Boost  | +6,+5,+4,+1,0,0,0,0,0,0 |
| Vocal       | -2,-2,-1,+1,+3,+4,+4,+2,0,-1 |

#### Constraints / Índices
- `@@unique([profileId, name])` — un Perfil no puede tener dos presets con el mismo nombre. Built-in (profileId=NULL) son únicos globalmente por nombre.
- `@@index([profileId])` — para listar presets de un Perfil rápido.
- `onDelete: Cascade` — al borrar un Perfil se borran sus presets custom.

### IPC Endpoints (Electron — `src/main/ipc/equalizer.ipc.ts`)

> No es REST. Son canales `ipcMain.handle`. Convención: `equalizer:<action>`.

#### `equalizer:list-presets` `(profileId: string) → EqualizerPreset[]`
- Devuelve todos los presets visibles para el Perfil: built-in (profileId NULL) + propios.
- Orden: built-in primero (por nombre), luego custom (por nombre).

#### `equalizer:get-preset` `(presetId: string) → EqualizerPreset | null`
- Devuelve un preset individual con sus bandas parseadas.

#### `equalizer:create-preset` `(data: { profileId, name, bands }) → EqualizerPreset`
- Validaciones: name no vacío (≤ 60 chars); bands válido (1–31 elementos, rangos correctos).
- Error 409-equivalent: `Error('Ya existe un preset con ese nombre')` si viola unique constraint.
- `isBuiltIn` siempre false para creaciones desde IPC.

#### `equalizer:update-preset` `(presetId: string, data: { name?, bands? }) → EqualizerPreset`
- Rechaza si `isBuiltIn=true`: `Error('No se pueden editar presets predefinidos')`.
- Mismas validaciones que create.

#### `equalizer:delete-preset` `(presetId: string) → { success: true }`
- Rechaza si `isBuiltIn=true`: `Error('No se pueden eliminar presets predefinidos')`.

### Diseño Frontend

#### Componentes nuevos
| Componente | Archivo | Props principales | Descripción |
|------------|---------|------------------|-------------|
| `EqualizerPanel` | `components/EqualizerPanel/EqualizerPanel.tsx` | `bands, enabled, onChangeBand, onToggleEnabled, onAddBand, onRemoveBand, onApplyPreset, onSavePreset, presets, activePresetId` | Panel completo del EQ con sliders verticales, presets dropdown, agregar/eliminar banda |
| `EqualizerBandSlider` | `components/EqualizerPanel/EqualizerBandSlider.tsx` | `band, onChange, onRemove` | Slider vertical para una banda con label de Hz y dB |
| `SavePresetModal` | `components/EqualizerPanel/SavePresetModal.tsx` | `isOpen, onSubmit, onClose, error` | Modal para nombrar un preset nuevo |

El `EqualizerPanel` reemplaza el bloque `equalizer` actual dentro de `PlayoutPage.tsx` (líneas 338–393).

#### Páginas afectadas
| Página | Cambio |
|--------|--------|
| `PlayoutPage` | reemplaza el panel de EQ inline por `<EqualizerPanel ... />` |

#### Hooks
| Hook | Archivo | Retorna | Descripción |
|------|---------|---------|-------------|
| `useEqualizer` | `hooks/useEqualizer.ts` | `{ bands, enabled, presets, activePresetId, setBand, addBand, removeBand, toggleEnabled, applyPreset, savePreset, deletePreset, error }` | Estado + IPC. Lee `profile.preferences.equalizer` al montar; persiste cambios con debounce (500 ms). |

`usePlayout` deja de exponer `equalizer/setEqualizerBand/toggleEqualizer/resetEqualizer` y en su lugar expone:
```ts
applyEqualizerBands(bands: EqualizerBand[], enabled: boolean): void
```
Esta función reconstruye la cadena Web Audio API según las bandas recibidas.

#### Services
| Función | Archivo | Canal IPC |
|---------|---------|-----------|
| `listPresets(profileId)` | `services/equalizerService.ts` | `equalizer:list-presets` |
| `getPreset(id)` | `services/equalizerService.ts` | `equalizer:get-preset` |
| `createPreset(data)` | `services/equalizerService.ts` | `equalizer:create-preset` |
| `updatePreset(id, data)` | `services/equalizerService.ts` | `equalizer:update-preset` |
| `deletePreset(id)` | `services/equalizerService.ts` | `equalizer:delete-preset` |

Y en `preload/index.ts` se expone `window.electronAPI.equalizer = { listPresets, getPreset, createPreset, updatePreset, deletePreset }`.

#### Tipos TypeScript (`renderer/src/types/ipc.types.ts`)
```ts
export type EqualizerBandType = 'lowshelf' | 'peaking' | 'highshelf'

export interface EqualizerBand {
  frequency: number  // Hz
  gain: number       // dB
  q: number
  type: EqualizerBandType
}

export interface EqualizerPreset {
  id: string
  name: string
  profileId: string | null
  isBuiltIn: boolean
  bands: EqualizerBand[]
  createdAt: string
  updatedAt: string
}
```

### Arquitectura y Dependencias
- **Sin paquetes nuevos**: se sigue usando Web Audio API nativa con `BiquadFilterNode`.
- **Migración Prisma**: se requiere generar migration `add_equalizer_preset`.
- **Seed de built-ins**: en `db.ts`, función `seedBuiltInEqualizerPresets()` invocada tras `prisma.$connect()`. Idempotente (`upsert` por `(profileId=null, name)`).
- **Cadena Web Audio API**: pasa de cadena fija de 3 nodos a array dinámico. La función `rebuildEqChain(bands)` desconecta los nodos previos y crea los nuevos en orden ascendente por frecuencia, conectando `source → b0 → b1 → ... → bN → destination`. Se llama cuando cambia la cantidad o el tipo/frecuencia de bandas; cuando solo cambia `gain` se hace `setTargetAtTime` con rampa de 50 ms (sin reconstruir).

### Notas de Implementación
- **Migración de datos**: los Perfiles existentes leen `profile.preferences.equalizer` con fallback a una instancia derivada del preset Flat (10 bandas en 0 dB). La estructura previa `{ enabled, low, mid, high }` se descarta sin migrar valores numéricos (se considera reset a Flat).
- **Performance**: limitar a 31 bandas máx (suficiente para 1/3 de octava). Cada cambio en `gain` solo rampa el filtro existente — no se reconstruye la cadena.
- **Glitch al rebuild**: cuando cambia la cantidad de bandas, hacer fadeOut (gain master = 0) durante 30 ms, reconstruir, fadeIn 30 ms. Implementar en `rebuildEqChain`.
- **Acceso a `window.electronAPI.equalizer`**: respetar el patrón existente de `playoutService` etc.

---

## 3. LISTA DE TAREAS

### Database
- [ ] Modificar `prisma/schema.prisma` con modelo `EqualizerPreset` y relación inversa en `Profile`
- [ ] Generar migration: `npx prisma migrate dev --name add_equalizer_preset`
- [ ] Implementar `seedBuiltInEqualizerPresets()` en `src/main/db.ts` con upserts idempotentes para Flat/Rock/Jazz/Pop/Clásico/Bass Boost/Vocal
- [ ] Llamar al seed después de `prisma.$connect()` en `db.ts`

### Backend (Main Process)

#### Implementación
- [ ] Crear `src/main/ipc/equalizer.ipc.ts` con `registerEqualizerIpc(db)`
- [ ] Implementar handlers `list-presets`, `get-preset`, `create-preset`, `update-preset`, `delete-preset`
- [ ] Función helper `validateBands(bands: unknown): EqualizerBand[]` — valida 1–31 elementos, rangos de freq/gain/Q, tipo permitido
- [ ] Registrar `registerEqualizerIpc` en `src/main/index.ts`
- [ ] Exponer `window.electronAPI.equalizer` en `src/preload/index.ts`

#### Tests Backend
- [ ] `src/main/__tests__/ipc/equalizer.ipc.test.ts`
- [ ] `equalizer:list-presets returns built-in + profile presets ordered`
- [ ] `equalizer:create-preset validates band count (1..31)`
- [ ] `equalizer:create-preset validates frequency range (20..20000)`
- [ ] `equalizer:create-preset validates gain range (-12..+12)`
- [ ] `equalizer:create-preset rejects duplicate name in same profile`
- [ ] `equalizer:update-preset rejects when isBuiltIn=true`
- [ ] `equalizer:delete-preset rejects when isBuiltIn=true`
- [ ] `equalizer:delete-preset removes custom preset`
- [ ] `seedBuiltInEqualizerPresets is idempotent (upsert per name)`

### Frontend

#### Implementación
- [ ] Tipos en `src/renderer/src/types/ipc.types.ts`: `EqualizerBand`, `EqualizerBandType`, `EqualizerPreset`, extender `ElectronAPI`
- [ ] `src/renderer/src/services/equalizerService.ts` — wrappers IPC
- [ ] `src/renderer/src/hooks/useEqualizer.ts` — estado + persistencia debounced + IPC
- [ ] Refactor `src/renderer/src/hooks/usePlayout.ts`: reemplazar cadena fija por `applyEqualizerBands(bands, enabled)` con `rebuildEqChain` (fadeOut/connect/fadeIn 30 ms)
- [ ] Componente `src/renderer/src/components/EqualizerPanel/EqualizerBandSlider.tsx`
- [ ] Componente `src/renderer/src/components/EqualizerPanel/SavePresetModal.tsx`
- [ ] Componente `src/renderer/src/components/EqualizerPanel/EqualizerPanel.tsx`
- [ ] Estilos en `EqualizerPanel.module.css`
- [ ] Integrar `<EqualizerPanel />` en `PlayoutPage.tsx` reemplazando el panel inline; eliminar props `equalizer/setEqualizerBand/toggleEqualizer/resetEqualizer` de la prop `playout`

#### Tests Frontend
- [ ] `EqualizerBandSlider renders frequency label and dB value`
- [ ] `EqualizerBandSlider calls onChange with new gain`
- [ ] `EqualizerBandSlider calls onRemove when ✕ clicked`
- [ ] `SavePresetModal submits trimmed name`
- [ ] `SavePresetModal shows error message`
- [ ] `EqualizerPanel renders one slider per band`
- [ ] `EqualizerPanel calls onApplyPreset when preset selected`
- [ ] `EqualizerPanel calls onAddBand when "+ Agregar banda" clicked`
- [ ] `EqualizerPanel disables Eliminar/Editar for built-in presets`
- [ ] `useEqualizer loads presets and active config on mount`
- [ ] `useEqualizer.applyPreset replaces bands with preset values`
- [ ] `useEqualizer.savePreset calls IPC and refreshes presets list`
- [ ] `useEqualizer persists bands to profile.preferences (debounced)`
- [ ] `usePlayout.applyEqualizerBands rebuilds Web Audio chain` (mock `AudioContext` + `BiquadFilterNode`)
- [ ] Actualizar `PlayoutPage.test.tsx` con la nueva forma de la prop `playout`

### QA
- [ ] Ejecutar skill `/gherkin-case-generator` → CRITERIO-1.1 a 1.8
- [ ] Ejecutar skill `/risk-identifier` → riesgo audio glitch durante rebuild (Medio), riesgo de pérdida de datos al migrar preferences (Bajo)
- [ ] Validar que las 7 reglas built-in se siembran en una DB nueva
- [ ] Validar manualmente templates Rock y Jazz con audio real
- [ ] Actualizar estado spec: `status: IMPLEMENTED`
