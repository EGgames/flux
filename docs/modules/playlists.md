# Playlists y Biblioteca

El sistema de **Playlists** de Flux permite organizar los activos de audio y definir el orden de emisión fuera del horario de programas específicos.

## Gestión de Biblioteca
Flux no duplica archivos físicos; almacena referencias a las rutas del disco en la tabla `AudioAsset`. 
- **Escaneo**: El sistema puede escanear carpetas locales e importar metadatos automáticamente.
- **Tipos de Source**: Soporta archivos locales y, experimentalmente, URLs de streaming externas (WebRadio relays).

## Funcionamiento de Listas
Una playlist es una secuencia estática de audios. Sin embargo, el **Playout** puede consumirla de dos formas:
1. **Lineal**: Sigue el orden estricto de la posición (1, 2, 3...).
2. **Aleatorio (Shuffle)**: El motor de reproducción elige el siguiente track al azar, pero asegurando que no se repitan hasta que toda la lista haya sonado.

## Vinculación con Otros Módulos
- **Programas**: Los programas programados en el Scheduler siempre apuntan a una Playlist.
- **Tandas**: Las reglas de tandas por contador cuentan los tracks que se reproducen desde una Playlist activa.

## Caché de Metadatos
Para evitar lecturas constantes de disco, Flux guarda la duración (calculada por `ffprobe`) y los tags (Artista, Título) en la base de datos. Si el archivo cambia en el disco, el usuario puede forzar un re-escaneo desde la UI.
