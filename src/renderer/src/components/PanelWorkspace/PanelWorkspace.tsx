import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './PanelWorkspace.module.css'

export interface PanelRect {
  x: number
  y: number
  w: number
  h: number
}

export interface PanelConfig {
  id: string
  title: string
  minW?: number
  minH?: number
  defaultRect: PanelRect
  content: ReactNode
}

interface Props {
  panels: PanelConfig[]
  savedLayout?: Record<string, PanelRect>
  onLayoutChange?: (layout: Record<string, PanelRect>) => void
  workspaceHeight?: number
  minWorkspaceHeight?: number
  maxWorkspaceHeight?: number
  onWorkspaceHeightChange?: (height: number) => void
  savedHiddenPanelIds?: string[]
  onHiddenPanelsChange?: (hiddenPanelIds: string[]) => void
  className?: string
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
type DragMode = { kind: 'move' } | { kind: 'resize'; dir: ResizeDir }

const MOBILE_BREAKPOINT = 920
const WORKSPACE_BOTTOM_PADDING = 24

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function applyDefaults(
  panels: PanelConfig[],
  savedLayout: Record<string, PanelRect> | undefined
): Record<string, PanelRect> {
  return panels.reduce<Record<string, PanelRect>>((acc, panel) => {
    const saved = savedLayout?.[panel.id]
    acc[panel.id] = {
      x: saved?.x ?? panel.defaultRect.x,
      y: saved?.y ?? panel.defaultRect.y,
      w: saved?.w ?? panel.defaultRect.w,
      h: saved?.h ?? panel.defaultRect.h
    }
    return acc
  }, {})
}

export default function PanelWorkspace({
  panels,
  savedLayout,
  onLayoutChange,
  workspaceHeight = 540,
  minWorkspaceHeight = 360,
  maxWorkspaceHeight = 4000,
  onWorkspaceHeightChange,
  savedHiddenPanelIds,
  onHiddenPanelsChange,
  className
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rectsRef = useRef<Record<string, PanelRect>>({})
  const [rects, setRects] = useState<Record<string, PanelRect>>(() => applyDefaults(panels, savedLayout))
  const [order, setOrder] = useState<string[]>(() => panels.map((panel) => panel.id))
  const [isMobile, setIsMobile] = useState(false)
  const [hiddenPanelIds, setHiddenPanelIds] = useState<string[]>(() => savedHiddenPanelIds ?? [])
  const [showAddMenu, setShowAddMenu] = useState(false)

  // Sincronizar hiddenPanelIds desde props (ej: cambio de perfil/contexto).
  // Solo aplicar si el array externo difiere del estado actual para evitar loops.
  const savedHiddenKey = savedHiddenPanelIds ? savedHiddenPanelIds.join('|') : null
  useEffect(() => {
    if (savedHiddenPanelIds === undefined) return
    setHiddenPanelIds((prev) => {
      if (prev.length === savedHiddenPanelIds.length && prev.every((id, i) => id === savedHiddenPanelIds[i])) {
        return prev
      }
      return savedHiddenPanelIds
    })
    // savedHiddenKey colapsa el array a string para que el efecto dispare solo en cambios reales.
  }, [savedHiddenKey])

  const dragStateRef = useRef<{
    panelId: string
    mode: DragMode
    startX: number
    startY: number
    startRect: PanelRect
  } | null>(null)

  const panelStructureKey = useMemo(
    () =>
      JSON.stringify(
        panels.map((panel) => ({
          id: panel.id,
          minW: panel.minW,
          minH: panel.minH,
          defaultRect: panel.defaultRect
        }))
      ),
    [panels]
  )

  useEffect(() => {
    const nextRects = applyDefaults(panels, savedLayout)
    setRects(nextRects)
    rectsRef.current = nextRects
    setOrder((prev) => {
      const currentIds = panels.map((panel) => panel.id)
      const kept = prev.filter((id) => currentIds.includes(id))
      const missing = currentIds.filter((id) => !kept.includes(id))
      return [...kept, ...missing]
    })
  }, [panelStructureKey, savedLayout])

  useEffect(() => {
    rectsRef.current = rects
  }, [rects])

  useEffect(() => {
    function updateViewportMode() {
      const width = containerRef.current?.clientWidth ?? window.innerWidth
      setIsMobile(width < MOBILE_BREAKPOINT)
    }

    updateViewportMode()
    window.addEventListener('resize', updateViewportMode)
    return () => window.removeEventListener('resize', updateViewportMode)
  }, [])

  const panelLookup = useMemo(() => {
    return panels.reduce<Record<string, PanelConfig>>((acc, panel) => {
      acc[panel.id] = panel
      return acc
    }, {})
  }, [panels])

  const sortedPanels = useMemo(() => {
    return order
      .map((id) => panelLookup[id])
      .filter((panel): panel is PanelConfig => Boolean(panel) && !hiddenPanelIds.includes(panel.id))
  }, [order, panelLookup, hiddenPanelIds])

  const hiddenPanels = useMemo(
    () => panels.filter((p) => hiddenPanelIds.includes(p.id)),
    [panels, hiddenPanelIds]
  )

  const closePanel = (id: string) => setHiddenPanelIds((prev) => {
    if (prev.includes(id)) return prev
    const next = [...prev, id]
    onHiddenPanelsChange?.(next)
    return next
  })
  const reopenPanel = (id: string) => {
    setHiddenPanelIds((prev) => {
      const next = prev.filter((h) => h !== id)
      onHiddenPanelsChange?.(next)
      return next
    })
    setShowAddMenu(false)
  }

  const startInteraction = (event: React.MouseEvent, panelId: string, mode: DragMode) => {
    if (isMobile) return
    const panelRect = rectsRef.current[panelId]
    if (!panelRect) return

    event.preventDefault()
    event.stopPropagation()
    setOrder((prev) => [...prev.filter((id) => id !== panelId), panelId])

    dragStateRef.current = {
      panelId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startRect: panelRect
    }
  }

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      const drag = dragStateRef.current
      if (!drag || !containerRef.current) return

      const containerWidth = containerRef.current.clientWidth
      const deltaX = event.clientX - drag.startX
      const deltaY = event.clientY - drag.startY
      const panelConfig = panelLookup[drag.panelId]
      const minW = panelConfig?.minW ?? 260
      const minH = panelConfig?.minH ?? 170

      setRects((prev) => {
        const current = prev[drag.panelId] ?? drag.startRect
        let next: PanelRect

        if (drag.mode.kind === 'move') {
          const maxX = Math.max(containerWidth - current.w, 0)
          next = {
            ...current,
            x: clamp(drag.startRect.x + deltaX, 0, maxX),
            y: Math.max(drag.startRect.y + deltaY, 0)
          }
        } else {
          const dir = drag.mode.dir
          let { x, y, w, h } = drag.startRect
          if (dir.includes('e')) {
            const maxW = Math.max(containerWidth - x, minW)
            w = clamp(drag.startRect.w + deltaX, minW, maxW)
          }
          if (dir.includes('s')) {
            h = Math.max(drag.startRect.h + deltaY, minH)
          }
          if (dir.includes('w')) {
            const proposedX = clamp(drag.startRect.x + deltaX, 0, drag.startRect.x + drag.startRect.w - minW)
            w = drag.startRect.x + drag.startRect.w - proposedX
            x = proposedX
          }
          if (dir.includes('n')) {
            const proposedY = clamp(drag.startRect.y + deltaY, 0, drag.startRect.y + drag.startRect.h - minH)
            h = drag.startRect.y + drag.startRect.h - proposedY
            y = proposedY
          }
          next = { x, y, w, h }
        }

        const updated = { ...prev, [drag.panelId]: next }
        rectsRef.current = updated
        return updated
      })
    }

    function onMouseUp() {
      if (!dragStateRef.current) return
      dragStateRef.current = null
      onLayoutChange?.(rectsRef.current)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onLayoutChange, panelLookup])

