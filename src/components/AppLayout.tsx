import { NavLink, Outlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'

export function AppLayout() {
  const { user } = useAuth()

  const handleLogout = async () => {
    await signOut(auth)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Finanças Casal Medeiros</h1>
          <p>Controle financeiro compartilhado</p>
        </div>
        <div className="header-actions">
          <span className="muted">{user?.email}</span>
          <button className="button secondary" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      <nav className="app-nav">
        <NavLink to="/" end>
          Resumo
        </NavLink>
        <NavLink to="/pessoas">Pessoas</NavLink>
        <NavLink to="/dividas">Dívidas</NavLink>
        <NavLink to="/contas">Contas</NavLink>
        <NavLink to="/relatorios">Relatórios</NavLink>
      </nav>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
