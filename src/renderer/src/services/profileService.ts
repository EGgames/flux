export const profileService = {
  list: () => window.electronAPI.profiles.list(),
  create: (name: string) => window.electronAPI.profiles.create({ name }),
  update: (id: string, data: { name?: string; isDefault?: boolean; preferences?: string }) =>
    window.electronAPI.profiles.update(id, data),
  remove: (id: string) => window.electronAPI.profiles.remove(id),
  select: (id: string) => window.electronAPI.profiles.select(id)
}
