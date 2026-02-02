import {
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { debtsCollection } from '../lib/collections'
import { formatCurrency, formatDate } from '../lib/format'

type Debt = {
  id: string
  personId: string
  description: string
  amount: number
  installmentNumber: number
  installmentsCount: number
  purchaseDate: string
  dueDate: string
  paidAmount: number
  status: 'aberta' | 'parcial' | 'paga'
}

export function DebtDetails() {
  const { groupId } = useParams()
  const { user, householdId } = useAuth()
  const [debts, setDebts] = useState<Debt[]>([])
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    if (!user || !householdId || !groupId) return

    const debtsQuery = query(
      debtsCollection(householdId),
      where('groupId', '==', groupId),
      orderBy('installmentNumber', 'asc'),
    )

    const unsubscribe = onSnapshot(debtsQuery, (snapshot) => {
      const data = snapshot.docs.map((docItem) => {
        const amount = Number(docItem.data().amount || 0)
        const status = docItem.data().status as Debt['status']
        const paidAmount = Number(docItem.data().paidAmount || 0)
        return {
          id: docItem.id,
          personId: docItem.data().personId,
          description: docItem.data().description,
          amount,
          installmentNumber: Number(docItem.data().installmentNumber || 1),
          installmentsCount: Number(docItem.data().installmentsCount || 1),
          purchaseDate: docItem.data().purchaseDate || '',
          dueDate: docItem.data().dueDate,
          paidAmount: paidAmount > 0 || status !== 'paga' ? paidAmount : amount,
          status,
        }
      })
      setDebts(data)
    })

    return () => unsubscribe()
  }, [user, householdId, groupId])

  const title = debts[0]?.description ?? 'Parcelas'
  const purchaseDate = debts[0]?.purchaseDate ?? ''

  const totals = useMemo(() => {
    const total = debts.reduce((sum, debt) => sum + debt.amount, 0)
    const paid = debts.reduce((sum, debt) => sum + debt.paidAmount, 0)
    return { total, paid, open: total - paid }
  }, [debts])

  const handleToggleStatus = async (debt: Debt) => {
    if (!user || !householdId) return
    setError('')
    setUpdatingId(debt.id)
    try {
      const nextStatus = debt.status === 'paga' ? 'aberta' : 'paga'
      setDebts((prev) =>
        prev.map((item) =>
          item.id === debt.id
            ? {
                ...item,
                status: nextStatus,
                paidAmount: nextStatus === 'paga' ? item.amount : 0,
              }
            : item,
        ),
      )
      await updateDoc(doc(debtsCollection(householdId), debt.id), {
        status: nextStatus,
        paidAmount: nextStatus === 'paga' ? debt.amount : 0,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message.toLowerCase() : 'erro desconhecido'
      setError(
        message.includes('permission')
          ? 'Sem permissão para atualizar esta parcela.'
          : 'Não foi possível atualizar a parcela.',
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const handleMarkAllPaid = async () => {
    if (!user || !householdId) return
    setError('')
    setBulkLoading(true)
    try {
      setDebts((prev) =>
        prev.map((item) =>
          item.status === 'paga'
            ? item
            : { ...item, status: 'paga', paidAmount: item.amount },
        ),
      )
      const updates = debts
        .filter((debt) => debt.status !== 'paga')
        .map((debt) =>
          updateDoc(doc(debtsCollection(householdId), debt.id), {
            status: 'paga',
            paidAmount: debt.amount,
          }),
        )
      await Promise.all(updates)
    } catch (err) {
      const message =
        err instanceof Error ? err.message.toLowerCase() : 'erro desconhecido'
      setError(
        message.includes('permission')
          ? 'Sem permissão para atualizar as parcelas.'
          : 'Não foi possível atualizar todas as parcelas.',
      )
    } finally {
      setBulkLoading(false)
    }
  }

  const [partialValues, setPartialValues] = useState<Record<string, string>>(
    {},
  )

  const handlePartialPayment = async (debt: Debt) => {
    if (!user || !householdId) return
    const value = Number(partialValues[debt.id] || 0)
    const remaining = debt.amount - debt.paidAmount
    if (value <= 0 || value > remaining) {
      setError('Valor inválido para pagamento parcial.')
      return
    }
    setError('')
    setUpdatingId(debt.id)
    try {
      const nextPaid = Number((debt.paidAmount + value).toFixed(2))
      const nextStatus = nextPaid >= debt.amount ? 'paga' : 'parcial'
      setDebts((prev) =>
        prev.map((item) =>
          item.id === debt.id
            ? { ...item, paidAmount: nextPaid, status: nextStatus }
            : item,
        ),
      )
      await updateDoc(doc(debtsCollection(householdId), debt.id), {
        paidAmount: nextPaid,
        status: nextStatus,
      })
      setPartialValues((prev) => ({ ...prev, [debt.id]: '' }))
    } catch (err) {
      const message =
        err instanceof Error ? err.message.toLowerCase() : 'erro desconhecido'
      setError(
        message.includes('permission')
          ? 'Sem permissão para atualizar esta parcela.'
          : 'Não foi possível atualizar a parcela.',
      )
    } finally {
      setUpdatingId(null)
    }
  }

  if (!householdId) {
    return (
      <section className="page">
        <div className="card">
          <h3>Selecione um household</h3>
          <p className="muted">
            Para acessar as parcelas, escolha um casal em{' '}
            <Link to="/casais_medeiros">Casais</Link>.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>{title}</h2>
          <p>
            {purchaseDate
              ? `Compra em ${formatDate(purchaseDate)}`
              : 'Parcelas da dívida'}
          </p>
        </div>
        <div className="list-actions">
          <Link to="/dividas" className="button secondary">
            Voltar
          </Link>
          {debts.length > 0 && (
            <button
              className="button primary"
              onClick={handleMarkAllPaid}
              disabled={bulkLoading}
            >
              {bulkLoading ? 'Atualizando...' : 'Marcar todas pagas'}
            </button>
          )}
        </div>
      </header>

      <div className="grid-2">
        <div className="card highlight">
          <h3>Total</h3>
          <strong>{formatCurrency(totals.total)}</strong>
        </div>
        <div className="card highlight">
          <h3>Em aberto</h3>
          <strong>{formatCurrency(totals.open)}</strong>
        </div>
      </div>

      <div className="card">
        <h3>Parcelas</h3>
        {error && <span className="error">{error}</span>}
        {debts.length === 0 ? (
          <p className="muted">Nenhuma parcela encontrada.</p>
        ) : (
          <ul className="list">
            {debts.map((debt) => (
              <li key={debt.id}>
                <div>
                  <strong>
                    Parcela {debt.installmentNumber}/{debt.installmentsCount}
                  </strong>
                  <small>
                    {formatCurrency(debt.amount)} • vence em{' '}
                    {formatDate(debt.dueDate)}
                  </small>
                  {debt.paidAmount > 0 && debt.paidAmount < debt.amount && (
                    <small>
                      Pago parcial: {formatCurrency(debt.paidAmount)} • faltam{' '}
                      {formatCurrency(debt.amount - debt.paidAmount)}
                    </small>
                  )}
                </div>
                <div className="list-actions">
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => handleToggleStatus(debt)}
                    disabled={updatingId === debt.id}
                  >
                    {updatingId === debt.id
                      ? 'Salvando...'
                      : debt.status === 'paga'
                        ? 'Reabrir'
                        : 'Marcar paga'}
                  </button>
                  <input
                    className="input-inline"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Pago parcial"
                    value={partialValues[debt.id] ?? ''}
                    onChange={(event) =>
                      setPartialValues((prev) => ({
                        ...prev,
                        [debt.id]: event.target.value,
                      }))
                    }
                  />
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => handlePartialPayment(debt)}
                    disabled={updatingId === debt.id}
                  >
                    Registrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
