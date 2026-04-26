# Testing

Flux mantiene una cultura de calidad rigurosa con una suite de pruebas que cubre desde la lógica de base de datos hasta la interacción del usuario final.

## Estrategia de Pruebas

### 1. Pruebas Unitarias e Integración (Vitest)
Se utilizan para probar componentes de React, hooks y servicios del proceso Main.
- **Framework**: Vitest 2.1
- **Entorno**: `jsdom` para frontend, `node` para backend.
- **Coverage**: Se requiere un alto nivel de cobertura en servicios críticos (Playout, Scheduler).

**Comandos:**
```bash
npm run test          # Ejecuta todos los tests una vez
npm run test:watch    # Modo desarrollo
npm run test:coverage # Genera reporte en /coverage
```

### 2. Pruebas de Extremo a Extremo (E2E)
Prueban flujos completos de usuario (ej: "Crear una playlist, añadir un audio y disparar el playout").
- **Framework**: Cucumber + Serenity BDD (Java).
- **Ubicación**: Carpeta `e2e-tests/`.
- **Drivers**: Selenium/Playwright configurados para conectarse a la instancia de Electron.

**Comandos:**
```bash
npm run e2e:serenity # Ejecuta la suite completa
```

## Mocking de APIs de Electron
Para los tests de frontend, se utiliza el archivo `src/renderer/public/electron-api-mock.js` que simula el bridge IPC, permitiendo que los tests de Vitest corran en un navegador normal o en JSDOM sin necesidad de levantar Electron.

## Base de Datos para Tests
Prisma está configurado para usar una base de datos SQLite temporal (`test.db`) durante la ejecución de los tests de integración para asegurar que los datos de desarrollo no se vean afectados.
