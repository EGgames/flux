# Build y Release

El proceso de construcción de Flux convierte el código fuente de TypeScript y los componentes de React en un ejecutable de escritorio instalable.

## Configuración de electron-vite
Flux utiliza `electron-vite` para orquestar la compilación paralela de los tres procesos (Main, Preload, Renderer).
- **Configuración**: `electron.vite.config.ts`.
- **Estrategia**: Babel/SWC para transpilación ultra rápida y Vite para el bundling de assets del frontend.

## Empaquetado (electron-builder)
El empaquetado final se gestiona con `electron-builder`, configurado en el archivo `electron-builder.yml`.

### Artefactos Generados
- **Windows**: Instalador NSIS (`.exe`) y versión portable (`.zip`).
- **Recursos**: Incluye los binarios de Prisma (Query Engine) necesarios para la arquitectura del sistema operativo de destino.

## Pasos para generar una versión de producción

1. **Compilar el código**:
   ```bash
   npm run build
   ```
   Esto genera los archivos transpilados en la carpeta `out/`.

2. **Crear el instalador (Windows)**:
   ```bash
   npm run dist:win
   ```
   El instalador final se encontrará en la carpeta `dist/`.

## Variables de Entorno
Para el proceso de build, asegúrate de que no haya variables sensibles harcodeadas. `electron-builder` empaquetará la aplicación con el `NODE_ENV=production`.

## Gestión de la Base de Datos en Producción
En el primer arranque post-instalación, la aplicación detecta si la base de datos existe en `%APPDATA%/flux/flux.db`. Si no existe, realiza un `prisma migrate deploy` automático para crear las tablas en la máquina del usuario final.
