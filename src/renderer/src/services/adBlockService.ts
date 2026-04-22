export const adBlockService = {
  list: (profileId: string) => window.electronAPI.adBlocks.list(profileId),
  create: (name: string, profileId: string) =>
    window.electronAPI.adBlocks.create({ name, profileId }),
  update: (id: string, data: { name?: string; enabled?: boolean }) =>
    window.electronAPI.adBlocks.update(id, data),
  remove: (id: string) => window.electronAPI.adBlocks.remove(id),
  getWithItems: (id: string) => window.electronAPI.adBlocks.getWithItems(id),
  addItem: (adBlockId: string, audioAssetId: string, position: number) =>
    window.electronAPI.adBlocks.addItem(adBlockId, audioAssetId, position),
  removeItem: (itemId: string) => window.electronAPI.adBlocks.removeItem(itemId),
  trigger: (id: string) => window.electronAPI.adBlocks.trigger(id),
  // Ad Rules
  listRules: (profileId: string) => window.electronAPI.adRules.list(profileId),
  createRule: (data: {
    profileId: string
    adBlockId: string
    triggerType: string
    triggerConfig: string
    priority: number
  }) => window.electronAPI.adRules.create(data as never),
  updateRule: (id: string, data: { triggerConfig?: string; priority?: number; enabled?: boolean }) =>
    window.electronAPI.adRules.update(id, data),
  removeRule: (id: string) => window.electronAPI.adRules.remove(id)
}
