/**
 * Tipo del cliente DB usado por IPC handlers y servicios.
 *
 * Antes era `DbClient`. Tras migrar a better-sqlite3 + facade, exponemos
 * el mismo subset estructural: `db.<modelo>.<metodo>(...)`. Los repos
 * implementan exactamente lo que el codigo usa.
 *
 * Mantenemos type-laxness intencional (`Promise<any>`) para no introducir
 * fricciones gigantes en cada handler — el TYPE narrowing real ocurre via
 * Zod en los handlers que validan input.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DbDelegate {
  findMany(args?: any): Promise<any>
  findUnique(args: any): Promise<any>
  findFirst(args?: any): Promise<any>
  create(args: any): Promise<any>
  update(args: any): Promise<any>
  updateMany(args: any): Promise<any>
  delete(args: any): Promise<any>
  deleteMany(args?: any): Promise<any>
  upsert(args: any): Promise<any>
  count?(args?: any): Promise<number>
}

export interface DbClient {
  profile: DbDelegate
  playlist: DbDelegate
  playlistItem: DbDelegate
  audioAsset: DbDelegate
  adBlock: DbDelegate
  adBlockItem: DbDelegate
  adRule: DbDelegate
  radioProgram: DbDelegate
  soundboardButton: DbDelegate
  outputIntegration: DbDelegate
  playoutEvent: DbDelegate
  audioEffectsConfig: DbDelegate
}
