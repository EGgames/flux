---
id: SPEC-004
status: IMPLEMENTED
feature: efectos-de-audio
created: 2026-04-24
updated: 2026-04-24
author: spec-generator
version: "1.0"
related-specs: [SPEC-002, SPEC-003]
---

# Spec: Efectos de Audio (Crossfade + Per-Track Fades + Mixer DJ)

> **Estado:** `IMPLEMENTED` — entregado en feature-fix. Crossfade global (equal-power/lineal), fades por tema (RN-03) y Mixer DJ con CUE a Monitor. Pruebas: 307/307.
> **Ciclo de vida:** DRAFT → APPROVED → IN_PROGRESS → IMPLEMENTED → DEPRECATED

---

## 1. REQUERIMIENTOS

### Descripción

Crear un módulo dedicado de **Efectos de Audio** con tres capacidades en v1:

1. **Crossfade automático global** entre temas consecutivos del playout (master), con curva y duración configurables por Perfil.
2. **Fade in / Fade out por tema** (per AudioAsset), que viaja con el archivo en TODAS las playlists donde aparezca.
3. **Mixer DJ avanzado** dentro de Playout (panel arrastrable opcional): 2 decks (A/B) + crossfader manual + cue/preview por canal.

La sección debe ser accesible:
- Como **página propia** en el sidebar (item `Efectos`).
- Como **panel arrastrable** dentro del workspace de Playout (acceso rápido al crossfade y al mixer DJ).

### Requerimiento de Negocio
> "Necesito una sección exclusivamente de efectos de audio (crossfades, compresores, reverbs, etc.) que pueda estar tanto en el sidebar como dentro de Playout. Además una pestaña para configurar la salida de cada tema (fade in / fade out) y una opción avanzada que habilite dentro del Playout una bandeja de mezcla tipo Virtual DJ."

### Alcance v1 (acordado con el usuario)

| Capacidad | v1 | Diferido |
|---|---|---|
| Crossfade automático global | ✅ | — |
| Fade in / Fade out per track | ✅ | — |
| Mixer DJ (2 decks + crossfader + cue) | ✅ | — |
| Compresor master | ❌ | v2 |
| Limiter master | ❌ | v2 |
| Reverb / Delay / Widener / De-esser | ❌ | v2+ |
| Cue points por tema (intro/outro markers) | ❌ | v2 |

### Historias de Usuario

#### HU-01: Crossfade automático entre temas

```
Como:        Operador de radio
Quiero:      que los temas se solapen automáticamente con un crossfade configurable
Para:        eliminar silencios y dar continuidad al aire sin intervención manual

Prioridad:   Alta
Estimación:  M
Dependencias: SPEC-002 (playout)
Capa:        DB + Backend IPC + Frontend (hook usePlayout)
```

**Happy Path**
```gherkin
CRITERIO-1.1: Configurar crossfade global
  Dado que:  el Usuario abre la página Efectos y ve la sección "Crossfade global"
  Cuando:    define duración=4000ms, curva="equal-power" y habilita el toggle
  Y:         presiona Guardar
  Entonces:  la configuración persiste como AudioEffectsConfig del Perfil activo
             y el panel del workspace de Playout refleja "Crossfade: 4s · equal-power · ON"

CRITERIO-1.2: Aplicar crossfade en transición real
  Dado que:  el playout está reproduciendo el track A con crossfade=4s habilitado
  Cuando:    quedan 4 segundos para el final del track A y next() avanza al track B
  Entonces:  el howl A inicia fade(volumen→0, 4000ms)
             y el howl B se crea en paralelo con fade(0→volumen, 4000ms)
             y al terminar la rampa el howl A se descarga sin click
```

**Error Path**
```gherkin
CRITERIO-1.3: Duración inválida
  Dado que:  el Usuario ingresa 0ms o un valor > 15000ms en el slider
  Cuando:    el componente normaliza la entrada
  Entonces:  el valor se clampa al rango [500, 15000]
             y se muestra hint "Rango permitido: 0.5s a 15s"
```

#### HU-02: Fade in / Fade out por tema

