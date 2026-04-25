import { useState, useEffect, useCallback } from 'react'
import type { RadioProgram } from '../types/ipc.types'
import { programService } from '../services/programService'

export function usePrograms(profileId: string | null) {
  const [programs, setPrograms] = useState<RadioProgram[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    const data = await programService.list(profileId)
    setPrograms(data)
    setLoading(false)
  }, [profileId])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (data: {
    name: string
    dayOfWeek: number
    startTime: string
    endTime: string
    playlistId?: string
    priority?: number
  }) => {
    if (!profileId) return
    const program = await programService.create({ ...data, profileId })
    setPrograms((prev) => [...prev, program])
    return program
  }, [profileId])

  const update = useCallback(async (id: string, data: Partial<RadioProgram>) => {
    const updated = await programService.update(id, data)
    setPrograms((prev) => prev.map((p) => (p.id === id ? updated : p)))
    return updated
  }, [])

  const remove = useCallback(async (id: string) => {
    await programService.remove(id)
    setPrograms((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return { programs, loading, create, update, remove, reload: load }
}
