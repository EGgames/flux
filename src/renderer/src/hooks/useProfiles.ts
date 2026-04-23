import { useState, useEffect, useCallback } from 'react'
import type { Profile } from '../types/ipc.types'
import { profileService } from '../services/profileService'

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await profileService.list()
      setProfiles(data)
      setActiveProfile(data.find((p) => p.isDefault) ?? data[0] ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar perfiles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (name: string) => {
    const profile = await profileService.create(name)
    setProfiles((prev) => [...prev, profile])
    return profile
  }, [])

  const select = useCallback(async (id: string) => {
    const updated = await profileService.select(id)
    setProfiles((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })))
    setActiveProfile(updated)
    return updated
  }, [])

  const remove = useCallback(async (id: string) => {
    await profileService.remove(id)
    setProfiles((prev) => prev.filter((p) => p.id !== id))
    if (activeProfile?.id === id) {
      setActiveProfile(null)
    }
  }, [activeProfile])

  const update = useCallback(async (id: string, data: { name?: string; preferences?: string }) => {
    const updated = await profileService.update(id, data)
    setProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)))
    if (activeProfile?.id === id) setActiveProfile(updated)
    return updated
  }, [activeProfile])

  return { profiles, activeProfile, loading, error, create, select, remove, update, reload: load }
}
