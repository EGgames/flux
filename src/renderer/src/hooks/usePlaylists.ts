import { useState, useEffect, useCallback } from 'react'
import type { Playlist } from '../types/ipc.types'
import { playlistService } from '../services/playlistService'

export function usePlaylists(profileId: string | null) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    const data = await playlistService.list(profileId)
    setPlaylists(data)
    setLoading(false)
  }, [profileId])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (name: string) => {
    if (!profileId) return
    const pl = await playlistService.create(name, profileId)
    setPlaylists((prev) => [...prev, pl])
    return pl
  }, [profileId])

  const remove = useCallback(async (id: string) => {
    await playlistService.remove(id)
    setPlaylists((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return { playlists, loading, create, remove, reload: load }
}
