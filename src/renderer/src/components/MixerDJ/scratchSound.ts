/**
 * Sintetizador minimalista de "scratch" estilo turntable.
 * Usa ruido blanco filtrado por un bandpass cuya frecuencia y ganancia
 * se modulan con la velocidad angular del jog.
 *
 * Diseño:
 *  - Una unica AudioContext compartida y un noise buffer de 2s en loop.
 *  - Cadena: NoiseSource -> BiquadFilter (bandpass) -> Gain -> destination.
 *  - start() arranca el source si no esta corriendo.
 *  - update(velocity) ajusta gain y frecuencia segun |velocity| (rad/ms).
 *  - stop() apaga la cadena con un fade rapido (anti-click).
 */

let ctx: AudioContext | null = null
let noiseSrc: AudioBufferSourceNode | null = null
let bandpass: BiquadFilterNode | null = null
let gainNode: GainNode | null = null
let active = false

// ──────────────────────────────────────────────────────────────────────
// Routing del scratch sound.
//   mode='main'    → AudioContext.destination (mezcla con todas las salidas).
//   mode='monitor' → MediaStreamDestination → <audio> con setSinkId() sobre
//                    el deviceId del monitor configurado en el perfil.
// El destino se materializa on-demand en getDestinationNode() y se reconecta
// en caliente si cambia mientras hay un scratch en curso.
// ──────────────────────────────────────────────────────────────────────
type ScratchOutputMode = 'main' | 'monitor'
let outputMode: ScratchOutputMode = 'main'
let outputDeviceId: string | null = null
let monitorStreamDest: MediaStreamAudioDestinationNode | null = null
let monitorAudioEl: HTMLAudioElement | null = null

function teardownMonitor(): void {
  if (monitorAudioEl) {
    try { monitorAudioEl.pause() } catch { /* no-op */ }
    monitorAudioEl.srcObject = null
    try {
      if (monitorAudioEl.parentNode) monitorAudioEl.parentNode.removeChild(monitorAudioEl)
    } catch { /* no-op */ }
    monitorAudioEl = null
  }
  if (monitorStreamDest) {
    try { monitorStreamDest.disconnect() } catch { /* no-op */ }
    monitorStreamDest = null
  }
}

function getDestinationNode(c: AudioContext): AudioNode {
  if (outputMode === 'monitor' && outputDeviceId) {
    if (!monitorStreamDest) {
      try {
        monitorStreamDest = c.createMediaStreamDestination()
        const el = document.createElement('audio')
        el.srcObject = monitorStreamDest.stream
        el.autoplay = true
        el.style.display = 'none'
        // Montar en DOM es necesario en algunos renderers Chromium para que
        // el pipeline de audio se active de forma estable.
        try { document.body.appendChild(el) } catch { /* no-op */ }
        const setSinkId = (el as unknown as { setSinkId?: (id: string) => Promise<void> }).setSinkId
        if (typeof setSinkId === 'function') {
          try { void setSinkId.call(el, outputDeviceId) } catch { /* no-op */ }
        }
        void el.play().catch(() => { /* no-op */ })
        monitorAudioEl = el
      } catch {
        teardownMonitor()
        return c.destination
      }
    }
    return monitorStreamDest!
  }
  return c.destination
}

export function setScratchOutput(mode: ScratchOutputMode, deviceId: string | null): void {
  if (outputMode === mode && outputDeviceId === deviceId) return
  outputMode = mode
  outputDeviceId = deviceId
  if (mode === 'main' || !deviceId) teardownMonitor()
  // Reconecta en caliente si hay scratch sonando.
  if (active && ctx && gainNode) {
    try { gainNode.disconnect() } catch { /* no-op */ }
    try { gainNode.connect(getDestinationNode(ctx)) } catch { /* no-op */ }
  }
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx
  try {
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    return ctx
  } catch {
    return null
  }
}

function buildNoiseBuffer(c: AudioContext): AudioBuffer {
  const seconds = 2
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buf
}

export function startScratch(): void {
  const c = ensureContext()
  if (!c) return
  if (active) return
  // El AudioContext puede estar suspendido por la autoplay policy. pointerdown
  // ES un user gesture, asi que resume() es valido. No esperamos al promise:
  // creamos los nodos ya y dejamos que el ramp inicial absorba la latencia.
  if (c.state === 'suspended') {
    try { void c.resume() } catch { /* no-op */ }
  }
  try {
    const src = c.createBufferSource()
    src.buffer = buildNoiseBuffer(c)
    src.loop = true

    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(800, c.currentTime)
    bp.Q.setValueAtTime(2.5, c.currentTime)

    const g = c.createGain()
    // Arrancamos con gain audible bajo para que se escuche apenas tocan el
    // platter aun antes del primer updateScratch().
    g.gain.setValueAtTime(0.08, c.currentTime)

    src.connect(bp).connect(g).connect(getDestinationNode(c))
    src.start(0)

    noiseSrc = src
    bandpass = bp
    gainNode = g
    active = true
  } catch {
    active = false
  }
}

/**
 * @param velocity rad/ms (positivo = avance, negativo = rebobinado).
 * Mapea el modulo de la velocidad a frecuencia del bandpass y a ganancia.
 */
export function updateScratch(velocity: number): void {
  if (!active || !ctx || !bandpass || !gainNode) return
  const speed = Math.min(1, Math.abs(velocity) * 80) // normaliza
  const now = ctx.currentTime
  // Frecuencia: rebobinado tira mas grave, avance mas agudo.
  const freq = velocity < 0
    ? 350 + speed * 1200
    : 700 + speed * 2400
  // Ganancia proporcional pero cap a 0.35 para no saturar.
  const gain = Math.min(0.35, 0.05 + speed * 0.45)
  try {
    bandpass.frequency.setTargetAtTime(freq, now, 0.01)
    gainNode.gain.setTargetAtTime(gain, now, 0.015)
  } catch { /* no-op */ }
}

export function stopScratch(): void {
  if (!active || !ctx || !gainNode || !noiseSrc) {
    active = false
    return
  }
  const now = ctx.currentTime
  try {
    gainNode.gain.cancelScheduledValues(now)
    gainNode.gain.setValueAtTime(gainNode.gain.value, now)
    gainNode.gain.linearRampToValueAtTime(0, now + 0.05)
    const src = noiseSrc
    setTimeout(() => {
      try { src.stop() } catch { /* no-op */ }
      try { src.disconnect() } catch { /* no-op */ }
    }, 80)
  } catch { /* no-op */ }
  noiseSrc = null
  bandpass = null
  gainNode = null
  active = false
}
