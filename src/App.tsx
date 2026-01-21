import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PublicOnlyRoute } from './components/PublicOnlyRoute'
import { Bills } from './pages/Bills'
import { Dashboard } from './pages/Dashboard'
import { DebtDetails } from './pages/DebtDetails'
import { Debts } from './pages/Debts'
import { Households } from './pages/Households'
import { Login } from './pages/Login'
import { NotFound } from './pages/NotFound'
import { People } from './pages/People'
import { Reports } from './pages/Reports'
import { Register } from './pages/Register'

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="pessoas" element={<People />} />
        <Route path="dividas" element={<Debts />} />
        <Route path="dividas/:groupId" element={<DebtDetails />} />
        <Route path="contas" element={<Bills />} />
        <Route path="relatorios" element={<Reports />} />
        <Route path="casais_medeiros" element={<Households />} />
      </Route>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/registrar"
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/registro_financas"
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
