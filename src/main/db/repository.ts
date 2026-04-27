import type Database from 'better-sqlite3'
import type { ModelDef } from './schema'
import { MODELS } from './schema'
import { cuid } from './cuid'

/**
 * Tipos auxiliares (subset Prisma) que usamos en el codigo.
 * No buscamos cubrir TODA la API Prisma — solo lo que nuestros IPC handlers
 * efectivamente invocan (auditado via grep en src/main/ipc/**).
 */
type Row = Record<string, unknown>
type WhereValue = unknown | { in?: unknown[] } | { not?: unknown }
type Where = Record<string, WhereValue>
type OrderBy = Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>

interface IncludeShape {
  [key: string]: true | { include?: IncludeShape; orderBy?: OrderBy; select?: SelectShape }
}
// _count special: { _count: { select: { items: true } } } -> agrega `_count: { items: N }`
interface CountSelect {
  select?: Record<string, true>
}
interface SelectShape {
  [key: string]: true
}

interface FindManyArgs {
  where?: Where
  orderBy?: OrderBy
  include?: IncludeShape & { _count?: CountSelect }
  select?: SelectShape
  take?: number
  skip?: number
}

interface CreateArgs {
  data: Row
  include?: IncludeShape & { _count?: CountSelect }
  select?: SelectShape
}

interface UpdateArgs {
  where: Where
  data: Row
  include?: IncludeShape & { _count?: CountSelect }
  select?: SelectShape
}

interface UpsertArgs {
  where: Where
  create: Row
  update: Row
}

/**
 * Construye `WHERE col = ? AND col2 IN (?,?,?)` + lista de bindings.
 * Soporta:
 *   - igualdad simple: { col: value }
 *   - in: { col: { in: [...] } }
 *   - not: { col: { not: value } }
 */
function buildWhere(where: Where | undefined): { sql: string; params: unknown[] } {
  if (!where || Object.keys(where).length === 0) return { sql: '', params: [] }
  const parts: string[] = []
  const params: unknown[] = []
  for (const [col, val] of Object.entries(where)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      const v = val as { in?: unknown[]; not?: unknown }
      if (Array.isArray(v.in)) {
        if (v.in.length === 0) {
          // Prisma { in: [] } siempre matchea cero filas.
          parts.push('1 = 0')
          continue
        }
        const placeholders = v.in.map(() => '?').join(',')
        parts.push(`"${col}" IN (${placeholders})`)
        params.push(...v.in.map(toSqlValue))
        continue
      }
      if ('not' in v) {
        if (v.not === null) {
          parts.push(`"${col}" IS NOT NULL`)
        } else {
          parts.push(`"${col}" != ?`)
          params.push(toSqlValue(v.not))
        }
        continue
      }
    }
    if (val === null) {
      parts.push(`"${col}" IS NULL`)
    } else {
      parts.push(`"${col}" = ?`)
      params.push(toSqlValue(val))
    }
  }
  return { sql: parts.length ? ` WHERE ${parts.join(' AND ')}` : '', params }
}

function buildOrderBy(orderBy: OrderBy | undefined): string {
  if (!orderBy) return ''
  const list = Array.isArray(orderBy) ? orderBy : [orderBy]
  const parts: string[] = []
  for (const obj of list) {
    for (const [col, dir] of Object.entries(obj)) {
      const safeDir = String(dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC'
      parts.push(`"${col}" ${safeDir}`)
    }
  }
  return parts.length ? ` ORDER BY ${parts.join(', ')}` : ''
}

/** SQLite no tiene boolean: serializamos true/false a 1/0. Date -> ISO string. */
function toSqlValue(v: unknown): unknown {
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v instanceof Date) return v.toISOString()
  if (v === undefined) return null
  return v
}

/** Convierte un row de SQLite (booleans como 0/1) a forma Prisma (true/false). */
function fromSqlRow(row: Row | undefined, model: ModelDef): Row | null {
  if (!row) return null
  const out: Row = { ...row }
  for (const col of model.booleans) {
    if (col in out && out[col] !== null && out[col] !== undefined) {
      out[col] = Boolean(out[col])
    }
  }
  return out
}

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Repositorio generico para una tabla. Implementa el subset de la API de
 * Prisma que usamos en los IPC handlers (auditado via grep).
 *
 * Diseno:
 *  - Ningun query builder externo: SQL crafteado a mano, con prepared
 *    statements (cache en `stmts`) para tener performance Prisma-like sin
 *    dependencias adicionales.
 *  - `include` resuelto en JS post-fetch (1 query principal + 1 query por
 *    relacion incluida). Aceptable para nuestros datasets (decenas de
 *    playlists/items, no millones).
 *  - Booleans serializados a 0/1 transparentemente en input y deserializados
 *    a true/false en output.
 *  - `id` y timestamps generados auto en create/upsert si el modelo lo declara.
 */
