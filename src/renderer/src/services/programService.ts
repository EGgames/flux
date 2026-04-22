export const programService = {
  list: (profileId: string) => window.electronAPI.programs.list(profileId),
  create: (data: {
    profileId: string
    name: string
    dayOfWeek: number
    startTime: string
    endTime: string
    playlistId?: string
    priority?: number
  }) => window.electronAPI.programs.create(data as never),
  update: (
    id: string,
    data: {
      name?: string
      dayOfWeek?: number
      startTime?: string
      endTime?: string
      playlistId?: string | null
      priority?: number
      enabled?: boolean
    }
  ) => window.electronAPI.programs.update(id, data),
  remove: (id: string) => window.electronAPI.programs.remove(id)
}
