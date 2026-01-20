import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { peopleCollection } from '../lib/collections'

type Person = {
  id: string
  name: string
  phone?: string
  note?: string
}

export function People() {
  const { user } = useAuth()
  const [people, setPeople] = useState<Person[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return

    const peopleQuery = query(
      peopleCollection(user.uid),
      orderBy('name', 'asc'),
    )
    const unsubscribe = onSnapshot(peopleQuery, (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        name: docItem.data().name,
        phone: docItem.data().phone || '',
        note: docItem.data().note || '',
      }))
      setPeople(data)
    })

    return () => unsubscribe()
  }, [user])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return
    setLoading(true)
    await addDoc(peopleCollection(user.uid), {
      name: name.trim(),
      phone: phone.trim(),
      note: note.trim(),
      createdAt: serverTimestamp(),
    })
    setName('')
    setPhone('')
    setNote('')
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!user) return
    await deleteDoc(doc(peopleCollection(user.uid), id))
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Pessoas</h2>
          <p>Cadastre quem pegou o cartão emprestado.</p>
        </div>
      </header>

      <div className="grid-2">
        <form className="card form" onSubmit={handleSubmit}>
          <h3>Novo cadastro</h3>
          <label>
            Nome
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Ex: Maria Silva"
            />
          </label>
          <label>
            Telefone
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(11) 99999-9999"
            />
          </label>
          <label>
            Observações
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Detalhes combinados"
              rows={3}
            />
          </label>
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </form>

        <div className="card">
          <h3>Lista de pessoas</h3>
          {people.length === 0 ? (
            <p className="muted">Nenhuma pessoa cadastrada ainda.</p>
          ) : (
            <ul className="list">
              {people.map((person) => (
                <li key={person.id}>
                  <div>
                    <strong>{person.name}</strong>
                    {person.phone && <span>{person.phone}</span>}
                    {person.note && <small>{person.note}</small>}
                  </div>
                  <button
                    className="button ghost"
                    onClick={() => handleDelete(person.id)}
                    type="button"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
