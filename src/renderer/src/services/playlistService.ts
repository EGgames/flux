export const playlistService = {
  list: (profileId: string) => window.electronAPI.playlists.list(profileId),
  create: (name: string, profileId: string) =>
    window.electronAPI.playlists.create({ name, profileId }),
  update: (id: string, data: { name?: string; enabled?: boolean }) =>
    window.electronAPI.playlists.update(id, data),
  remove: (id: string) => window.electronAPI.playlists.remove(id),
  getWithItems: (id: string) => window.electronAPI.playlists.getWithItems(id),
  addItem: (playlistId: string, audioAssetId: string, position: number) =>
    window.electronAPI.playlists.addItem(playlistId, audioAssetId, position),
  removeItem: (itemId: string) => window.electronAPI.playlists.removeItem(itemId),
  reorder: (playlistId: string, itemIds: string[]) =>
    window.electronAPI.playlists.reorder(playlistId, itemIds)
}
