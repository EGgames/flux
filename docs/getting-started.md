# Comenzando (Getting Started)

Sigue estos pasos para configurar tu entorno de desarrollo para Flux.

## Requisitos Previos

- **Node.js**: Versión 20 LTS o superior.
- **npm**: Versión 10 o superior.
- **FFmpeg / ffprobe**: Debe estar instalado en el sistema y accesible en el `PATH`. Se utiliza para obtener metadatos y duraciones precisas de los archivos de audio.
- **Java 17+ y Maven 3.9+**: Únicamente necesarios para ejecutar la suite de pruebas E2E (Serenity/Cucumber).

## Instalación

1. **Clona el repositorio**:
   ```bash
   git clone <repo-url>
   cd flux
   ```

2. **Instala las dependencias**:
   ```bash
   npm install
   ```

3. **Configura la Base de Datos**:
   Flux utiliza SQLite. Genera el cliente Prisma y aplica las migraciones iniciales:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

## Desarrollo

Para iniciar la aplicación en modo desarrollo con Hot Module Replacement (HMR):

```bash
npm run dev
```

Esto abrirá la ventana de Electron. Los logs del proceso Main se verán en la terminal, y los del Renderer en las DevTools de la ventana abierta.

## Scripts Útiles

| Comando | Descripción |
|---|---|
| `npm run build` | Compila el código para producción. |
| `npm run test` | Ejecuta los tests unitarios con Vitest. |
| `npm run test:coverage` | Genera reporte de cobertura de código. |
| `npm run lint` | Verifica el estilo de código con ESLint. |
| `npm run e2e:serenity` | Ejecuta los tests de extremo a extremo. |

## Estructura de Carpetas

- `src/main`: Lógica de Node.js, Prisma, Servicios de Background.
- `src/renderer`: Aplicación React (Frontend).
- `prisma/`: Esquema de la base de datos y migraciones.
- `docs/`: Documentación técnica (donde te encuentras ahora).
- `e2e-tests/`: Suite de pruebas automatizadas en Java/Serenity.
