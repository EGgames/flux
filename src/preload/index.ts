import { contextBridge, ipcRenderer } from 'electron'

// Expose typed IPC API to renderer via contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  // ── Profiles ──────────────────────────────────────────────
  profiles: {
    list: () => ipcRenderer.invoke('profile:list'),
    create: (data: { name: string }) => ipcRenderer.invoke('profile:create', data),
    update: (id: string, data: { name?: string; isDefault?: boolean; preferences?: string }) =>
      ipcRenderer.invoke('profile:update', id, data),
    remove: (id: string) => ipcRenderer.invoke('profile:delete', id),
    select: (id: string) => ipcRenderer.invoke('profile:select', id)
  },

  // ── Audio Assets ───────────────────────────────────────────
  audioAssets: {
    list: () => ipcRenderer.invoke('audio-asset:list'),
    import: (filePath: string) => ipcRenderer.invoke('audio-asset:import', filePath),
    importBatch: (filePaths: string[]) => ipcRenderer.invoke('audio-asset:import-batch', filePaths),
    remove: (id: string) => ipcRenderer.invoke('audio-asset:delete', id),
    pickFiles: () => ipcRenderer.invoke('audio-asset:pick-files')
  },

  // ── Playlists ──────────────────────────────────────────────
  playlists: {
    list: (profileId: string) => ipcRenderer.invoke('playlist:list', profileId),
    create: (data: { name: string; profileId: string }) => ipcRenderer.invoke('playlist:create', data),
    update: (id: string, data: { name?: string; enabled?: boolean }) =>
      ipcRenderer.invoke('playlist:update', id, data),
    remove: (id: string) => ipcRenderer.invoke('playlist:delete', id),
    addItem: (playlistId: string, audioAssetId: string, position: number) =>
      ipcRenderer.invoke('playlist:add-item', playlistId, audioAssetId, position),
    removeItem: (itemId: string) => ipcRenderer.invoke('playlist:remove-item', itemId),
    reorder: (playlistId: string, itemIds: string[]) =>
      ipcRenderer.invoke('playlist:reorder', playlistId, itemIds),
    getWithItems: (id: string) => ipcRenderer.invoke('playlist:get-with-items', id)
  },

  // ── Ad Blocks ──────────────────────────────────────────────
  adBlocks: {
    list: (profileId: string) => ipcRenderer.invoke('ad-block:list', profileId),
    create: (data: { name: string; profileId: string }) => ipcRenderer.invoke('ad-block:create', data),
    update: (id: string, data: { name?: string; enabled?: boolean }) =>
      ipcRenderer.invoke('ad-block:update', id, data),
    remove: (id: string) => ipcRenderer.invoke('ad-block:delete', id),
    addItem: (adBlockId: string, audioAssetId: string, position: number) =>
      ipcRenderer.invoke('ad-block:add-item', adBlockId, audioAssetId, position),
    removeItem: (itemId: string) => ipcRenderer.invoke('ad-block:remove-item', itemId),
    getWithItems: (id: string) => ipcRenderer.invoke('ad-block:get-with-items', id),
    trigger: (id: string) => ipcRenderer.invoke('ad-block:trigger', id)
  },

  // ── Ad Rules ───────────────────────────────────────────────
  adRules: {
    list: (profileId: string) => ipcRenderer.invoke('ad-rule:list', profileId),
    create: (data: {
      profileId: string
      adBlockId: string
      triggerType: string
      triggerConfig: string
      priority: number
    }) => ipcRenderer.invoke('ad-rule:create', data),
    update: (id: string, data: { triggerConfig?: string; priority?: number; enabled?: boolean }) =>
      ipcRenderer.invoke('ad-rule:update', id, data),
    remove: (id: string) => ipcRenderer.invoke('ad-rule:delete', id)
  },

  // ── Soundboard ─────────────────────────────────────────────
  soundboard: {
    get: (profileId: string) => ipcRenderer.invoke('soundboard:get', profileId),
    assign: (profileId: string, slotIndex: number, data: {
      audioAssetId?: string | null
      label?: string
      mode?: string
      color?: string
    }) => ipcRenderer.invoke('soundboard:assign', profileId, slotIndex, data),
    trigger: (profileId: string, slotIndex: number) =>
      ipcRenderer.invoke('soundboard:trigger', profileId, slotIndex)
  },

  // ── Programs ───────────────────────────────────────────────
  programs: {
    list: (profileId: string) => ipcRenderer.invoke('program:list', profileId),
    create: (data: {
      profileId: string
      name: string
      dayOfWeek: number
      startTime: string
      endTime: string
      playlistId?: string
      priority?: number
    }) => ipcRenderer.invoke('program:create', data),
    update: (id: string, data: {
      name?: string
      dayOfWeek?: number
      startTime?: string
      endTime?: string
      playlistId?: string | null
      priority?: number
      enabled?: boolean
    }) => ipcRenderer.invoke('program:update', id, data),
    remove: (id: string) => ipcRenderer.invoke('program:delete', id)
  },

  // ── Output Integrations ────────────────────────────────────
  outputs: {
    list: (profileId: string) => ipcRenderer.invoke('output:list', profileId),
    save: (data: {
      profileId: string
      outputType: string
      config: string
      enabled?: boolean
    }) => ipcRenderer.invoke('output:save', data),
    remove: (id: string) => ipcRenderer.invoke('output:delete', id),
    test: (id: string) => ipcRenderer.invoke('output:test', id),
    toggleEnabled: (id: string, enabled: boolean) =>
      ipcRenderer.invoke('output:toggle', id, enabled)
  },

  // ── Playout ────────────────────────────────────────────────
  playout: {
    start: (profileId: string, playlistId?: string) =>
      ipcRenderer.invoke('playout:start', profileId, playlistId),
    syncProgram: (profileId: string, playlistId?: string | null) =>
      ipcRenderer.invoke('playout:sync-program', profileId, playlistId),
    stop: () => ipcRenderer.invoke('playout:stop'),
    pause: () => ipcRenderer.invoke('playout:pause'),
    resume: () => ipcRenderer.invoke('playout:resume'),
    next: () => ipcRenderer.invoke('playout:next'),
    getStatus: () => ipcRenderer.invoke('playout:status'),
    triggerAdBlock: (adBlockId: string) => ipcRenderer.invoke('playout:trigger-ad', adBlockId),
    streamChunk: (chunk: ArrayBuffer) => ipcRenderer.invoke('playout:stream-chunk', chunk)
  },

  // ── Events from Main to Renderer ───────────────────────────
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = [
      'playout:track-changed',
      'playout:state-changed',
      'playout:ad-start',
      'playout:ad-end',
      'playout:error',
      'scheduler:program-changed',
      'streaming:status-changed'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback as never)
  }
})
