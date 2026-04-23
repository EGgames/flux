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
  className?: string
}

type DragMode = 'move' | 'resize'

const MOBILE_BREAKPOINT = 920

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
  maxWorkspaceHeight = 980,
  onWorkspaceHeightChange,
  className
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rectsRef = useRef<Record<string, PanelRect>>({})
  const [rects, setRects] = useState<Record<string, PanelRect>>(() => applyDefaults(panels, savedLayout))
  const [order, setOrder] = useState<string[]>(() => panels.map((panel) => panel.id))
  const [isMobile, setIsMobile] = useState(false)
  const [hiddenPanelIds, setHiddenPanelIds] = useState<string[]>([])
  const [showAddMenu, setShowAddMenu] = useState(false)

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

  const closePanel = (id: string) => setHiddenPanelIds((prev) => [...prev, id])
  const reopenPanel = (id: string) => {
    setHiddenPanelIds((prev) => prev.filter((h) => h !== id))
    setShowAddMenu(false)
  }

  const startInteraction = (event: React.MouseEvent, panelId: string, mode: DragMode) => {
    if (isMobile) return
    const panelRect = rectsRef.current[panelId]
    if (!panelRect) return

    event.preventDefault()
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
      const containerHeight = containerRef.current.clientHeight
      const deltaX = event.clientX - drag.startX
      const deltaY = event.clientY - drag.startY
      const panelConfig = panelLookup[drag.panelId]
      const minW = panelConfig?.minW ?? 260
      const minH = panelConfig?.minH ?? 170

      setRects((prev) => {
        const current = prev[drag.panelId] ?? drag.startRect
        let next: PanelRect

        if (drag.mode === 'move') {
          const maxX = Math.max(containerWidth - current.w, 0)
          const maxY = Math.max(containerHeight - current.h, 0)
          next = {
            ...current,
            x: clamp(drag.startRect.x + deltaX, 0, maxX),
            y: clamp(drag.startRect.y + deltaY, 0, maxY)
          }
        } else {
          const maxW = Math.max(containerWidth - current.x, minW)
          const maxH = Math.max(containerHeight - current.y, minH)
          next = {
            ...current,
            w: clamp(drag.startRect.w + deltaX, minW, maxW),
            h: clamp(drag.startRect.h + deltaY, minH, maxH)
          }
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
    const panelWidth = Math.floor((width - gap * (columns - 1)) / columns)

    const next = sortedPanels.reduce<Record<string, PanelRect>>((acc, panel, index) => {
      const col = index % columns
      const row = Math.floor(index / columns)
      acc[panel.id] = {
        x: col * (panelWidth + gap),
        y: row * 250,
        w: panelWidth,
        h: 240
      }
      return acc
    }, {})

    setRects(next)
    rectsRef.current = next
    onLayoutChange?.(next)
  }

  const updateWorkspaceHeight = (nextHeight: number) => {
    const clamped = clamp(nextHeight, minWorkspaceHeight, maxWorkspaceHeight)
    onWorkspaceHeightChange?.(clamped)
  }

  return (
    <div className={`${styles.workspaceWrap}${className ? ` ${className}` : ''}`}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarHint}>
          {isMobile
            ? 'Vista compacta activa: los paneles se apilan para pantallas chicas.'
            : 'Arrastra el encabezado para mover paneles y la esquina para redimensionar.'}
        </span>
        <div className={styles.toolbarControls}>
          <button className={styles.toolbarBtn} onClick={() => updateWorkspaceHeight(workspaceHeight - 80)}>-</button>
          <input
            type="range"
            min={minWorkspaceHeight}
            max={maxWorkspaceHeight}
            value={workspaceHeight}
            onChange={(event) => updateWorkspaceHeight(Number(event.target.value))}
            className={styles.sizeSlider}
            aria-label="Tamaño del área de ventanas"
          />
          <button className={styles.toolbarBtn} onClick={() => updateWorkspaceHeight(workspaceHeight + 80)}>+</button>
          <span className={styles.sizeValue}>{workspaceHeight}px</span>
          <button className={styles.toolbarBtn} onClick={handleAutoFit}>Auto-ajustar</button>
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
        style={isMobile ? undefined : { height: `${workspaceHeight}px` }}
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
                onMouseDown={(event) => startInteraction(event, panel.id, 'move')}
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
                <button
                  className={styles.resizeHandle}
                  onMouseDown={(event) => startInteraction(event, panel.id, 'resize')}
                  aria-label={`Redimensionar panel ${panel.title}`}
                />
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
