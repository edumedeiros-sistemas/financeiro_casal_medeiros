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
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { categoriesCollection } from '../lib/collections'

type Category = {
  id: string
  name: string
}

export function CategoriesAdmin() {
  const { householdId } = useAuth()
  const [name, setName] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!householdId) return
    const categoriesQuery = query(
      categoriesCollection(householdId),
      orderBy('name', 'asc'),
    )
    const unsubscribe = onSnapshot(categoriesQuery, (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        name: docItem.data().name,
      }))
      setCategories(data)
    })
    return () => unsubscribe()
  }, [householdId])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!householdId) return
    setLoading(true)
    await addDoc(categoriesCollection(householdId), {
      name: name.trim(),
      createdAt: serverTimestamp(),
    })
    setName('')
    setLoading(false)
  }

  const handleDelete = async (categoryId: string) => {
    if (!householdId) return
    await deleteDoc(doc(categoriesCollection(householdId), categoryId))
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Categorias de contas</h2>
          <p>Crie e gerencie categorias para contas da casa.</p>
        </div>
        <div className="list-actions">
          <Link className="button secondary" to="/adm_config">
            Voltar
          </Link>
        </div>
      </header>

      <div className="grid-2">
        <form className="card form" onSubmit={handleSubmit}>
          <h3>Nova categoria</h3>
          <label>
            Nome da categoria
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Ex: Lazer, Comida, Casa"
            />
          </label>
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? 'Salvando...' : 'Adicionar'}
          </button>
        </form>

        <div className="card">
          <h3>Categorias cadastradas</h3>
          {categories.length === 0 ? (
            <p className="muted">Nenhuma categoria cadastrada.</p>
          ) : (
            <ul className="list">
              {categories.map((category) => (
                <li key={category.id}>
                  <div>
                    <strong>{category.name}</strong>
                  </div>
                  <button
                    className="button ghost danger"
                    type="button"
                    onClick={() => handleDelete(category.id)}
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
