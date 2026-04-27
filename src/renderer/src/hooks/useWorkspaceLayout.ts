import { useCallback, useEffect, useRef, useState } from 'react'
import type { Profile } from '../types/ipc.types'
import type { PanelRect } from '../components/PanelWorkspace/PanelWorkspace'
import { profileService } from '../services/profileService'

type LayoutMap = Record<string, PanelRect>

interface WorkspacePreferences {
  workspaceLayouts?: Record<string, Record<string, LayoutMap>>
  workspaceHeights?: Record<string, Record<string, number>>
  workspaceHiddenPanels?: Record<string, Record<string, string[]>>
}

function parsePreferences(raw: string | undefined): WorkspacePreferences {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed as WorkspacePreferences : {}
  } catch {
    return {}
  }
}

export function useWorkspaceLayout(
  profile: Profile | null,
  workspaceKey: string,
  contextKey: string
) {
  const [layout, setLayout] = useState<LayoutMap>({})
  const [workspaceHeight, setWorkspaceHeight] = useState<number>(540)
  const [hiddenPanelIds, setHiddenPanelIds] = useState<string[]>([])
  const preferencesRef = useRef<WorkspacePreferences>({})

  useEffect(() => {
    const parsed = parsePreferences(profile?.preferences)
    preferencesRef.current = parsed
    setLayout(parsed.workspaceLayouts?.[workspaceKey]?.[contextKey] ?? {})
    setWorkspaceHeight(parsed.workspaceHeights?.[workspaceKey]?.[contextKey] ?? 540)
    setHiddenPanelIds(parsed.workspaceHiddenPanels?.[workspaceKey]?.[contextKey] ?? [])
  }, [profile?.id, profile?.preferences, workspaceKey, contextKey])

  const saveLayout = useCallback(
    async (nextLayout: LayoutMap) => {
      setLayout(nextLayout)
      if (!profile) return

      const nextPreferences: WorkspacePreferences = {
        ...preferencesRef.current,
        workspaceLayouts: {
          ...(preferencesRef.current.workspaceLayouts ?? {}),
          [workspaceKey]: {
            ...(preferencesRef.current.workspaceLayouts?.[workspaceKey] ?? {}),
            [contextKey]: nextLayout
          }
        }
      }

      preferencesRef.current = nextPreferences
      await profileService.update(profile.id, { preferences: JSON.stringify(nextPreferences) })
    },
    [profile, workspaceKey, contextKey]
  )

  const saveWorkspaceHeight = useCallback(
    async (nextHeight: number) => {
      setWorkspaceHeight(nextHeight)
      if (!profile) return

      const nextPreferences: WorkspacePreferences = {
        ...preferencesRef.current,
        workspaceHeights: {
          ...(preferencesRef.current.workspaceHeights ?? {}),
          [workspaceKey]: {
            ...(preferencesRef.current.workspaceHeights?.[workspaceKey] ?? {}),
            [contextKey]: nextHeight
          }
        }
      }

      preferencesRef.current = nextPreferences
      await profileService.update(profile.id, { preferences: JSON.stringify(nextPreferences) })
    },
    [profile, workspaceKey, contextKey]
  )

  const saveHiddenPanelIds = useCallback(
    async (nextHidden: string[]) => {
      setHiddenPanelIds(nextHidden)
      if (!profile) return

      const nextPreferences: WorkspacePreferences = {
        ...preferencesRef.current,
        workspaceHiddenPanels: {
          ...(preferencesRef.current.workspaceHiddenPanels ?? {}),
          [workspaceKey]: {
            ...(preferencesRef.current.workspaceHiddenPanels?.[workspaceKey] ?? {}),
            [contextKey]: nextHidden
          }
        }
      }

      preferencesRef.current = nextPreferences
      await profileService.update(profile.id, { preferences: JSON.stringify(nextPreferences) })
    },
    [profile, workspaceKey, contextKey]
  )

  return { layout, saveLayout, workspaceHeight, saveWorkspaceHeight, hiddenPanelIds, saveHiddenPanelIds }
}