  const handleAutoFit = () => {
    if (!containerRef.current) return

    const width = containerRef.current.clientWidth
    const columns = width > 1280 ? 3 : width > 980 ? 2 : 1
    const gap = 12
    const padding = 12
    const usableWidth = width - padding * 2
    const panelWidth = Math.floor((usableWidth - gap * (columns - 1)) / columns)

    // Layout en grilla por columnas, donde cada columna acumula la altura real
    // (minH) de cada panel. Asi el resultado es compacto y respeta los minimos.
    const columnBottoms = new Array<number>(columns).fill(padding)
    const next = sortedPanels.reduce<Record<string, PanelRect>>((acc, panel, index) => {
      const col = index % columns
      const minH = panel.minH ?? 220
      const h = Math.max(panel.defaultRect.h, minH)
      acc[panel.id] = {
        x: padding + col * (panelWidth + gap),
        y: columnBottoms[col],
        w: panelWidth,
        h
      }
      columnBottoms[col] += h + gap
      return acc
    }, {})

    setRects(next)
    rectsRef.current = next
    onLayoutChange?.(next)
  }

  const handleReset = () => {
    const next = applyDefaults(panels, undefined)
    setRects(next)
    rectsRef.current = next
    setHiddenPanelIds([])
    onHiddenPanelsChange?.([])
    onLayoutChange?.(next)
    // Tras restablecer corremos auto-fit para que el resultado quepa compacto.
    window.setTimeout(() => handleAutoFit(), 0)
  }

