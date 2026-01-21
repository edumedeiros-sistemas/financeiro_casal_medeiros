import { Link } from 'react-router-dom'

export function AdminConfig() {
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Admin Config</h2>
          <p>Atalhos e configurações administrativas.</p>
        </div>
      </header>

      <div className="card">
        <h3>Atalhos</h3>
        <div className="list-actions">
          <Link className="button secondary" to="/registro_financas">
            Cadastro de usuários
          </Link>
          <Link className="button secondary" to="/casais_medeiros">
            Cadastro de casais
          </Link>
          <Link className="button secondary" to="/usuarios_admin">
            Usuários e casais
          </Link>
        </div>
      </div>
    </section>
  )
}
