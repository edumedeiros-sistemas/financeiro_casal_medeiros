import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="page-center">
      <div className="card center-card">
        <h2>Página não encontrada</h2>
        <p>A rota que você tentou acessar não existe.</p>
        <Link to="/" className="button primary">
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
