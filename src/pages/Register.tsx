import { doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth, secondaryAuth, secondaryDb } from '../lib/firebase'
import { householdsCollection, userProfileDoc } from '../lib/collections'

export function Register({ adminMode = false }: { adminMode?: boolean }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [households, setHouseholds] = useState<Array<{ id: string; name: string }>>([])
  const [householdId, setHouseholdId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const householdsQuery = query(householdsCollection(), orderBy('name', 'asc'))
    const unsubscribe = onSnapshot(householdsQuery, (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        name: docItem.data().name,
      }))
      setHouseholds(data)
    })
    return () => unsubscribe()
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const authProvider = adminMode ? secondaryAuth : auth
      const result = await createUserWithEmailAndPassword(
        authProvider,
        email.trim(),
        password,
      )
      if (name.trim()) {
        await updateProfile(result.user, { displayName: name.trim() })
      }
      const profileRef = adminMode
        ? doc(secondaryDb, 'userProfiles', result.user.uid)
        : userProfileDoc(result.user.uid)
      await setDoc(
        profileRef,
        {
          email: email.trim(),
          displayName: name.trim(),
          householdId: householdId || null,
        },
        { merge: true },
      )
      if (adminMode) {
        await signOut(secondaryAuth)
        setMessage('Usuário cadastrado com sucesso.')
        setName('')
        setEmail('')
        setPassword('')
        setHouseholdId('')
      } else {
        navigate('/')
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message.toLowerCase() : 'erro desconhecido'
      if (message.includes('email-already-in-use')) {
        setError('Este email já está em uso.')
      } else if (message.includes('invalid-email')) {
        setError('Email inválido.')
      } else if (message.includes('weak-password')) {
        setError('A senha deve ter no mínimo 6 caracteres.')
      } else if (message.includes('operation-not-allowed')) {
        setError('Ative o login por email/senha no Firebase.')
      } else {
        setError('Não foi possível criar a conta. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {adminMode && (
          <div className="list-actions">
            <Link className="button secondary" to="/adm_config">
              Voltar
            </Link>
          </div>
        )}
        <h1>Finanças Casal Medeiros</h1>
        <p>Crie sua conta para começar.</p>

        <form onSubmit={handleSubmit} className="form">
          <label>
            Nome (opcional)
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do casal"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="email@exemplo.com"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              placeholder="mínimo 6 caracteres"
            />
          </label>
          <label>
            Casal
            <select
              value={householdId}
              onChange={(event) => setHouseholdId(event.target.value)}
            >
              <option value="">Selecionar depois</option>
              {households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.name}
                </option>
              ))}
            </select>
          </label>
        {message && <span className="muted">{message}</span>}
        {error && <span className="error">{error}</span>}
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? 'Criando...' : 'Criar conta'}
          </button>
        </form>

        <p className="muted">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
