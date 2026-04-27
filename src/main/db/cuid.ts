/**
 * ID generator estilo cuid (compat con `@default(cuid())` de Prisma).
 *
 * No es cuid spec, pero produce IDs URL-safe, ordenables por tiempo y sin
 * colisiones realistas en single-process. Usado SOLO cuando `data.id` no
 * viene en `create()` / `upsert()`.
 */
let counter = 0
export function cuid(): string {
  counter = (counter + 1) % 0xffff
  const ts = Date.now().toString(36)
  const rand = Math.floor(Math.random() * 0xffffffff).toString(36)
  const cnt = counter.toString(36).padStart(3, '0')
  return `c${ts}${cnt}${rand}`
}
