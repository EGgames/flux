import { useState, useEffect } from 'react'
import type { OutputIntegration } from '../../types/ipc.types'
import { outputService } from '../../services/outputService'
import styles from './IntegrationsPage.module.css'

interface Props { profileId: string | null }

interface IcecastConfig {
  host: string
  port: string
  mountpoint: string
  username: string
  password: string
}

interface ShoutcastConfig {
  host: string
  port: string
  password: string
  stationId: string
}

interface LocalOutputConfig {
  deviceId: string
  deviceName: string
}

interface AudioOutputDevice {
  deviceId: string
  label: string
}

function parseConfig<T>(json: string, fallback: T): T {
  try { return JSON.parse(json) } catch { return fallback }
}

const DEFAULT_ICECAST: IcecastConfig = { host: '', port: '8000', mountpoint: '/stream', username: 'source', password: '' }
const DEFAULT_SHOUTCAST: ShoutcastConfig = { host: '', port: '8000', password: '', stationId: '1' }
const DEFAULT_LOCAL: LocalOutputConfig = { deviceId: 'default', deviceName: 'Salida del sistema (default)' }
const DEFAULT_MONITOR: LocalOutputConfig = { deviceId: 'default', deviceName: 'Salida del sistema (default)' }

export default function IntegrationsPage({ profileId }: Props) {
  const [outputs, setOutputs] = useState<OutputIntegration[]>([])
  const [icecastCfg, setIcecastCfg] = useState<IcecastConfig>(DEFAULT_ICECAST)
  const [shoutcastCfg, setShoutcastCfg] = useState<ShoutcastConfig>(DEFAULT_SHOUTCAST)
  const [localCfg, setLocalCfg] = useState<LocalOutputConfig>(DEFAULT_LOCAL)
  const [monitorCfg, setMonitorCfg] = useState<LocalOutputConfig>(DEFAULT_MONITOR)
  const [devices, setDevices] = useState<AudioOutputDevice[]>([])
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})
  const [saving, setSaving] = useState(false)

  const local = outputs.find((o) => o.outputType === 'local')
  const icecast = outputs.find((o) => o.outputType === 'icecast')
  const shoutcast = outputs.find((o) => o.outputType === 'shoutcast')
  const monitor = outputs.find((o) => o.outputType === 'monitor')

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const mediaDevices = await navigator.mediaDevices.enumerateDevices()
        const audioOutputs = mediaDevices
          .filter((device) => device.kind === 'audiooutput')
          .map((device) => ({
            deviceId: device.deviceId,
            label: device.label || `Salida ${device.deviceId.slice(0, 6)}`
          }))
        setDevices(audioOutputs)
      } catch {
        setDevices([])
      }
    }
    void loadDevices()
  }, [])

  useEffect(() => {
    if (!profileId) return
    outputService.list(profileId).then((data) => {
      setOutputs(data)
      const lc = data.find((o) => o.outputType === 'local')
      const ic = data.find((o) => o.outputType === 'icecast')
      const sc = data.find((o) => o.outputType === 'shoutcast')
      if (lc) setLocalCfg(parseConfig(lc.config, DEFAULT_LOCAL))
      if (ic) setIcecastCfg(parseConfig(ic.config, DEFAULT_ICECAST))
      if (sc) setShoutcastCfg(parseConfig(sc.config, DEFAULT_SHOUTCAST))
      const mc = data.find((o) => o.outputType === 'monitor')
      if (mc) setMonitorCfg(parseConfig(mc.config, DEFAULT_MONITOR))
    })
  }, [profileId])

  const handleSaveLocal = async () => {
    if (!profileId) return
    setSaving(true)
    const saved = await outputService.save({
      profileId,
      outputType: 'local',
      config: JSON.stringify(localCfg),
      enabled: local?.enabled ?? true
    })
    setOutputs((prev) => {
      const filtered = prev.filter((o) => o.outputType !== 'local')
      return [...filtered, saved]
    })
    setSaving(false)
  }

  const handleSaveIcecast = async () => {
    if (!profileId) return
    setSaving(true)
    const saved = await outputService.save({ profileId, outputType: 'icecast', config: JSON.stringify(icecastCfg), enabled: icecast?.enabled ?? false })
    setOutputs((prev) => {
      const filtered = prev.filter((o) => o.outputType !== 'icecast')
      return [...filtered, saved]
    })
    setSaving(false)
  }

  const handleSaveShoutcast = async () => {
    if (!profileId) return
    setSaving(true)
    const saved = await outputService.save({ profileId, outputType: 'shoutcast', config: JSON.stringify(shoutcastCfg), enabled: shoutcast?.enabled ?? false })
    setOutputs((prev) => {
      const filtered = prev.filter((o) => o.outputType !== 'shoutcast')
      return [...filtered, saved]
    })
    setSaving(false)
  }

  const handleSaveMonitor = async () => {
    if (!profileId) return
    setSaving(true)
    const saved = await outputService.save({
      profileId,
      outputType: 'monitor',
      config: JSON.stringify(monitorCfg),
      enabled: monitor?.enabled ?? false
    })
    setOutputs((prev) => {
      const filtered = prev.filter((o) => o.outputType !== 'monitor')
      return [...filtered, saved]
    })
    setSaving(false)
  }

  const handleTest = async (id: string) => {
    const result = await outputService.test(id)
    setTestResults((prev) => ({ ...prev, [id]: result }))
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    const updated = await outputService.toggleEnabled(id, enabled)
    setOutputs((prev) => prev.map((o) => (o.id === id ? updated : o)))
  }

  const getStatus = (output: OutputIntegration | undefined) => {
    if (!output) return 'not-saved'
    if (!output.enabled) return 'disabled'
    const test = testResults[output.id]
    if (test?.success) return 'connected'
    if (test && !test.success) return 'error'
    return 'idle'
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Salidas de Audio</h1>

      {/* Local / Sound Card */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <span className={`${styles.statusDot} ${local?.enabled ? styles.connected : ''}`} />
          Tarjeta de sonido (local)
          {local && (
            <label className={styles.toggle}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={local.enabled}
                onChange={(e) => handleToggle(local.id, e.target.checked)}
              />
              Habilitado
            </label>
          )}
        </div>
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label}>Dispositivo de salida</label>
            <select
              value={localCfg.deviceId}
              onChange={(e) => {
                const selected = devices.find((device) => device.deviceId === e.target.value)
                setLocalCfg({
                  deviceId: e.target.value,
                  deviceName: selected?.label ?? 'Salida del sistema (default)'
                })
              }}
            >
              <option value="default">Salida del sistema (default)</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={handleSaveLocal} disabled={saving}>Guardar</button>
          {local && <button className={styles.btnSecondary} onClick={() => handleTest(local.id)}>Probar conexión</button>}
        </div>
        {local && testResults[local.id] && (
          <div className={`${styles.testResult} ${testResults[local.id].success ? styles.testSuccess : styles.testError}`}>
            {testResults[local.id].message}
          </div>
        )}
      </div>

      {/* Monitor de Audio */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <span className={`${styles.statusDot} ${monitor?.enabled ? styles.connected : ''}`} />
          Monitor de audio
          {monitor && (
            <label className={styles.toggle}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={monitor.enabled}
                onChange={(e) => handleToggle(monitor.id, e.target.checked)}
              />
              Habilitado
            </label>
          )}
        </div>
        <p className={styles.monitorHint}>Dispositivo secundario para escuchar la salida en cabina (auriculares o monitores de estudio).</p>
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label}>Dispositivo de monitoreo</label>
            <select
              value={monitorCfg.deviceId}
              onChange={(e) => {
                const selected = devices.find((device) => device.deviceId === e.target.value)
                setMonitorCfg({
                  deviceId: e.target.value,
                  deviceName: selected?.label ?? 'Salida del sistema (default)'
                })
              }}
            >
              <option value="default">Salida del sistema (default)</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={handleSaveMonitor} disabled={saving}>Guardar</button>
        </div>
      </div>

      {/* Icecast */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <span className={`${styles.statusDot} ${getStatus(icecast) === 'connected' ? styles.connected : getStatus(icecast) === 'error' ? styles.error : ''}`} />
          Icecast
          {icecast && (
            <label className={styles.toggle}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={icecast.enabled}
                onChange={(e) => handleToggle(icecast.id, e.target.checked)}
              />
              Habilitado
            </label>
          )}
        </div>
        <div className={styles.fields}>
          <div className={styles.row}>
            <div className={styles.field} style={{ flex: 2 }}>
              <label className={styles.label}>Host</label>
              <input value={icecastCfg.host} onChange={(e) => setIcecastCfg((c) => ({ ...c, host: e.target.value }))} placeholder="localhost" />
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Puerto</label>
              <input value={icecastCfg.port} onChange={(e) => setIcecastCfg((c) => ({ ...c, port: e.target.value }))} placeholder="8000" />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Mountpoint</label>
            <input value={icecastCfg.mountpoint} onChange={(e) => setIcecastCfg((c) => ({ ...c, mountpoint: e.target.value }))} placeholder="/stream" />
          </div>
          <div className={styles.row}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Usuario</label>
              <input value={icecastCfg.username} onChange={(e) => setIcecastCfg((c) => ({ ...c, username: e.target.value }))} placeholder="source" />
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Contraseña</label>
              <input type="password" value={icecastCfg.password} onChange={(e) => setIcecastCfg((c) => ({ ...c, password: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={handleSaveIcecast} disabled={saving}>Guardar</button>
          {icecast && <button className={styles.btnSecondary} onClick={() => handleTest(icecast.id)}>Probar conexión</button>}
        </div>
        {icecast && testResults[icecast.id] && (
          <div className={`${styles.testResult} ${testResults[icecast.id].success ? styles.testSuccess : styles.testError}`}>
            {testResults[icecast.id].message}
          </div>
        )}
      </div>

      {/* Shoutcast */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <span className={`${styles.statusDot} ${getStatus(shoutcast) === 'connected' ? styles.connected : getStatus(shoutcast) === 'error' ? styles.error : ''}`} />
          Shoutcast
          {shoutcast && (
            <label className={styles.toggle}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={shoutcast.enabled}
                onChange={(e) => handleToggle(shoutcast.id, e.target.checked)}
              />
              Habilitado
            </label>
          )}
        </div>
        <div className={styles.fields}>
          <div className={styles.row}>
            <div className={styles.field} style={{ flex: 2 }}>
              <label className={styles.label}>Host</label>
              <input value={shoutcastCfg.host} onChange={(e) => setShoutcastCfg((c) => ({ ...c, host: e.target.value }))} placeholder="localhost" />
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Puerto</label>
              <input value={shoutcastCfg.port} onChange={(e) => setShoutcastCfg((c) => ({ ...c, port: e.target.value }))} placeholder="8000" />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Contraseña</label>
              <input type="password" value={shoutcastCfg.password} onChange={(e) => setShoutcastCfg((c) => ({ ...c, password: e.target.value }))} />
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Station ID</label>
              <input value={shoutcastCfg.stationId} onChange={(e) => setShoutcastCfg((c) => ({ ...c, stationId: e.target.value }))} placeholder="1" />
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={handleSaveShoutcast} disabled={saving}>Guardar</button>
          {shoutcast && <button className={styles.btnSecondary} onClick={() => handleTest(shoutcast.id)}>Probar conexión</button>}
        </div>
        {shoutcast && testResults[shoutcast.id] && (
          <div className={`${styles.testResult} ${testResults[shoutcast.id].success ? styles.testSuccess : styles.testError}`}>
            {testResults[shoutcast.id].message}
          </div>
        )}
      </div>
    </div>
  )
}
