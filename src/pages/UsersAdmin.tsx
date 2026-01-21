import { onSnapshot, orderBy, query, setDoc } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  householdsCollection,
  userProfileDoc,
  userProfilesCollection,
} from '../lib/collections'

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
        {message && <span className="muted">{message}</span>}
        {profiles.length === 0 ? (
          <p className="muted">Nenhum usuário encontrado.</p>
        ) : (
          <ul className="list">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <div>
                  <strong>{profile.displayName || profile.email}</strong>
                  <small>{profile.email}</small>
                  <small>
                    Casal: {householdMap.get(profile.householdId ?? '') ?? '—'}
                  </small>
                </div>
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
