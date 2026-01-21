import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { onSnapshot } from 'firebase/firestore'
import { auth } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { householdDoc } from '../lib/collections'

export function AppLayout() {
  const { user, householdId } = useAuth()
  const [householdName, setHouseholdName] = useState('')
  const isAdmin =
    user?.email?.toLowerCase() === 'edu.netto.smedeiros@hotmail.com'

  useEffect(() => {
    if (!householdId) {
      setHouseholdName('')
      return
    }
    const unsubscribe = onSnapshot(householdDoc(householdId), (snapshot) => {
      setHouseholdName(snapshot.data()?.name ?? '')
    })
    return () => unsubscribe()
  }, [householdId])

  const handleLogout = async () => {
    await signOut(auth)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>
            Finanças Casal{' '}
            {householdName ? householdName : 'Medeiros'}
          </h1>
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
        {isAdmin && <NavLink to="/adm_config">Admin</NavLink>}
      </nav>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
