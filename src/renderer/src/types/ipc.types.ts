// Shared type definitions for IPC communication between Renderer and Main

export interface Profile {
  id: string
  name: string
  isDefault: boolean
  preferences: string
  createdAt: string
  updatedAt: string
}

export interface AudioAsset {
  id: string
  name: string
  sourceType: 'local' | 'stream'
  sourcePath: string
  durationMs: number | null
  tags: string
  createdAt: string
  updatedAt: string
}

export interface PlaylistItem {
  id: string
  playlistId: string
  audioAssetId: string
  position: number
  audioAsset: AudioAsset
}

export interface Playlist {
  id: string
  name: string
  profileId: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  _count?: { items: number }
  items?: PlaylistItem[]
}

export interface AdBlockItem {
  id: string
  adBlockId: string
  audioAssetId: string
  position: number
  audioAsset: AudioAsset
}

export interface AdBlock {
  id: string
  name: string
  profileId: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  _count?: { items: number }
  items?: AdBlockItem[]
  rules?: AdRule[]
}

export interface AdRule {
  id: string
  profileId: string
  adBlockId: string
  triggerType: 'time' | 'song_count' | 'manual'
  triggerConfig: string
  priority: number
  enabled: boolean
  adBlock?: AdBlock
}

export interface SoundboardButton {
  id: string | null
  profileId: string
  slotIndex: number
  label: string | null
  audioAssetId: string | null
  audioAsset: AudioAsset | null
  mode: 'oneshot' | 'toggle' | 'loop'
  color: string
}

export interface RadioProgram {
  id: string
  profileId: string
  name: string
  dayOfWeek: number
  startTime: string
  endTime: string
  playlistId: string | null
  priority: number
  enabled: boolean
  playlist?: Playlist | null
}

export interface OutputIntegration {
  id: string
  profileId: string
  outputType: 'local' | 'icecast' | 'shoutcast' | 'monitor'
  config: string
  enabled: boolean
}

export interface PlayoutStatus {
  state: 'stopped' | 'playing' | 'paused' | 'ad_break'
  profileId: string | null
  track: AudioAsset | null
  queueIndex: number
  queueLength: number
  songsSinceLastAd: number
}

// electronAPI shape exposed via contextBridge
export interface ElectronAPI {
  profiles: {
    list: () => Promise<Profile[]>
    create: (data: { name: string }) => Promise<Profile>
    update: (id: string, data: Partial<Profile>) => Promise<Profile>
    remove: (id: string) => Promise<{ success: boolean }>
    select: (id: string) => Promise<Profile>
  }
  audioAssets: {
    list: () => Promise<AudioAsset[]>
    import: (filePath: string) => Promise<AudioAsset>
    importBatch: (filePaths: string[]) => Promise<AudioAsset[]>
    remove: (id: string) => Promise<{ success: boolean }>
    pickFiles: () => Promise<string[]>
  }
  playlists: {
    list: (profileId: string) => Promise<Playlist[]>
    create: (data: { name: string; profileId: string }) => Promise<Playlist>
    update: (id: string, data: Partial<Playlist>) => Promise<Playlist>
    remove: (id: string) => Promise<{ success: boolean }>
    addItem: (playlistId: string, audioAssetId: string, position: number) => Promise<PlaylistItem>
    removeItem: (itemId: string) => Promise<{ success: boolean }>
    reorder: (playlistId: string, itemIds: string[]) => Promise<{ success: boolean }>
    getWithItems: (id: string) => Promise<Playlist>
  }
  adBlocks: {
    list: (profileId: string) => Promise<AdBlock[]>
    create: (data: { name: string; profileId: string }) => Promise<AdBlock>
    update: (id: string, data: Partial<AdBlock>) => Promise<AdBlock>
    remove: (id: string) => Promise<{ success: boolean }>
    addItem: (adBlockId: string, audioAssetId: string, position: number) => Promise<AdBlockItem>
    removeItem: (itemId: string) => Promise<{ success: boolean }>
    getWithItems: (id: string) => Promise<AdBlock>
    trigger: (id: string) => Promise<AdBlock>
  }
  adRules: {
    list: (profileId: string) => Promise<AdRule[]>
    create: (data: Omit<AdRule, 'id' | 'adBlock'>) => Promise<AdRule>
    update: (id: string, data: Partial<AdRule>) => Promise<AdRule>
    remove: (id: string) => Promise<{ success: boolean }>
  }
  soundboard: {
    get: (profileId: string) => Promise<SoundboardButton[]>
    assign: (profileId: string, slotIndex: number, data: Partial<SoundboardButton>) => Promise<SoundboardButton>
    trigger: (profileId: string, slotIndex: number) => Promise<{ slotIndex: number; mode: string; audioAsset: AudioAsset }>
  }
  programs: {
    list: (profileId: string) => Promise<RadioProgram[]>
    create: (data: Omit<RadioProgram, 'id' | 'playlist'>) => Promise<RadioProgram>
    update: (id: string, data: Partial<RadioProgram>) => Promise<RadioProgram>
    remove: (id: string) => Promise<{ success: boolean }>
  }
  outputs: {
    list: (profileId: string) => Promise<OutputIntegration[]>
    save: (data: Omit<OutputIntegration, 'id'>) => Promise<OutputIntegration>
    remove: (id: string) => Promise<{ success: boolean }>
    test: (id: string) => Promise<{ success: boolean; message: string }>
    toggleEnabled: (id: string, enabled: boolean) => Promise<OutputIntegration>
  }
  playout: {
    start: (profileId: string, playlistId?: string, startIndex?: number) => Promise<PlayoutStatus>
    syncProgram: (profileId: string, playlistId?: string | null) => Promise<PlayoutStatus>
    stop: () => Promise<{ success: boolean }>
    pause: () => Promise<{ success: boolean }>
    resume: () => Promise<{ success: boolean }>
    next: () => Promise<{ success: boolean }>
    jumpTo: (index: number) => Promise<{ success: boolean }>
    getStatus: () => Promise<PlayoutStatus>
    triggerAdBlock: (adBlockId: string) => Promise<{ success: boolean }>
    streamChunk: (chunk: ArrayBuffer) => Promise<void>
  }
  on: (channel: string, callback: (...args: unknown[]) => void) => void
  off: (channel: string, callback: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
