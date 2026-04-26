# Tandas y Bloques Publicitarios

El módulo de **Tandas** gestiona la inserción automática de publicidad o contenidos cortos (como IDs de estación) entre los tracks musicales.

## Conceptos Clave

### AdBlock (Tanda)
Un bloque es un contenedor ordenado de uno o varios archivos de audio (`AdBlockItem`). Por ejemplo: "Tanda Mañana 01" puede contener 3 avisos de clientes.

### AdRules (Reglas de Disparo)
Existen dos formas de disparar una tanda:

1. **Por Horario (Cron)**:
   - Se programa una hora exacta (ej: 10:30).
   - El sistema espera a que el track actual termine (si está activada la opción "esperar") e inyecta la tanda inmediatamente.
   
2. **Por Contador (Hits)**:
   - Se define cada cuántos tracks de la playlist debe sonar el bloque (ej: "cada 4 canciones").
   - El `PlayoutService` mantiene un contador persistente. Al llegar al límite, la tanda se añade como el "siguiente track" en la cola.

## Ciclo de Vida de una Tanda

1. **Detección**: El `SchedulerService` detecta que una regla se ha cumplido.
2. **Notificación**: Se envía un evento `flux:ad-break-start` al Renderer.
3. **Ejecución**: El player de música baja el volumen o se detiene, y comienza la secuencia del `AdBlock`.
4. **Finalización**: Al sonar el último item del bloque, se dispara `flux:ad-break-end`.
5. **Retorno**: El playout de música se reanuda automáticamente.

## Prioridades
Si una regla horaria coincide exactamente con una regla de contador, Flux prioriza la **Regla Horaria** y resetea el contador de tracks para evitar saturación de publicidad.