export class Repository {
  private model: ModelDef
  private db: Database.Database
  private stmts = new Map<string, Database.Statement>()
  /** Resolver para includes: el caller (Facade) provee acceso a otros repos. */
  private resolveRepo: (name: string) => Repository

  constructor(
    db: Database.Database,
    model: ModelDef,
    resolveRepo: (name: string) => Repository
  ) {
    this.db = db
    this.model = model
    this.resolveRepo = resolveRepo
  }

  private prep(sql: string): Database.Statement {
    let s = this.stmts.get(sql)
    if (!s) {
      s = this.db.prepare(sql)
      this.stmts.set(sql, s)
    }
    return s
  }

  // ---- public API (Prisma-compatible subset) ----

  async findMany(args: FindManyArgs = {}): Promise<Row[]> {
    const { sql: whereSql, params } = buildWhere(args.where)
    const orderSql = buildOrderBy(args.orderBy)
    const limitSql = typeof args.take === 'number' ? ` LIMIT ${args.take | 0}` : ''
    const offsetSql = typeof args.skip === 'number' ? ` OFFSET ${args.skip | 0}` : ''
    const sql = `SELECT * FROM "${this.model.table}"${whereSql}${orderSql}${limitSql}${offsetSql}`
    const rows = this.prep(sql).all(...params) as Row[]
    const mapped = rows.map((r) => fromSqlRow(r, this.model)!) as Row[]
    if (args.include) await this.attachIncludes(mapped, args.include)
    if (args.select) return mapped.map((r) => projectSelect(r, args.select!))
    return mapped
  }

  async findFirst(args: FindManyArgs = {}): Promise<Row | null> {
    const list = await this.findMany({ ...args, take: 1 })
    return list[0] ?? null
  }

  async findUnique(args: { where: Where; include?: IncludeShape; select?: SelectShape }): Promise<Row | null> {
    return this.findFirst({ where: args.where, include: args.include, select: args.select })
  }

  async count(args: { where?: Where } = {}): Promise<number> {
    const { sql: whereSql, params } = buildWhere(args.where)
    const sql = `SELECT COUNT(*) as c FROM "${this.model.table}"${whereSql}`
    const row = this.prep(sql).get(...params) as { c: number }
    return row.c
  }

  async create(args: CreateArgs): Promise<Row> {
    const data = this.applyDefaultsForCreate(args.data)
    const cols = this.model.columns.filter((c) => c in data)
    const placeholders = cols.map(() => '?').join(',')
    const colsList = cols.map((c) => `"${c}"`).join(',')
    const sql = `INSERT INTO "${this.model.table}" (${colsList}) VALUES (${placeholders})`
    const params = cols.map((c) => toSqlValue(data[c]))
    this.prep(sql).run(...params)
    const id = data[this.model.pk]
    const created = await this.findUnique({
      where: { [this.model.pk]: id },
      include: args.include,
      select: args.select
    })
    if (!created) throw new Error(`[db] failed to read back created row from ${this.model.table}`)
    return created
  }

  async update(args: UpdateArgs): Promise<Row> {
    const data = this.applyDefaultsForUpdate(args.data)
    const setCols = Object.keys(data).filter((c) => this.model.columns.includes(c))
    if (setCols.length === 0) {
      // Sin cambios reales: solo devolver la fila actual (Prisma error si no existe).
      const cur = await this.findUnique({ where: args.where })
      if (!cur) throw new Error(`[db] update: row not found in ${this.model.table}`)
      return cur
    }
    const setSql = setCols.map((c) => `"${c}" = ?`).join(', ')
    const { sql: whereSql, params: whereParams } = buildWhere(args.where)
    const sql = `UPDATE "${this.model.table}" SET ${setSql}${whereSql}`
    const params = [...setCols.map((c) => toSqlValue(data[c])), ...whereParams]
    const info = this.prep(sql).run(...params)
    if (info.changes === 0) {
      throw new Error(`[db] update: no row matched in ${this.model.table}`)
    }
    const updated = await this.findFirst({
      where: args.where,
      include: args.include,
      select: args.select
    })
    if (!updated) throw new Error(`[db] update: failed to read back row from ${this.model.table}`)
    return updated
  }

  async updateMany(args: { where?: Where; data: Row }): Promise<{ count: number }> {
    const data = this.applyDefaultsForUpdate(args.data)
    const setCols = Object.keys(data).filter((c) => this.model.columns.includes(c))
    if (setCols.length === 0) return { count: 0 }
    const setSql = setCols.map((c) => `"${c}" = ?`).join(', ')
    const { sql: whereSql, params: whereParams } = buildWhere(args.where)
    const sql = `UPDATE "${this.model.table}" SET ${setSql}${whereSql}`
    const params = [...setCols.map((c) => toSqlValue(data[c])), ...whereParams]
    const info = this.prep(sql).run(...params)
    return { count: info.changes }
  }

