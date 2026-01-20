import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function PublicOnlyRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="page-center">Carregando...</div>
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return children
}
