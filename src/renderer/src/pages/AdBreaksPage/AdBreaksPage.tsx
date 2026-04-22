import { useState, useEffect } from 'react'
import type { AdBlock, AdRule } from '../../types/ipc.types'
import { useAdBlocks } from '../../hooks/useAdBlocks'
import { adBlockService } from '../../services/adBlockService'
import styles from './AdBreaksPage.module.css'

interface Props { profileId: string | null }

const TRIGGER_TYPES = [
  { value: 'time', label: 'Horario' },
  { value: 'song_count', label: 'Nº canciones' },
  { value: 'manual', label: 'Manual' }
]

const DAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' }
]

function formatRuleConfig(rule: AdRule): string {
  if (rule.triggerType !== 'time') {
    return rule.triggerConfig
  }

  try {
    const parsed = JSON.parse(rule.triggerConfig) as { dayOfWeek?: number; time?: string }
    if (typeof parsed.dayOfWeek === 'number' && parsed.time) {
      const day = DAYS.find((d) => d.value === parsed.dayOfWeek)?.label ?? `Día ${parsed.dayOfWeek}`
      return `${day} ${parsed.time}`
    }
    return rule.triggerConfig
  } catch {
    return rule.triggerConfig
  }
}

export default function AdBreaksPage({ profileId }: Props) {
  const { adBlocks, adRules, createBlock, removeBlock, createRule, removeRule } = useAdBlocks(profileId)
  const [selected, setSelected] = useState<AdBlock | null>(null)
  const [newName, setNewName] = useState('')
  const [ruleType, setRuleType] = useState('time')
  const [ruleConfig, setRuleConfig] = useState('')
  const [ruleDayOfWeek, setRuleDayOfWeek] = useState<number>(1)
  const [ruleTime, setRuleTime] = useState('08:00')
  const [ruleTimes, setRuleTimes] = useState<string[]>([])
  const [ruleError, setRuleError] = useState<string | null>(null)

  useEffect(() => { setSelected(null) }, [profileId])

  const handleCreate = async () => {
    if (!newName.trim()) return
    await createBlock(newName.trim())
    setNewName('')
  }

  const handleSelect = async (block: AdBlock) => {
    const detail = await adBlockService.getWithItems(block.id)
    setSelected(detail)
  }

  const handleImportItem = async () => {
    if (!selected) return
    const paths = await window.electronAPI.audioAssets.pickFiles()
    if (!paths.length) return
    const assets = await window.electronAPI.audioAssets.importBatch(paths)
    const offset = selected.items?.length ?? 0
    for (let i = 0; i < assets.length; i++) {
      await adBlockService.addItem(selected.id, assets[i].id, offset + i)
    }
    const updated = await adBlockService.getWithItems(selected.id)
    setSelected(updated)
  }

  const handleAddTimeSlot = () => {
    if (!ruleTime) return
    setRuleTimes((prev) => {
      if (prev.includes(ruleTime)) return prev
      return [...prev, ruleTime].sort()
    })
  }

  const handleRemoveTimeSlot = (time: string) => {
    setRuleTimes((prev) => prev.filter((item) => item !== time))
  }

  const handleAddRule = async () => {
    if (!profileId || !selected) return
    setRuleError(null)

    if (!selected.items?.length) {
      setRuleError('La tanda debe tener al menos 1 archivo de audio antes de crear horarios.')
      return
    }

    let nextConfig = ruleConfig.trim()
    if (ruleType === 'time') {
      const effectiveTimes = [...ruleTimes]
      if (ruleTime && !effectiveTimes.includes(ruleTime)) {
        effectiveTimes.push(ruleTime)
      }

      if (!effectiveTimes.length) {
        setRuleError('Selecciona al menos un horario para ese día.')
        return
      }

      const uniqueSortedTimes = [...new Set(effectiveTimes)].sort()
      for (const time of uniqueSortedTimes) {
        await createRule({
          adBlockId: selected.id,
          triggerType: ruleType,
          triggerConfig: JSON.stringify({ dayOfWeek: ruleDayOfWeek, time }),
          priority: 1
        })
      }

      setRuleTimes([])
      setRuleTime('08:00')
      return
    }

    if (!nextConfig) return

    await createRule({
      adBlockId: selected.id,
      triggerType: ruleType,
      triggerConfig: nextConfig,
      priority: 1
    })
    if (ruleType !== 'time') {
      setRuleConfig('')
    }
  }

  const blockRules = adRules.filter((r) => r.adBlockId === selected?.id)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Tandas (Ad Breaks)</h1>
      </div>
      <div className={styles.form}>
        <input
          className={styles.input}
          placeholder="Nueva tanda..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button className={styles.btnPrimary} onClick={handleCreate}>+ Crear</button>
      </div>
      <div className={styles.body}>
        <div className={styles.list}>
          {adBlocks.map((block) => (
            <div
              key={block.id}
              className={`${styles.listItem}${selected?.id === block.id ? ` ${styles.selected}` : ''}`}
              onClick={() => handleSelect(block)}
            >
              <div className={styles.listItemHeader}>
                <span className={styles.listItemName}>{block.name}</span>
                <button className={styles.btnDanger} onClick={(e) => { e.stopPropagation(); removeBlock(block.id) }}>✕</button>
              </div>
            </div>
          ))}
          {adBlocks.length === 0 && <div className={styles.empty}>Sin tandas</div>}
        </div>

        <div className={styles.detail}>
          {selected ? (
            <>
              <div className={styles.detailTitle}>
                {selected.name}
                <button className={styles.btnSecondary} onClick={handleImportItem}>+ Audio</button>
              </div>
              <div>
                <div className={styles.section}>Audios</div>
                <div className={styles.trackList}>
                  {selected.items?.map((item) => (
                    <div key={item.id} className={styles.trackItem}>
                      <span className={styles.trackPos}>{item.position}</span>
                      <span className={styles.trackName}>{item.audioAsset.name}</span>
                      <button className={styles.btnDanger} onClick={() => adBlockService.removeItem(item.id)}>✕</button>
                    </div>
                  ))}
                  {!selected.items?.length && <div className={styles.empty}>Sin audios en esta tanda</div>}
                </div>
              </div>
              <div>
                <div className={styles.section}>Reglas de disparo</div>
                {ruleError && <div className={styles.ruleError}>{ruleError}</div>}
                <div className={styles.ruleForm}>
                  <select className={styles.ruleSelect} value={ruleType} onChange={(e) => setRuleType(e.target.value)}>
                    {TRIGGER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>

                  {ruleType === 'time' ? (
                    <>
                      <select className={styles.ruleSelect} value={ruleDayOfWeek} onChange={(e) => setRuleDayOfWeek(Number(e.target.value))}>
                        {DAYS.map((day) => (
                          <option key={day.value} value={day.value}>{day.label}</option>
                        ))}
                      </select>
                      <div className={styles.timeComposer}>
                        <input
                          className={styles.timeInput}
                          type="time"
                          value={ruleTime}
                          onChange={(e) => setRuleTime(e.target.value)}
                        />
                        <button className={styles.btnSecondary} type="button" onClick={handleAddTimeSlot}>Agregar hora</button>
                      </div>
                    </>
                  ) : (
                    <input
                      className={styles.input}
                      placeholder={ruleType === 'song_count' ? 'Ej: 4' : 'manual'}
                      value={ruleConfig}
                      onChange={(e) => setRuleConfig(e.target.value)}
                    />
                  )}

                  <button className={styles.btnPrimary} onClick={handleAddRule}>+ Regla</button>
                </div>

                {ruleType === 'time' && (
                  <>
                    <div className={styles.timeHelp}>Selecciona un día y agrega una o varias horas para que la tanda salga varias veces ese día.</div>
                    <div className={styles.timeSlots}>
                      {ruleTimes.map((time) => (
                        <span key={time} className={styles.timeSlot}>
                          {time}
                          <button className={styles.timeSlotRemove} onClick={() => handleRemoveTimeSlot(time)}>✕</button>
                        </span>
                      ))}
                      {ruleTimes.length === 0 && <span className={styles.timeEmpty}>Sin horas agregadas.</span>}
                    </div>
                  </>
                )}

                <div style={{ marginTop: 10 }}>
                  {blockRules.map((rule) => (
                    <div key={rule.id} className={styles.ruleItem}>
                      <span className={styles.ruleTag}>{rule.triggerType}</span>
                      <span className={styles.ruleConfig}>{formatRuleConfig(rule)}</span>
                      <button className={styles.btnDanger} onClick={() => removeRule(rule.id)}>✕</button>
                    </div>
                  ))}
                  {blockRules.length === 0 && <div className={styles.empty}>Sin reglas</div>}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.empty}>Selecciona una tanda</div>
          )}
        </div>
      </div>
    </div>
  )
}