  async delete(args: { where: Where }): Promise<Row> {
    const cur = await this.findUnique({ where: args.where })
    if (!cur) throw new Error(`[db] delete: row not found in ${this.model.table}`)
    const { sql: whereSql, params } = buildWhere(args.where)
    const sql = `DELETE FROM "${this.model.table}"${whereSql}`
    this.prep(sql).run(...params)
    return cur
  }

  async deleteMany(args: { where?: Where } = {}): Promise<{ count: number }> {
    const { sql: whereSql, params } = buildWhere(args.where)
    const sql = `DELETE FROM "${this.model.table}"${whereSql}`
    const info = this.prep(sql).run(...params)
    return { count: info.changes }
  }

  async upsert(args: UpsertArgs): Promise<Row> {
    const existing = await this.findUnique({ where: args.where })
    if (existing) {
      return this.update({ where: args.where, data: args.update })
    }
    // create() necesita los campos unique del where + create. En Prisma, los
    // unique fields del where se mergean en create automaticamente.
    const data = { ...args.where, ...args.create }
    return this.create({ data })
  }

  // ---- internals ----

  private applyDefaultsForCreate(data: Row): Row {
    const out: Row = { ...data }
    if (this.model.defaults.id && !out[this.model.pk]) {
      out[this.model.pk] = cuid()
    }
    const now = nowIso()
    if (this.model.timestamps.createdAt && !out.createdAt) {
      out.createdAt = now
    }
    if (this.model.timestamps.updatedAt && !out.updatedAt) {
      out.updatedAt = now
    }
    return out
  }

  private applyDefaultsForUpdate(data: Row): Row {
    const out: Row = { ...data }
    if (this.model.timestamps.updatedAt) {
      out.updatedAt = nowIso()
    }
    return out
  }

  /**
   * Resuelve `include` en JS para una lista de filas ya leidas.
   *
   * Soportado:
   *  - `relName: true` -> agrega `row[relName] = []` o `null` segun cardinalidad.
   *  - `relName: { include?, orderBy?, select? }` -> idem + opciones.
   *  - `_count: { select: { relName: true } }` -> agrega `row._count = { relName: N }`.
   */
  private async attachIncludes(
    rows: Row[],
    include: IncludeShape & { _count?: CountSelect }
  ): Promise<void> {
    if (rows.length === 0) return
    for (const [key, spec] of Object.entries(include)) {
      if (key === '_count') {
        const sel = (spec as CountSelect)?.select ?? {}
        for (const row of rows) {
          row._count = row._count || {}
        }
        for (const relName of Object.keys(sel)) {
          const rel = this.model.relations[relName]
          if (!rel || rel.type !== 'many') continue
          const targetRepo = this.resolveRepo(rel.target)
          for (const row of rows) {
            const c = await targetRepo.count({ where: { [rel.foreignKey]: row[rel.localKey] } })
            ;(row._count as Record<string, number>)[relName] = c
          }
        }
        continue
      }

      const rel = this.model.relations[key]
      if (!rel) continue
      const targetRepo = this.resolveRepo(rel.target)
      const subSpec = spec === true ? {} : (spec as { include?: IncludeShape; orderBy?: OrderBy; select?: SelectShape })

      const localValues = rows.map((r) => r[rel.localKey]).filter((v) => v !== null && v !== undefined)
      const uniqueValues = Array.from(new Set(localValues))
      const childRows =
        uniqueValues.length === 0
          ? []
          : await targetRepo.findMany({
              where: { [rel.foreignKey]: { in: uniqueValues } },
              orderBy: subSpec.orderBy,
              include: subSpec.include,
              select: subSpec.select
            })

      if (rel.type === 'many') {
        const grouped = new Map<unknown, Row[]>()
        for (const child of childRows) {
          const k = child[rel.foreignKey]
          if (!grouped.has(k)) grouped.set(k, [])
          grouped.get(k)!.push(child)
        }
        for (const row of rows) {
          row[key] = grouped.get(row[rel.localKey]) ?? []
        }
      } else {
        const indexed = new Map<unknown, Row>()
        for (const child of childRows) indexed.set(child[rel.foreignKey], child)
        for (const row of rows) {
          row[key] = indexed.get(row[rel.localKey]) ?? null
        }
      }
    }
  }
}

function projectSelect(row: Row, sel: SelectShape): Row {
  const out: Row = {}
  for (const k of Object.keys(sel)) {
    if (sel[k]) out[k] = row[k]
  }
  return out
}

/**
 * Crea el facade con todos los repos. La forma del objeto retornado es
 * compatible con la subset de DbClient que usa el codigo:
 *
 *   db.profile.findMany({...}), db.playlist.create({...}), etc.
 */
export function createFacade(db: Database.Database): Record<string, Repository> {
  const repos: Record<string, Repository> = {}
  const resolve = (name: string): Repository => {
    const r = repos[name]
    if (!r) throw new Error(`[db] unknown model: ${name}`)
    return r
  }
  for (const [name, model] of Object.entries(MODELS)) {
    repos[name] = new Repository(db, model, resolve)
  }
  return repos
}
