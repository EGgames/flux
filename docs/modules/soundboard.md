# Soundboard (Botonera Instantánea)

La **Soundboard** ofrece al operador una grilla de acceso rápido para disparar efectos de sonido, cortinas o jingles de forma instantánea.

## Características

- **Polifonía**: Se pueden disparar múltiples sonidos de la Soundboard simultáneamente. No se interrumpen entre sí ni interrumpen el playout musical.
- **Configuración por Perfil**: Cada perfil tiene su propio set de botones asignados.
- **Looping**: Algunos botones pueden configurarse para reproducirse en bucle (ideal para cortinas de fondo mientras habla el locutor).

## Implementación Técnica

### Hook `useSoundboard`
Ubicación: `src/renderer/src/hooks/useSoundboard.ts`

Este hook gestiona un mapa de instancias de `Howl` cacheadas. 
- Cuando el usuario hace clic, el sonido se reproduce inmediatamente.
- Utiliza el mismo sistema de **Enrutado de Audio** que el playout para asegurar que los efectos salgan por el dispositivo de salida correcto asignado al perfil.

### Persistencia
La asignación de audios a botones se guarda en la tabla `SoundboardButton` de la base de datos:
- `id`: Su posición en la grilla visual.
- `audioAssetId`: ID del audio a reproducir.
- `config`: Opciones como color del botón, volumen específico o modo loop.

## Interfaz de Usuario
- **Modo Ejecución**: Disparo rápido con un clic.
- **Modo Edición**: Permite asignar nuevos audios a los botones mediante Drag & Drop desde la biblioteca de audio.
