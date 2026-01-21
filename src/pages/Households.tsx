import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { db } from '../lib/firebase'
import { householdsCollection } from '../lib/collections'

type Household = {
  id: string
  name: string
}

export function Households() {
  const { user, householdId, setHouseholdId } = useAuth()
  const [name, setName] = useState('')
  const [households, setHouseholds] = useState<Household[]>([])
  const [loading, setLoading] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user) return
    const householdsQuery = query(
      householdsCollection(),
      orderBy('name', 'asc'),
    )
    const unsubscribe = onSnapshot(householdsQuery, (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        name: docItem.data().name,
      }))
      setHouseholds(data)
    })
    return () => unsubscribe()
  }, [user])

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return
    setLoading(true)
    setMessage('')
    try {
      const docRef = await addDoc(householdsCollection(), {
        name: name.trim(),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      })
      await setHouseholdId(docRef.id)
      setName('')
    } catch (err) {
      const message =
        err instanceof Error ? err.message.toLowerCase() : 'erro desconhecido'
      setMessage(
        message.includes('permission')
          ? 'Sem permissão para criar o casal. Atualize as regras do Firestore.'
          : 'Não foi possível criar o casal.',
      )
    } finally {
      setLoading(false)
    }
  }

  const medeirosHousehold = useMemo(
    () => households.find((item) => item.name.toLowerCase() === 'medeiros'),
    [households],
  )

  const handleMigrate = async () => {
    if (!user || !householdId) return
    setMigrating(true)
    setMessage('')
    try {
      const batch = writeBatch(db)

      const peopleSnap = await getDocs(
        query(collection(db, 'users', user.uid, 'people')),
      )
      peopleSnap.docs.forEach((docItem) => {
        batch.set(doc(db, 'households', householdId, 'people', docItem.id), {
          ...docItem.data(),
        })
      })

      const debtsSnap = await getDocs(
        query(collection(db, 'users', user.uid, 'debts')),
      )
      debtsSnap.docs.forEach((docItem) => {
        batch.set(doc(db, 'households', householdId, 'debts', docItem.id), {
          ...docItem.data(),
        })
      })

      const billsSnap = await getDocs(
        query(collection(db, 'users', user.uid, 'bills')),
      )
      billsSnap.docs.forEach((docItem) => {
        batch.set(doc(db, 'households', householdId, 'bills', docItem.id), {
          ...docItem.data(),
        })
      })

      await batch.commit()
      setMessage('Migração concluída com sucesso.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message.toLowerCase() : 'erro desconhecido'
      setMessage(
        message.includes('permission')
          ? 'Sem permissão para migrar. Atualize as regras do Firestore.'
          : 'Não foi possível migrar os dados.',
      )
    } finally {
      setMigrating(false)
    }
  }

  const handleMigrateMedeiros = async () => {
    if (!user) return
    if (!medeirosHousehold) {
      setMessage('Casal Medeiros não encontrado.')
      return
    }
    await setHouseholdId(medeirosHousehold.id)
    await handleMigrate()
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Casais</h2>
          <p>Cadastre e selecione o casal para compartilhar os dados.</p>
        </div>
      </header>

      <div className="grid-2">
        <form className="card form" onSubmit={handleCreate}>
          <h3>Novo casal</h3>
          <label>
            Nome do casal
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Ex: Casal Medeiros"
            />
          </label>
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? 'Salvando...' : 'Criar casal'}
          </button>
        </form>

        <div className="card">
          <h3>Casais cadastrados</h3>
          {message && <span className="muted">{message}</span>}
          {households.length === 0 ? (
            <p className="muted">Nenhum casal cadastrado.</p>
          ) : (
            <ul className="list">
              {households.map((household) => (
                <li key={household.id}>
                  <div>
                    <strong>{household.name}</strong>
                    {householdId === household.id && (
                      <small>Selecionado</small>
                    )}
                  </div>
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => setHouseholdId(household.id)}
                  >
                    Usar este
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Migração de dados antigos</h3>
        <p className="muted">
          Copia pessoas, dívidas e contas de `users/{'{uid}'}` para o casal
          selecionado.
        </p>
        <button
          className="button primary"
          type="button"
          onClick={handleMigrate}
          disabled={!householdId || migrating}
        >
          {migrating ? 'Migrando...' : 'Migrar dados antigos'}
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={handleMigrateMedeiros}
          disabled={migrating}
        >
          Migrar para Casal Medeiros
        </button>
      </div>
    </section>
  )
}
