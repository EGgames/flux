import { useEffect, useState } from 'react'

export interface DeviceChangeInfo {
  /** Cantidad de dispositivos audio output al momento del cambio. */
  outputCount: number
  /** Cantidad de input audio. */
  inputCount: number
  /** Timestamp del ultimo cambio. */
  changedAt: number | null
}

/**
 * Suscribe a navigator.mediaDevices.devicechange y devuelve un snapshot
 * de la cantidad de dispositivos. Util para alertar al operador cuando se
 * (des)conecta una placa de audio.
 */
export function useDeviceChange(): DeviceChangeInfo {
  const [info, setInfo] = useState<DeviceChangeInfo>({ outputCount: 0, inputCount: 0, changedAt: null })

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return
    }
    let cancelled = false

    const refresh = async (): Promise<void> => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (cancelled) return
        const outputCount = devices.filter((d) => d.kind === 'audiooutput').length
        const inputCount = devices.filter((d) => d.kind === 'audioinput').length
        setInfo({ outputCount, inputCount, changedAt: Date.now() })
      } catch {
        /* permission denied — ignorar */
      }
    }

    void refresh()
    const onChange = (): void => { void refresh() }
    navigator.mediaDevices.addEventListener('devicechange', onChange)
    return () => {
      cancelled = true
      navigator.mediaDevices.removeEventListener('devicechange', onChange)
    }
  }, [])

  return info
}