```
Como:        Operador
Quiero:      definir fade in y fade out propios para temas que tienen entradas/salidas crudas
Para:        suavizar canciones específicas sin afectar al resto de la biblioteca

Prioridad:   Media
Estimación:  M
Dependencias: HU-01
Capa:        DB (AudioAsset.fadeInMs/fadeOutMs) + Backend IPC + Frontend (página Efectos / inline en biblioteca)
```

**Happy Path**
```gherkin
CRITERIO-2.1: Editar fades de un AudioAsset
  Dado que:  el Usuario está en la pestaña "Por tema" de la página Efectos
  Cuando:    selecciona un AudioAsset, ingresa fadeInMs=2000 y fadeOutMs=3000 y presiona Guardar
  Entonces:  el AudioAsset se actualiza vía IPC audioAssets.update
             y la próxima reproducción del tema arranca con fade-in de 2s y termina con fade-out de 3s

CRITERIO-2.2: Override del crossfade global
  Dado que:  el crossfade global es 4s y el track B tiene fadeInMs=1000
  Cuando:    se ejecuta la transición A→B
  Entonces:  el fade-out de A usa 4s (global)
             y el fade-in de B usa 1000ms (override del asset)

CRITERIO-2.3: Defaults seguros
  Dado que:  un AudioAsset existente no tiene fadeInMs/fadeOutMs (legacy)
  Cuando:    se reproduce
  Entonces:  fadeInMs = null → usa 0 (corte limpio) si no hay crossfade global, o el valor global si sí
             fadeOutMs = null → idem
```

#### HU-03: Mixer DJ con 2 decks y crossfader

```
Como:        Operador con experiencia DJ
Quiero:      mezclar manualmente 2 temas en vivo con crossfader y cue
Para:        hacer transiciones creativas o resolver imprevistos al aire

Prioridad:   Media-Alta
Estimación:  L
Dependencias: HU-01 (reusa pipeline de fade), Outputs Monitor (SPEC-002 para cue)
Capa:        Frontend (hook useMixer + componente MixerPanel) — sin DB en v1
```

**Happy Path**
```gherkin
CRITERIO-3.1: Cargar tema en deck A
  Dado que:  el Usuario abrió el panel "Mixer DJ" en Playout
  Cuando:    arrastra un AudioAsset desde la biblioteca al deck A
  Entonces:  el deck A muestra el nombre, duración y un botón Play/Pause independiente

CRITERIO-3.2: Crossfader manual
  Dado que:  el deck A está sonando al 100% y el deck B está cargado pausado
  Cuando:    el Usuario mueve el crossfader del extremo izquierdo (A) al centro
  Entonces:  el volumen del deck A baja a 50% (con curva equal-power)
             y el volumen del deck B sube a 50%
             ambos enrutados a la salida principal

CRITERIO-3.3: Cue al monitor
  Dado que:  hay configurado un device de Monitor distinto al device principal
  Cuando:    el Usuario presiona el botón "CUE" del deck B
  Entonces:  el deck B se reproduce únicamente en el device del Monitor (no se escucha al aire)
             y el botón CUE queda activo (toggleable)

CRITERIO-3.4: Coexistencia con playout automático
  Dado que:  el playout principal está reproduciendo desde una playlist
  Cuando:    el Usuario activa el Mixer DJ y mueve el crossfader hacia A
  Entonces:  el playout principal sigue su curso (no se interrumpe la cola)
             y los decks del mixer suenan adicionalmente como capas independientes
```

**Error Path**
```gherkin
CRITERIO-3.5: CUE sin Monitor configurado
  Dado que:  el Usuario no tiene device de Monitor activo en Integraciones
  Cuando:    presiona CUE en cualquier deck
  Entonces:  el botón muestra estado "deshabilitado"
             y aparece tooltip "Configurá un Monitor en Integraciones para usar CUE"
```

### Reglas de Negocio

