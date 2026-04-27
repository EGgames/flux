'use strict'
/**
 * Launcher de produccion (CJS plano, NO se procesa por electron-vite).
 *
 * Ajusta NODE_PATH para incluir `app.asar.unpacked/node_modules/` antes de
 * cargar el bundle main. Necesario porque `node_modules/.prisma/client/`
 * (cliente generado de Prisma + binario nativo .node) se copia via
 * extraResources a `resources/app.asar.unpacked/node_modules/.prisma/client/`
 * y Node debe poder resolverlo como modulo top-level cuando
 * `@prisma/client/default.js` haga `require('.prisma/client/default')`.
 *
 * Este archivo se copia a `out/main/launcher.js` por el script
 * `scripts/copy-launcher.cjs` despues del build de electron-vite, y se declara
 * como `extraMetadata.main` en electron-builder.yml.
 */
const path = require('path')
const Module = require('module')

if (process.resourcesPath) {
  const unpackedNm = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
  process.env.NODE_PATH = unpackedNm + path.delimiter + (process.env.NODE_PATH || '')
  Module._initPaths()
}

require('./index.js')