  // Altura del workspace = bottom mas bajo entre los paneles + padding, dentro
  // de los limites min/max. Asi crece o se achica automaticamente al estirar /
  // achicar paneles, sin necesidad de control manual.
  const computedHeight = useMemo(() => {
    const maxBottom = sortedPanels.reduce((max, panel) => {
      const rect = rects[panel.id] ?? panel.defaultRect
      return Math.max(max, rect.y + rect.h)
    }, 0)
    const base = Math.max(maxBottom + WORKSPACE_BOTTOM_PADDING, minWorkspaceHeight)
    return Math.min(base, maxWorkspaceHeight)
  }, [sortedPanels, rects, minWorkspaceHeight, maxWorkspaceHeight])

  // Notificar al hook de persistencia para que recuerde la altura final.
  useEffect(() => {
    if (isMobile) return
    if (computedHeight !== workspaceHeight) {
      onWorkspaceHeightChange?.(computedHeight)
    }
  }, [computedHeight, workspaceHeight, isMobile, onWorkspaceHeightChange])

  return (
    <div className={`${styles.workspaceWrap}${className ? ` ${className}` : ''}`}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarHint}>
          {isMobile
            ? 'Vista compacta activa: los paneles se apilan para pantallas chicas.'
            : 'Arrastra el encabezado para mover paneles y los bordes o esquinas para redimensionar.'}
        </span>
        <div className={styles.toolbarControls}>
          <button className={styles.toolbarBtn} onClick={handleAutoFit}>Auto-ajustar</button>
          <button className={styles.toolbarBtn} onClick={handleReset} title="Volver al layout por defecto">Restablecer</button>
          {hiddenPanels.length > 0 && (
            <div className={styles.addPanelWrap}>
              <button className={`${styles.toolbarBtn} ${styles.toolbarBtnAccent}`} onClick={() => setShowAddMenu((v) => !v)}>
                + Añadir panel
              </button>
              {showAddMenu && (
                <div className={styles.addPanelMenu}>
                  {hiddenPanels.map((p) => (
                    <button key={p.id} className={styles.addPanelItem} onClick={() => reopenPanel(p.id)}>
                      {p.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className={`${styles.workspace}${isMobile ? ` ${styles.mobile}` : ''}`}
        style={isMobile ? undefined : { height: `${computedHeight}px` }}
      >
        {sortedPanels.map((panel, index) => {
          const rect = rects[panel.id] ?? panel.defaultRect
          const zIndex = index + 10
          return (
            <section
              key={panel.id}
              className={styles.panel}
              style={
                isMobile
                  ? undefined
                  : {
                    left: rect.x,
                    top: rect.y,
                    width: rect.w,
                    height: rect.h,
                    zIndex
                  }
              }
            >
              <header
                className={styles.panelHeader}
                onMouseDown={(event) => startInteraction(event, panel.id, { kind: 'move' })}
              >
                <h3 className={styles.panelTitle}>{panel.title}</h3>
                <div className={styles.panelHeaderRight}>
                  <span className={styles.dragMark}>Mover</span>
                  <button
                    className={styles.panelCloseBtn}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => closePanel(panel.id)}
                    title={`Cerrar ${panel.title}`}
                  >
                    ✕
                  </button>
                </div>
              </header>
              <div className={styles.panelBody}>{panel.content}</div>
              {!isMobile && (
                <>
                  {(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeDir[]).map((dir) => (
                    <div
                      key={dir}
                      className={`${styles.resizeEdge} ${styles[`resizeEdge_${dir}`]}`}
                      onMouseDown={(event) => startInteraction(event, panel.id, { kind: 'resize', dir })}
                      aria-label={`Redimensionar panel ${panel.title} (${dir})`}
                      role="separator"
                    />
                  ))}
                </>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