- **RN-01**: La configuración de crossfade global es **por Perfil** (cada perfil tiene su propio AudioEffectsConfig).
- **RN-02**: Los fades por tema son propiedad del **AudioAsset** (viajan con el archivo en todas las playlists).
- **RN-03**: Si un AudioAsset tiene `fadeOutMs` definido y existe crossfade global → se usa el **mayor** de los dos para evitar cortes abruptos.
- **RN-04**: El Mixer DJ es independiente del playout automático: ambos pueden sonar a la vez (cada uno con su propio Howl).
- **RN-05**: El cue del Mixer DJ usa el mismo `monitorDeviceId` configurado en Integraciones (sin duplicar configuración).
- **RN-06**: Si no hay Profile activo, la página Efectos muestra estado vacío con CTA "Seleccionar Perfil".

---

## 2. DISEÑO

### 2.1 Modelo de datos (Prisma)

**Nueva tabla `AudioEffectsConfig`** (1 registro por Perfil):

```prisma
model AudioEffectsConfig {
  id                String   @id @default(cuid())
  profileId         String   @unique
  crossfadeEnabled  Boolean  @default(false)
  crossfadeMs       Int      @default(2000)        // 500..15000
  crossfadeCurve    String   @default("equal-power") // 'equal-power' | 'linear'
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  profile           Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
}
```

**Modificación de `AudioAsset`** — campos opcionales:

```prisma
model AudioAsset {
  // ... campos existentes
  fadeInMs   Int?
  fadeOutMs  Int?
}
```

> Migration name sugerido: `add_audio_effects_config_and_asset_fades`.

### 2.2 IPC API

| Canal IPC | Dirección | Payload | Respuesta |
|---|---|---|---|
| `audio-effects:get` | renderer→main | `(profileId: string)` | `AudioEffectsConfig` |
| `audio-effects:update` | renderer→main | `(profileId, partial)` | `AudioEffectsConfig` |
| `audio-assets:update-fades` | renderer→main | `(assetId, fadeInMs?, fadeOutMs?)` | `AudioAsset` |

> El crossfade NO requiere IPC events nuevos: el hook `usePlayout` lee la config al iniciar y al recibir `flux:audio-effects-changed` (CustomEvent local del renderer, igual que `flux:outputs-changed`).

### 2.3 Frontend — estructura de archivos nuevos

```
src/renderer/src/
├─ pages/
│  └─ AudioEffectsPage/
│     ├─ AudioEffectsPage.tsx           # Página /efectos: tabs Global | Por tema | Mixer
│     ├─ AudioEffectsPage.module.css
│     ├─ tabs/
│     │  ├─ GlobalEffectsTab.tsx        # Crossfade (slider duración + dropdown curva + toggle)
│     │  ├─ PerTrackTab.tsx             # Tabla AudioAssets con columnas FadeIn/FadeOut editables
│     │  └─ MixerTab.tsx                # Vista grande del mixer DJ (idéntica al panel)
├─ components/
│  └─ MixerDJ/
│     ├─ MixerDJ.tsx                    # Componente reusable (panel + página)
│     ├─ MixerDJ.module.css
│     └─ Deck.tsx                       # Subcomponente: 1 deck con play/pause/cue/volumen
├─ hooks/
│  ├─ useAudioEffects.ts                # CRUD de AudioEffectsConfig + emite flux:audio-effects-changed
│  └─ useMixer.ts                       # Estado de los 2 decks + crossfader + cue (Howls aislados)
└─ services/
   └─ audioEffectsService.ts
```

**Cambios en archivos existentes:**

- `src/renderer/src/pages/PlayoutPage/PlayoutPage.tsx` → registrar 2 panels nuevos opcionales:
  - `crossfadeStatus` (read-only, muestra estado actual del crossfade global con shortcut a /efectos).
  - `mixerDJ` (interactivo, contiene `<MixerDJ />`).
- `src/renderer/src/hooks/usePlayout.ts` → consumir `crossfadeMs` al transicionar tracks (en `next()`, `onend` y `changePlaylist`); aplicar `fadeInMs/fadeOutMs` del asset si existen.
- `src/renderer/src/components/Sidebar/Sidebar.tsx` → agregar item "Efectos" con icono.
- `src/renderer/src/App.tsx` (o router) → ruta `/efectos` → `<AudioEffectsPage />`.
- `prisma/schema.prisma` → agregar tabla + campos.
- `src/preload/index.ts` → exponer canales nuevos.
- `src/renderer/src/types/ipc.types.ts` → tipos.
- `src/main/ipc/audioEffects.ipc.ts` → handler nuevo.
- `src/main/ipc/audioAssets.ipc.ts` → método `updateFades`.
- `src/main/index.ts` → registrar IPC nuevo.

