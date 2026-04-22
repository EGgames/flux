export const playoutService = {
  start: (profileId: string, playlistId?: string) =>
    window.electronAPI.playout.start(profileId, playlistId),
  syncProgram: (profileId: string, playlistId?: string | null) =>
    window.electronAPI.playout.syncProgram(profileId, playlistId),
  stop: () => window.electronAPI.playout.stop(),
  pause: () => window.electronAPI.playout.pause(),
  resume: () => window.electronAPI.playout.resume(),
  next: () => window.electronAPI.playout.next(),
  getStatus: () => window.electronAPI.playout.getStatus(),
  triggerAdBlock: (adBlockId: string) => window.electronAPI.playout.triggerAdBlock(adBlockId),
  streamChunk: (chunk: ArrayBuffer) => window.electronAPI.playout.streamChunk(chunk)
}
