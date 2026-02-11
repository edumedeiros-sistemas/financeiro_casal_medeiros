import { onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  householdsCollection,
  userProfileDoc,
  userProfilesCollection,
} from '../lib/collections'
import { functions } from '../lib/firebase'

type Household = {
  id: string
  name: string
}

type UserProfile = {
  id: string
  email: string
  displayName: string
  householdId: string | null
}

export function UsersAdmin() {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [households, setHouseholds] = useState<Household[]>([])
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingEmail, setEditingEmail] = useState('')
  const [deleteEmail, setDeleteEmail] = useState('')

  useEffect(() => {
    if (!user) return

    void setDoc(
      userProfileDoc(user.uid),
      {
        email: user.email ?? '',
        displayName: user.displayName ?? '',
      },
      { merge: true },
    )

    const profilesQuery = query(
      userProfilesCollection(),
      orderBy('email', 'asc'),
    )
    const householdsQuery = query(
      householdsCollection(),
      orderBy('name', 'asc'),
    )

    const unsubProfiles = onSnapshot(profilesQuery, (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        email: docItem.data().email || '',
        displayName: docItem.data().displayName || '',
        householdId: docItem.data().householdId ?? null,
      }))
      setProfiles(data)
    })

    const unsubHouseholds = onSnapshot(householdsQuery, (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        name: docItem.data().name,
      }))
      setHouseholds(data)
    })

    return () => {
      unsubProfiles()
      unsubHouseholds()
    }
  }, [user])

  const householdMap = useMemo(
    () => new Map(households.map((item) => [item.id, item.name])),
    [households],
  )

  const handleAssign = async (userId: string, nextHouseholdId: string) => {
    setMessage('')
    await setDoc(
      userProfileDoc(userId),
      { householdId: nextHouseholdId || null },
      { merge: true },
    )
    setMessage('Household atualizado.')
  }

  const handleEditStart = (profile: UserProfile) => {
    setEditingId(profile.id)
    setEditingName(profile.displayName)
    setEditingEmail(profile.email)
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditingName('')
    setEditingEmail('')
  }

  const handleEditSave = async (profileId: string) => {
    setMessage('')
    await updateDoc(userProfileDoc(profileId), {
      displayName: editingName.trim(),
      email: editingEmail.trim(),
    })
    setMessage('Usuário atualizado.')
    handleEditCancel()
  }

  const handleDelete = async (profileId: string) => {
    if (!window.confirm('Deseja remover este usuário?')) return
    setMessage('')
    const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount')
    await deleteUserAccount({ uid: profileId })
    setMessage('Usuário removido.')
  }

  const handleDeleteByEmail = async () => {
    const email = deleteEmail.trim().toLowerCase()
    if (!email) return
    if (!window.confirm(`Deseja remover o usuário ${email}?`)) return
    setMessage('')
    const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount')
    await deleteUserAccount({ email })
    setMessage('Usuário removido.')
    setDeleteEmail('')
  }

  if (!user) {
    return null
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Usuários e casais</h2>
          <p>Gerencie os usuários e o casal vinculado.</p>
        </div>
        <div className="list-actions">
          <Link className="button secondary" to="/adm_config">
            Voltar
          </Link>
        </div>
      </header>

      <div className="card">
        <h3>Usuários cadastrados</h3>
        <div className="list-actions">
          <label className="inline-field">
            Remover por email
            <input
              type="email"
              value={deleteEmail}
              onChange={(event) => setDeleteEmail(event.target.value)}
              placeholder="email@exemplo.com"
            />
          </label>
          <button
            className="button danger"
            type="button"
            onClick={handleDeleteByEmail}
            disabled={!deleteEmail.trim()}
          >
            Excluir
          </button>
        </div>
        {message && <span className="muted">{message}</span>}
        {profiles.length === 0 ? (
          <p className="muted">Nenhum usuário encontrado.</p>
        ) : (
          <ul className="list">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <div>
                  {editingId === profile.id ? (
                    <div className="form">
                      <label>
                        Nome
                        <input
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          placeholder="Nome exibido"
                        />
                      </label>
                      <label>
                        Email
                        <input
                          type="email"
                          value={editingEmail}
                          onChange={(event) => setEditingEmail(event.target.value)}
                          placeholder="email@exemplo.com"
                        />
                      </label>
                    </div>
                  ) : (
                    <>
                      <strong>{profile.displayName || profile.email}</strong>
                      <small>{profile.email}</small>
                    </>
                  )}
                  <small>
                    Casal: {householdMap.get(profile.householdId ?? '') ?? '—'}
                  </small>
                </div>
                <div className="list-actions">
                  <label className="inline-field">
                    Alterar casal
                    <select
                      value={profile.householdId ?? ''}
                      onChange={(event) =>
                        handleAssign(profile.id, event.target.value)
                      }
                    >
                      <option value="">Sem casal</option>
                      {households.map((household) => (
                        <option key={household.id} value={household.id}>
                          {household.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {editingId === profile.id ? (
                    <>
                      <button
                        className="button primary"
                        type="button"
                        onClick={() => handleEditSave(profile.id)}
                      >
                        Salvar
                      </button>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={handleEditCancel}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => handleEditStart(profile)}
                      >
                        Editar
                      </button>
                      <button
                        className="button ghost danger"
                        type="button"
                        onClick={() => handleDelete(profile.id)}
                      >
                        Remover
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