### 2.4 Algoritmo de crossfade

Pseudocódigo en `usePlayout.next()`:

```ts
const cfg = audioEffectsConfigRef.current
const globalMs = cfg.crossfadeEnabled ? cfg.crossfadeMs : 0
const fadeOutMs = Math.max(globalMs, currentTrack.fadeOutMs ?? 0)
const fadeInMs  = Math.max(globalMs, nextTrack.fadeInMs ?? 0)

if (fadeOutMs > 0 && howlRef.current) {
  const out = howlRef.current
  out.fade(out.volume(), 0, fadeOutMs)
  setTimeout(() => { out.stop(); out.unload() }, fadeOutMs + 50)
}
// no nullify howlRef hasta que arranque el siguiente — playTrack() se encarga
playTrack(nextTrack, fadeInMs)
```

> Curva `equal-power`: en vez de Howler `fade()` (lineal), usar 2 GainNodes WebAudio con `setValueCurveAtTime` aplicando `cos(t·π/2)` para out y `sin(t·π/2)` para in. **Si la complejidad excede el alcance v1**, aceptar fade lineal de Howler y dejar comentario `// TODO: equal-power curve`.

### 2.5 Mixer DJ — diseño del hook

```ts
useMixer() => {
  decks: { A: DeckState, B: DeckState }   // { asset, howl, playing, volume, cued }
  crossfaderPos: number                    // -1 (A) .. +1 (B)
  loadAsset(deck: 'A'|'B', asset: AudioAsset): void
  playPause(deck): void
  setCrossfader(pos: number): void         // recalcula volumen efectivo de cada howl
  toggleCue(deck): void                    // setSinkId al monitorDeviceId; al desactivar vuelve al principal
  unloadAll(): void
}
```

- Cada deck = un `Howl` independiente con `html5: true` enrutado vía `setSinkId`.
- Volumen efectivo = `deckVolume × crossfaderGain(pos, deck)` con curva equal-power.
- Cue: si `cued===true` → `setSinkId(monitorDeviceId)` y se excluye del crossfader (suena solo en monitor a volumen del deck).

### 2.6 UI — bocetos (texto)

**Página Efectos — Tab Global:**
```
┌─ Crossfade global ──────────────────────────┐
│ [✓] Habilitar crossfade automático          │
│ Duración:  ●─────●─────────  4000 ms        │
│ Curva:     [Equal-Power ▼]                  │
│                                             │
│ [Guardar]                                   │
└─────────────────────────────────────────────┘
```

**Página Efectos — Tab Por tema:**
```
┌─ Fades por tema ────────────────────────────┐
│ Buscar: [_______________]                   │
│ ┌───────────────────┬─────────┬─────────┐  │
│ │ Tema              │ Fade In │ Fade Out│  │
│ ├───────────────────┼─────────┼─────────┤  │
│ │ Track 1.mp3       │ [2000 ] │ [3000 ] │  │
│ │ Jingle FM.wav     │ [   0 ] │ [ 500 ] │  │
│ └───────────────────┴─────────┴─────────┘  │
└─────────────────────────────────────────────┘
```

**Mixer DJ:**
```
┌─ DECK A ──────┐  ┌─ DECK B ──────┐
│ Track 1       │  │ Track 2       │
│ ▶ ⏸ CUE 🎧   │  │ ▶ ⏸ CUE 🎧   │
│ Vol ▮▮▮▮▯    │  │ Vol ▮▮▮▮▯    │
└───────────────┘  └───────────────┘
       Crossfader
   A ●═══════●━━━━━ B
```

---

## 3. LISTA DE TAREAS

### Backend / DB

