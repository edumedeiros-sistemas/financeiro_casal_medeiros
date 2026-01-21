import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { householdsCollection } from '../lib/collections'

type Household = {
  id: string
  name: string
  active?: boolean
}

export function Households() {
  const { user, householdId, setHouseholdId } = useAuth()
  const [name, setName] = useState('')
  const [households, setHouseholds] = useState<Household[]>([])
  const [loading, setLoading] = useState(false)
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
        active: docItem.data().active ?? true,
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
        active: true,
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

  const handleDelete = async (householdIdToDelete: string) => {
    if (!user) return
    await deleteDoc(doc(householdsCollection(), householdIdToDelete))
  }

  const handleToggleActive = async (household: Household) => {
    if (!user) return
    await updateDoc(doc(householdsCollection(), household.id), {
      active: !household.active,
    })
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
                    {household.active === false && (
                      <small>Inativo</small>
                    )}
                  </div>
                  <div className="list-actions">
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => setHouseholdId(household.id)}
                    >
                      Usar este
                    </button>
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => handleToggleActive(household)}
                    >
                      {household.active === false ? 'Ativar' : 'Inativar'}
                    </button>
                    <button
                      className="button ghost danger"
                      type="button"
                      onClick={() => handleDelete(household.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
