import { useState } from 'react'
import type { Profile } from '../../types/ipc.types'
import styles from './ProfilesPage.module.css'

interface Props {
  profiles: {
    profiles: Profile[]
    activeProfile: Profile | null
    create: (name: string) => Promise<Profile>
    select: (id: string) => Promise<Profile>
    remove: (id: string) => Promise<void>
  }
}

export default function ProfilesPage({ profiles }: Props) {
  const { profiles: list, activeProfile, create, select, remove } = profiles
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setError(null)
    try {
      await create(newName.trim())
      setNewName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear perfil')
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Perfiles</h1>
      <div className={styles.form}>
        <input
          className={styles.input}
          placeholder="Nombre del nuevo perfil..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button className={styles.btnPrimary} onClick={handleCreate}>+ Crear</button>
      </div>
      {error && <div style={{ color: 'var(--color-active)', fontSize: 12 }}>{error}</div>}
      <div className={styles.list}>
        {list.map((profile) => (
          <div
            key={profile.id}
            className={`${styles.profileCard}${profile.id === activeProfile?.id ? ` ${styles.active}` : ''}`}
          >
            <div>
              <div className={styles.profileName}>
                {profile.name}
                {profile.isDefault && <span className={styles.badge} style={{ marginLeft: 8 }}>Activo</span>}
              </div>
              <div className={styles.profileMeta}>
                Creado {new Date(profile.createdAt).toLocaleDateString('es-AR')}
              </div>
            </div>
            <div className={styles.actions}>
              {!profile.isDefault && (
                <button className={styles.btnSecondary} onClick={() => select(profile.id)}>
                  Seleccionar
                </button>
              )}
              {!profile.isDefault && (
                <button className={styles.btnDanger} onClick={() => remove(profile.id)}>
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Sin perfiles</div>
        )}
      </div>
    </div>
  )
}
