/**
 * Definicion de modelos para el facade SQLite (compatible con Prisma).
 *
 * Cada `ModelDef` describe una tabla SQLite real:
 * - `table`: nombre exacto en la DB (case-sensitive en SQLite cuando se cita).
 * - `columns`: nombres de columnas, en orden de declaracion.
 * - `pk`: nombre de la PK (siempre 'id' en este proyecto).
 * - `defaults.id`: si true, el repositorio genera un cuid en `create` cuando
 *   `data.id` no viene (replica `@default(cuid())` de Prisma).
 * - `timestamps`: gestiona `createdAt`/`updatedAt` automaticamente.
 * - `booleans`: columnas a serializar como 0/1 (SQLite no tiene BOOLEAN).
 * - `relations`: descripcion de relaciones para `include` (subset Prisma).
 *
 * Estos modelos REPLICAN el schema definido en
 * `prisma/migrations/20260422150043_init/migration.sql` (single source of truth
 * para SQL DDL aplicado en runtime via ensureSchema).
 */

export interface RelationDef {
  /** Tipo de relacion: many = lista, one = objeto unico. */
  type: 'many' | 'one'
  /** Modelo destino (key en MODELS). */
  target: string
  /** Columna en la tabla LOCAL que matchea con el target. */
  localKey: string
  /** Columna en la tabla TARGET que matchea con local. */
  foreignKey: string
}

export interface ModelDef {
  table: string
  columns: string[]
  pk: string
  defaults: { id: boolean }
  timestamps: { createdAt: boolean; updatedAt: boolean }
  booleans: string[]
  relations: Record<string, RelationDef>
}

