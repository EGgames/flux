'use strict'
/**
 * Copia src/main/launcher.cjs a out/main/launcher.js despues del build de
 * electron-vite. Lo hacemos como paso post-build (en lugar de meterlo en
 * electron-vite) para evitar que esbuild lo procese y para que el archivo
 * resultante sea CJS plano garantizado.
 */
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'src', 'main', 'launcher.cjs')
const destDir = path.join(__dirname, '..', 'out', 'main')
const dest = path.join(destDir, 'launcher.js')

fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(src, dest)
console.log(`[postbuild] copied ${path.relative(process.cwd(), src)} -> ${path.relative(process.cwd(), dest)}`)
