# Requerimiento: Plataforma de Automatizacion Radial Local (MVP)

## Descripcion General

Se requiere un software de escritorio local para Windows, similar a Radio Boss, orientado a operacion radial en vivo y automatizada. El MVP debe incluir reproduccion musical, tandas publicitarias, botonera de disparo rapido, listas de musica, perfiles de operador y programacion de programas de radio.

## Objetivo de Negocio

Permitir a una radio operar su programacion completa desde una unica aplicacion local, con posibilidad futura de evolucionar a una version web y multi sistema operativo.

## Alcance MVP (Obligatorio)

1. Reproduccion de audio continua (musica y efectos) en entorno local.
2. Gestion de fuentes de audio mixtas:
   - Archivos locales.
   - Fuentes de streaming.
3. Tandas publicitarias configurables por Usuario en modo mixto:
   - Por horarios.
   - Por cantidad de canciones.
   - Por disparo manual.
4. Botonera configurable de 16 botones:
   - Cada boton puede disparar musica, efecto, jingle o cortina.
5. Listas de musica:
   - Creacion, edicion, orden y ejecucion de playlists.
6. Programas de radio configurables:
   - Grilla configurable por Usuario.
   - Reglas de emision por franja horaria.
7. Perfiles de operacion:
   - Cada Usuario puede crear su Perfil sin password (modo local).
8. Integraciones de salida de audio:
   - Audio local por salida de PC.
   - Streaming a Icecast.
   - Streaming a Shoutcast.
9. Todas las funcionalidades anteriores son obligatorias para el MVP.

## Plataforma y Restricciones

- Plataforma inicial: Escritorio local.
- Sistema operativo objetivo inicial: Windows.
- Evolucion futura esperada: web + multi OS.
- Operacion principal: local-first, sin dependencia obligatoria de internet para reproduccion local.

## Criterios de Aceptacion de Negocio

1. El Usuario puede reproducir musica en continuidad desde libreria y listas.
2. El Usuario puede crear tandas y ejecutarlas por reglas mixtas configurables.
3. El Usuario dispone de una botonera de 16 botones completamente configurable.
4. El Usuario puede crear y administrar listas de musica activas para emision.
5. El Usuario puede definir programas de radio y reglas de ejecucion.
6. El Usuario puede crear un Perfil local sin password.
7. El audio puede salir por PC local y puede enviarse a Icecast y Shoutcast.
8. El sistema funciona en Windows como app de escritorio.

## Riesgos y Consideraciones Iniciales

- Sin password en perfiles: riesgo de acceso no autorizado en equipos compartidos.
- Integraciones de streaming: requieren validacion de latencia y reconexion.
- Motor de audio: debe evitar cortes al alternar entre musica, tandas y botonera.
- Scheduler mixto: requiere reglas claras de prioridad para evitar conflictos.