export const MODELS: Record<string, ModelDef> = {
  profile: {
    table: 'Profile',
    columns: ['id', 'name', 'isDefault', 'preferences', 'createdAt', 'updatedAt'],
    pk: 'id',
    defaults: { id: true },
    timestamps: { createdAt: true, updatedAt: true },
    booleans: ['isDefault'],
    relations: {
      playlists: { type: 'many', target: 'playlist', localKey: 'id', foreignKey: 'profileId' },
      adBlocks: { type: 'many', target: 'adBlock', localKey: 'id', foreignKey: 'profileId' },
      adRules: { type: 'many', target: 'adRule', localKey: 'id', foreignKey: 'profileId' },
      soundboardButtons: {
        type: 'many',
        target: 'soundboardButton',
        localKey: 'id',
        foreignKey: 'profileId'
      },
      programs: { type: 'many', target: 'radioProgram', localKey: 'id', foreignKey: 'profileId' },
      outputs: {
        type: 'many',
        target: 'outputIntegration',
        localKey: 'id',
        foreignKey: 'profileId'
      },
      audioEffects: {
        type: 'one',
        target: 'audioEffectsConfig',
        localKey: 'id',
        foreignKey: 'profileId'
      }
    }
  },
  audioAsset: {
    table: 'AudioAsset',
    columns: [
      'id',
      'name',
      'sourceType',
      'sourcePath',
      'durationMs',
      'tags',
      'fadeInMs',
      'fadeOutMs',
      'createdAt',
      'updatedAt'
    ],
    pk: 'id',
    defaults: { id: true },
    timestamps: { createdAt: true, updatedAt: true },
    booleans: [],
    relations: {}
  },
  playlist: {
    table: 'Playlist',
    columns: ['id', 'name', 'profileId', 'enabled', 'createdAt', 'updatedAt'],
    pk: 'id',
    defaults: { id: true },
    timestamps: { createdAt: true, updatedAt: true },
    booleans: ['enabled'],
    relations: {
      items: { type: 'many', target: 'playlistItem', localKey: 'id', foreignKey: 'playlistId' },
      profile: { type: 'one', target: 'profile', localKey: 'profileId', foreignKey: 'id' }
    }
  },
  playlistItem: {
    table: 'PlaylistItem',
    columns: ['id', 'playlistId', 'audioAssetId', 'position'],
    pk: 'id',
    defaults: { id: true },
    timestamps: { createdAt: false, updatedAt: false },
    booleans: [],
    relations: {
      playlist: { type: 'one', target: 'playlist', localKey: 'playlistId', foreignKey: 'id' },
      audioAsset: {
        type: 'one',
        target: 'audioAsset',
        localKey: 'audioAssetId',
        foreignKey: 'id'
      }
    }
  },
  adBlock: {
    table: 'AdBlock',
    columns: ['id', 'name', 'profileId', 'enabled', 'createdAt', 'updatedAt'],
    pk: 'id',
    defaults: { id: true },
    timestamps: { createdAt: true, updatedAt: true },
    booleans: ['enabled'],
    relations: {
      items: { type: 'many', target: 'adBlockItem', localKey: 'id', foreignKey: 'adBlockId' }
    }
  },
  adBlockItem: {
    table: 'AdBlockItem',
    columns: ['id', 'adBlockId', 'audioAssetId', 'position'],
    pk: 'id',
    defaults: { id: true },
    timestamps: { createdAt: false, updatedAt: false },
    booleans: [],
    relations: {
      audioAsset: {
        type: 'one',
        target: 'audioAsset',
        localKey: 'audioAssetId',
        foreignKey: 'id'
      }
    }
  },
  adRule: {
    table: 'AdRule',
    columns: [
      'id',
      'profileId',
      'adBlockId',
      'triggerType',
      'triggerConfig',
      'priority',
      'enabled',
      'createdAt',
      'updatedAt'
    ],
    pk: 'id',
    defaults: { id: true },
    timestamps: { createdAt: true, updatedAt: true },
    booleans: ['enabled'],
    relations: {
      adBlock: { type: 'one', target: 'adBlock', localKey: 'adBlockId', foreignKey: 'id' }
    }
  },
  soundboardButton: {
    table: 'SoundboardButton',
    columns: ['id', 'profileId', 'slotIndex', 'label', 'audioAssetId', 'mode', 'color'],
    pk: 'id',
    defaults: { id: true },
    timestamps: { createdAt: false, updatedAt: false },
    booleans: [],
    relations: {
      audioAsset: {
        type: 'one',
        target: 'audioAsset',
        localKey: 'audioAssetId',
        foreignKey: 'id'
      }
    }
  },
  radioProgram: {
    table: 'RadioProgram',
    columns: [
      'id',
      'profileId',
      'name',
      'dayOfWeek',
      'startTime',
      'endTime',
      'playlistId',
      'priority',
      'enabled',
      'createdAt',
      'updatedAt'
    ],
    pk: 'id',
    defaults: { id: true },
    timestamps: { createdAt: true, updatedAt: true },
    booleans: ['enabled'],
    relations: {
      playlist: { type: 'one', target: 'playlist', localKey: 'playlistId', foreignKey: 'id' }
    }
  },
  outputIntegration: {
    table: 'OutputIntegration',
    columns: ['id', 'profileId', 'outputType', 'config', 'enabled', 'createdAt', 'updatedAt'],
    pk: 'id',
    defaults: { id: true },
    timestamps: { createdAt: true, updatedAt: true },
    booleans: ['enabled'],
    relations: {}
  },
  playoutEvent: {
    table: 'PlayoutEvent',
    columns: ['id', 'profileId', 'eventType', 'payload', 'status', 'createdAt'],
    pk: 'id',
    defaults: { id: true },
    timestamps: { createdAt: true, updatedAt: false },
    booleans: [],
    relations: {}
  },
  audioEffectsConfig: {
    table: 'AudioEffectsConfig',
    columns: [
      'id',
      'profileId',
      'crossfadeEnabled',
      'crossfadeMs',
      'crossfadeCurve',
      'createdAt',
      'updatedAt'
    ],
    pk: 'id',
    defaults: { id: true },
    timestamps: { createdAt: true, updatedAt: true },
    booleans: ['crossfadeEnabled'],
    relations: {}
  }
}
