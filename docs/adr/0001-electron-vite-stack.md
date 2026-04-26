# ADR 0001: Stack Tecnológico Base

## Estado
Aceptado

## Contexto
Flux requiere ser una aplicación de escritorio de alto rendimiento para automatización de radio 24/7. Necesita manejo preciso de audio, una interfaz altamente interactiva para el operador y persistencia de datos local robusta.

## Decisión
Se ha seleccionado el siguiente stack:
- **Electron 33**: Para acceso a APIs de bajo nivel (File System, Hardware de Audio, Multi-ventana).
- **React 19 + Vite 6**: Para una UI reactiva y un flujo de desarrollo extremadamente rápido (HMR).
- **Prisma + SQLite**: Proporciona los beneficios de un ORM tipado con la simplicidad de una base de datos de un solo archivo que no requiere instalación en el cliente.
- **TypeScript 5.7 (Strict)**: Esencial para mantener la integridad de los datos en toda la aplicación, especialmente en la comunicación IPC.
- **Howler.js + Web Audio API**: La combinación perfecta entre facilidad de uso para estados de reproducción y control total de bajo nivel para ecualización y ruteo de salida.

## Consecuencias
- **Positivas**: Tipado de extremo a extremo (Main -> Preload -> Renderer). Rendimiento superior en procesamiento de audio. Facilidad de distribución.
- **Negativas**: Mayor peso del ejecutable (inherente a Electron). Curva de aprendizaje inicial en la orquestación de los tres procesos.