- [ ] Agregar `model AudioEffectsConfig` y campos `fadeInMs?/fadeOutMs?` en `prisma/schema.prisma`
- [ ] Generar migration `add_audio_effects_config_and_asset_fades` (`npx prisma migrate dev`)
- [ ] Regenerar Prisma client
- [ ] Crear `src/main/ipc/audioEffects.ipc.ts` con handlers `get`/`update` (incluye `upsert` por profileId)
- [ ] Extender `src/main/ipc/audioAssets.ipc.ts` con `updateFades(assetId, fadeInMs?, fadeOutMs?)`
- [ ] Registrar el IPC nuevo en `src/main/index.ts`
- [ ] Exponer canales en `src/preload/index.ts`
- [ ] Actualizar tipos en `src/renderer/src/types/ipc.types.ts`
- [ ] Mock en `src/renderer/public/electron-api-mock.js`

### Frontend

- [ ] Crear `src/renderer/src/services/audioEffectsService.ts`
- [ ] Crear hook `src/renderer/src/hooks/useAudioEffects.ts` (CRUD + dispatch `flux:audio-effects-changed`)
- [ ] Crear hook `src/renderer/src/hooks/useMixer.ts` (decks A/B + crossfader + cue)
- [ ] Crear `src/renderer/src/pages/AudioEffectsPage/` (página + tabs + CSS module)
- [ ] Crear `src/renderer/src/components/MixerDJ/` (componente reusable + Deck)
- [ ] Agregar item "Efectos" al sidebar y ruta `/efectos`
- [ ] Modificar `usePlayout` para consumir `crossfadeMs` y `fadeInMs/fadeOutMs` del asset (RN-03)
- [ ] Modificar `PlayoutPage` para registrar panels opcionales `crossfadeStatus` y `mixerDJ`
- [ ] Listener en `usePlayout` para `flux:audio-effects-changed` (recarga config en caliente)

### QA / Tests

- [ ] Unit: `useAudioEffects` (CRUD + emisión de evento)
- [ ] Unit: `useMixer` (carga de deck, crossfader, cue, unloadAll)
- [ ] Unit: `usePlayout` con crossfade habilitado — verificar fade out + fade in superpuestos
- [ ] Unit: regla RN-03 (max entre global y per-track)
- [ ] Componente: `AudioEffectsPage` (3 tabs, validaciones de rango)
- [ ] Componente: `MixerDJ` con cue deshabilitado si no hay monitor
- [ ] Integración: actualización en caliente vía CustomEvent
- [ ] E2E (opcional v1): editar crossfade y verificar que la próxima transición lo aplica
- [ ] Cobertura objetivo: mantener ≥ 90%

### Documentación

- [ ] Sección "Efectos de Audio" en `docs/MANUAL_USUARIO.md` (3 sub-secciones: crossfade, per-track, mixer DJ)
- [ ] Bullet en README + entrada en módulos principales
- [ ] Marcar esta spec como `IMPLEMENTED` al cerrar

---

## 4. RIESGOS Y CONSIDERACIONES

| Riesgo | Mitigación |
|---|---|
| Howler `fade()` es lineal — no equal-power | Aceptar lineal en v1 + TODO documentado para v2 con WebAudio puro |
| Crossfade interfiere con la captura WebAudio del EQ | Reutilizar el mismo `connectHowlToEq()` para ambos howls (entrada y saliente) |
| Mixer DJ + playout simultáneos saturan el CPU | Cada deck es html5; el navegador comparte el thread de audio. Probar con 3 howls activos en hardware target. |
| Cue del mixer compite con el monitor del playout | El monitor del playout sigue corriendo; la salida del cue del mixer **se enruta en lugar del aire** (no en paralelo). Documentar claramente. |
| Migration en SQLite con campos nullables | OK — Prisma agrega columnas nullables sin reescribir la tabla |
| El usuario espera reverb/compresor también | Spec deja claro que es FASE 2; UI puede mostrar pestañas grises "Próximamente" |

---

## 5. APROBACIÓN

> Para pasar a `APPROVED` el usuario debe responder:
> 1. ¿Acepta diferir compresor/limiter/reverb a v2? (decisión ya confirmada en cuestionario)
> 2. ¿Acepta fade lineal en v1 con TODO de equal-power para v2?
> 3. ¿Confirma que la página Efectos vive en el sidebar como item nuevo?
