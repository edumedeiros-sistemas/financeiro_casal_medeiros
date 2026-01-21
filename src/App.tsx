import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PublicOnlyRoute } from './components/PublicOnlyRoute'
import { Bills } from './pages/Bills'
import { Dashboard } from './pages/Dashboard'
import { DebtDetails } from './pages/DebtDetails'
import { Debts } from './pages/Debts'
import { AdminRoute } from './components/AdminRoute'
import { AdminConfig } from './pages/AdminConfig'
import { Households } from './pages/Households'
import { Login } from './pages/Login'
import { NotFound } from './pages/NotFound'
import { People } from './pages/People'
import { Reports } from './pages/Reports'
import { Register } from './pages/Register'
import { UsersAdmin } from './pages/UsersAdmin'
import { CategoriesAdmin } from './pages/CategoriesAdmin'

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
        <Route
          path="casais_medeiros"
          element={
            <AdminRoute>
              <Households />
            </AdminRoute>
          }
        />
        <Route
          path="adm_config"
          element={
            <AdminRoute>
              <AdminConfig />
            </AdminRoute>
          }
        />
        <Route
          path="categorias_admin"
          element={
            <AdminRoute>
              <CategoriesAdmin />
            </AdminRoute>
          }
        />
        <Route
          path="usuarios_admin"
          element={
            <AdminRoute>
              <UsersAdmin />
            </AdminRoute>
          }
        />
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
