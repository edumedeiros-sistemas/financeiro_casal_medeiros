import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth } from '../lib/firebase'

export function Register() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      )
      if (name.trim()) {
        await updateProfile(result.user, { displayName: name.trim() })
      }
      navigate('/')
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
