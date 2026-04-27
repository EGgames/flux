# ADR-0001: Robustness v1

- **Status**: Accepted
- **Date**: 2026-04-26
- **Spec**: [`.github/specs/robustness-v1.spec.md`](../../.github/specs/robustness-v1.spec.md)

## Contexto

FLUX es una app Electron que opera "al aire". Una falla del proceso renderer (excepción React no atrapada), una migración de Prisma corrupta o un freeze silencioso del backend de audio se traducen directamente en aire muerto. La auditoría inicial identificó 15 huecos de robustez, de los cuales los 7 prioritarios componen este ADR.

## Decisión

Implementamos siete capas defensivas agrupadas en `SPEC-001`:

1. **Logging persistente** (`electron-log`) con rotación 10 MB y captura de `uncaughtException`/`unhandledRejection`.
2. **Backup automático + restore** de SQLite antes de cada migración (`BackupService`, retención 7).
3. **Watchdog de audio** que detecta freezes de posición (3 s) y emite `playout:stall` para que el renderer salte el track.
4. **Reconexión exponencial** del cliente Icecast/Shoutcast (1 s → 60 s capped) preservando config y respetando `disconnect` manual.
5. **Validación Zod en IPC** (`validatedHandle`) — primera adopción en `playlist:create`, expansión incremental en próximas iteraciones.
6. **Hardening Electron**: CSP estricto en `index.html`, `webSecurity: true`, allowlist explícita de canales IPC en preload.
7. **Hook `useDeviceChange`** para detectar (des)conexión de placas de audio.
8. **ErrorBoundary** raíz que evita que un crash de UI tire la app.
9. **Auto-updater opcional** vía `UPDATE_FEED_URL` (`AutoUpdaterService`).

## Alternativas consideradas

- **Sentry / Rollbar como alternativa a electron-log**: descartado por dependencia externa y costo. El log local es suficiente para post-mortem.
- **Migrar a Drizzle / better-sqlite3 directo**: costo migrar fuera del scope; el problema de robustez se resuelve con backup + restore.
- **Watchdog en el renderer (Howler events directos)**: descartado para mantener una sola fuente de verdad de "estado de aire" en el main process.
- **Service worker para reconexión streaming**: descartado, agregaba complejidad sin beneficio (el main process ya tiene control total).

## Consecuencias

### Positivas
- Reducción del MTTR: logs accionables y backup recuperable.
- El aire sobrevive a crashes de UI (ErrorBoundary) y stalls de audio (watchdog → next).
- Reconexión robusta sin intervención manual hasta 60 s.
- Base preparada para auto-update sin esfuerzo adicional de release.

### Negativas / Trade-offs
- `+1 dependencia` (zod) — costo: ~100 KB minified. Aceptable.
- IPC `playout:report-position` agrega 1 invoke/s — overhead despreciable.
- Validación Zod en IPC implica boilerplate de schemas (compensado por seguridad y autodescubrimiento).

## Métricas de éxito

- 0 reportes de "se cayó la app" por crash de UI no capturado.
- Restore exitoso > 95 % en migraciones fallidas (verificable post-deploy).
- Tiempo medio de reconexión streaming < 5 s para fallas transitorias.

## Seguimiento

- HU-5 (Zod IPC) tiene cobertura en 1/8 archivos IPC. Issue de seguimiento: extender a `audioAssets`, `playlists` (resto), `programs`, `adBlocks`, `soundboard`, `outputs`, `profiles`, `playout`.
- HU-3 watchdog: validar threshold de 3 s en condiciones reales; tunear si genera falsos positivos.
