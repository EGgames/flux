import { useState, useEffect, useCallback } from 'react'
import type { AdBlock, AdRule } from '../types/ipc.types'
import { adBlockService } from '../services/adBlockService'

export function useAdBlocks(profileId: string | null) {
  const [adBlocks, setAdBlocks] = useState<AdBlock[]>([])
  const [adRules, setAdRules] = useState<AdRule[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    const [blocks, rules] = await Promise.all([
      adBlockService.list(profileId),
      adBlockService.listRules(profileId)
    ])
    setAdBlocks(blocks)
    setAdRules(rules)
    setLoading(false)
  }, [profileId])

  useEffect(() => { load() }, [load])

  const createBlock = useCallback(async (name: string) => {
    if (!profileId) return
    const block = await adBlockService.create(name, profileId)
    setAdBlocks((prev) => [...prev, block])
    return block
  }, [profileId])

  const removeBlock = useCallback(async (id: string) => {
    await adBlockService.remove(id)
    setAdBlocks((prev) => prev.filter((b) => b.id !== id))
  }, [])

  const createRule = useCallback(async (data: {
    adBlockId: string
    triggerType: string
    triggerConfig: string
    priority: number
  }) => {
    if (!profileId) return
    const rule = await adBlockService.createRule({ ...data, profileId })
    setAdRules((prev) => [...prev, rule])
    return rule
  }, [profileId])

  const removeRule = useCallback(async (id: string) => {
    await adBlockService.removeRule(id)
    setAdRules((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return { adBlocks, adRules, loading, createBlock, removeBlock, createRule, removeRule, reload: load }
}
