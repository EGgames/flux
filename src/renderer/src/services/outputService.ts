export const outputService = {
  list: (profileId: string) => window.electronAPI.outputs.list(profileId),
  save: (data: {
    profileId: string
    outputType: string
    config: string
    enabled?: boolean
  }) => window.electronAPI.outputs.save(data as never),
  remove: (id: string) => window.electronAPI.outputs.remove(id),
  test: (id: string) => window.electronAPI.outputs.test(id),
  toggleEnabled: (id: string, enabled: boolean) =>
    window.electronAPI.outputs.toggleEnabled(id, enabled)
}
