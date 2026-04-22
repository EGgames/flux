import { useState } from 'react'
import { usePrograms } from '../../hooks/usePrograms'
import { usePlaylists } from '../../hooks/usePlaylists'
import styles from './ProgramsPage.module.css'

interface Props { profileId: string | null }

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface NewProgramForm {
  dayOfWeek: number
  name: string
  startTime: string
  endTime: string
  playlistId: string
}

export default function ProgramsPage({ profileId }: Props) {
  const { programs, create, remove } = usePrograms(profileId)
  const { playlists } = usePlaylists(profileId)
  const [modal, setModal] = useState<{ open: boolean; dayOfWeek: number } | null>(null)
  const [form, setForm] = useState<NewProgramForm>({ dayOfWeek: 0, name: '', startTime: '08:00', endTime: '09:00', playlistId: '' })
  const [error, setError] = useState<string | null>(null)

  const openModal = (dayOfWeek: number) => {
    setForm({ dayOfWeek, name: '', startTime: '08:00', endTime: '09:00', playlistId: '' })
    setError(null)
    setModal({ open: true, dayOfWeek })
  }

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    try {
      await create({
        name: form.name.trim(),
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        playlistId: form.playlistId || undefined
      })
      setModal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Grilla Semanal</h1>
      </div>
      <div className={styles.weekGrid}>
        {DAYS.map((day, idx) => {
          const dayPrograms = programs.filter((p) => p.dayOfWeek === idx)
          return (
            <div key={idx} className={styles.dayCol}>
              <div className={styles.dayTitle}>{day}</div>
              {dayPrograms.map((program) => (
                <div key={program.id} className={styles.program}>
                  <div className={styles.programName}>{program.name}</div>
                  <div className={styles.programTime}>{program.startTime} – {program.endTime}</div>
                  <button className={styles.btnDanger} style={{ marginTop: 4, width: '100%' }} onClick={() => remove(program.id)}>Eliminar</button>
                </div>
              ))}
              <button className={styles.addBtn} onClick={() => openModal(idx)}>+ Agregar</button>
            </div>
          )
        })}
      </div>

      {modal?.open && (
        <div className={styles.modal}>
          <div className={styles.modalBox}>
            <div className={styles.modalTitle}>Nuevo programa — {DAYS[modal.dayOfWeek]}</div>
            {error && <div style={{ color: 'var(--color-active)', fontSize: 12 }}>{error}</div>}
            <div className={styles.field}>
              <label className={styles.label}>Nombre</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Inicio</label>
                <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Fin</label>
                <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Playlist (opcional)</label>
              <select value={form.playlistId} onChange={(e) => setForm((f) => ({ ...f, playlistId: e.target.value }))}>
                <option value="">— Ninguna —</option>
                {playlists.map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
              </select>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={handleCreate}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
