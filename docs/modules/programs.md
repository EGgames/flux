# Programs (Scheduler)

El **Scheduler** es el cerebro que automatiza la radio durante las 24 horas del día sin intervención humana. Determina qué Playlist debe estar activa en cada momento basándose en reglas horarias.

## Reglas de Programación
Cada `RadioProgram` en la base de datos define:
- **Día de la Semana**: Lunes, Martes, etc.
- **Franja Horaria**: `startTime` y `endTime` (formato HH:mm).
- **Playlist**: La lista que debe sonar durante ese tiempo.
- **Prioridad**: En caso de solapamiento de horarios, el programa con mayor prioridad gana.

## Motor de Ejecución
Ubicación: `src/main/services/schedulerService.ts`

El servicio utiliza `node-cron` para realizar chequeos periódicos (cada minuto) o suscribirse a eventos de tiempo exacto.

### Lógica de Cambio de Programa
1. Se evalúa el programa actual comparándolo con la hora del sistema.
2. Si un nuevo programa debe entrar:
   - El sistema espera a que termine el track musical actual de la playlist anterior ("Soft Switch").
   - Carga la nueva playlist en el `PlayoutService`.
   - Reinicia los contadores de tandas si el programa así lo requiere.

## Visualización
En la página de **Programs**, el usuario ve un calendario o grilla horaria donde puede arrastrar y soltar listas para "programar el aire" de la radio de forma visual.
