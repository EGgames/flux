# Integraciones: Salidas y Streaming

Flux permite que el audio procesado llegue a sus destinos finales: altavoces físicos, monitores de cabina o servidores de streaming en la nube.

## Salidas de Hardware (Locales)

El módulo de integraciones gestiona el mapeo entre los buses lógicos de Flux y los dispositivos físicos detectados por el sistema operativo.

### Tipos de Salida
1. **Salida Principal (Main Out)**: El bus maestro. Es el que sale al aire.
2. **Monitor**: Bus secundario para pre-escucha o auriculares. Generalmente utilizado para escuchar lo que va a sonar a continuación sin salir al aire, o para monitorear la señal actual con una latencia distinta.

### Cambio en Caliente (Hot-swap)
Flux permite cambiar el dispositivo de salida mientras suena la música sin necesidad de reiniciar el programa. Esto se logra mediante el método `setSinkId` del elemento de audio HTML5, gestionado cuidadosamente para evitar bloqueos del navegador (ver [ADR 0002](../adr/0002-eq-via-mediaelementsource.md)).

## Streaming (Icecast / Shoutcast)

Ubicación: `src/main/services/streamingService.ts`

El servicio de streaming permite enviar la señal de radio a internet.

### Funcionamiento
1. **Captura**: El audio del bus principal se captura en el proceso Main.
2. **Codificación**: Se utiliza una librería de codificación (frecuentemente MP3 o OGG) para convertir el flujo PCM a un formato comprimido.
3. **Protocolo**: Se realiza una conexión HTTP utilizando el método `PUT` o `SOURCE` hacia un servidor Icecast o Shoutcast remoto.

### Configuración
El usuario debe proveer:
- Host / IP y Puerto.
- Mountpoint (Punto de montaje).
- Password de la fuente.
- Bitrate (ej. 128kbps, 192kbps).

## Estados de Conexión
Flux notifica en tiempo real el estado del streaming en la barra de estado:
- 🔴 Desconectado.
- 🟡 Conectando.
- 🟢 En el aire (Streaming activo).
- ⚠️ Error (con detalle del log).
