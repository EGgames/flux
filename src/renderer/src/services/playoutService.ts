export const playoutService = {
  start: (profileId: string, playlistId?: string, startIndex?: number) =>
    window.electronAPI.playout.start(profileId, playlistId, startIndex),
  syncProgram: (profileId: string, playlistId?: string | null) =>
    window.electronAPI.playout.syncProgram(profileId, playlistId),
  stop: () => window.electronAPI.playout.stop(),
  pause: () => window.electronAPI.playout.pause(),
  resume: () => window.electronAPI.playout.resume(),
  prev: () => window.electronAPI.playout.prev(),
  next: () => window.electronAPI.playout.next(),
  jumpTo: (index: number) => window.electronAPI.playout.jumpTo(index),
  getStatus: () => window.electronAPI.playout.getStatus(),
  triggerAdBlock: (adBlockId: string) => window.electronAPI.playout.triggerAdBlock(adBlockId),
  stopAd: () => window.electronAPI.playout.stopAd(),
  streamChunk: (chunk: ArrayBuffer) => window.electronAPI.playout.streamChunk(chunk)
}
