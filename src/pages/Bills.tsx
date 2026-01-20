import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { billsCollection } from '../lib/collections'
import { formatCurrency, formatDate } from '../lib/format'

type Bill = {
  id: string
  title: string
  amount: number
  dueDate: string
  recurring: boolean
  recurringActive: boolean
  seriesId: string
  recurringEndDate?: string
  status: 'aberta' | 'paga'
}

const addMonths = (dateString: string, monthsToAdd: number) => {
  const [year, month, day] = dateString.split('-').map(Number)
  if (!year || !month || !day) return dateString
  const base = new Date(year, month - 1, 1)
  base.setMonth(base.getMonth() + monthsToAdd)
  const daysInTargetMonth = new Date(
    base.getFullYear(),
    base.getMonth() + 1,
    0,
  ).getDate()
  const finalDay = Math.min(day, daysInTargetMonth)
  const result = new Date(base.getFullYear(), base.getMonth(), finalDay)
  const monthString = String(result.getMonth() + 1).padStart(2, '0')
  const dayString = String(result.getDate()).padStart(2, '0')
  return `${result.getFullYear()}-${monthString}-${dayString}`
}

export function Bills() {
  const { user } = useAuth()
  const [bills, setBills] = useState<Bill[]>([])
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isRecurring, setIsRecurring] = useState(true)
  const [recurringEndDate, setRecurringEndDate] = useState('')
  const [editingBillId, setEditingBillId] = useState<string | null>(null)
  const [monthFilter, setMonthFilter] = useState(
    new Date().toISOString().slice(0, 7),
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return

    const billsQuery = query(
      billsCollection(user.uid),
      orderBy('dueDate', 'asc'),
    )

    const unsubscribe = onSnapshot(billsQuery, (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        title: docItem.data().title,
        amount: Number(docItem.data().amount || 0),
        dueDate: docItem.data().dueDate,
        recurring: Boolean(docItem.data().recurring),
        recurringActive: Boolean(
          docItem.data().recurringActive ?? docItem.data().recurring ?? false,
        ),
        seriesId: docItem.data().seriesId || '',
        recurringEndDate: docItem.data().recurringEndDate || '',
        status: docItem.data().status,
      }))
      setBills(data)
    })

    return () => unsubscribe()
  }, [user])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return
    setLoading(true)
    const editingBill = bills.find((bill) => bill.id === editingBillId)
    const seriesId = isRecurring
      ? editingBill?.seriesId || crypto.randomUUID()
      : ''
    const payload = {
      title: title.trim(),
      amount: Number(amount),
      dueDate,
      recurring: isRecurring,
      recurringActive: isRecurring
        ? editingBill?.recurringActive ?? true
        : false,
      seriesId,
      recurringEndDate: isRecurring ? recurringEndDate : '',
      status: editingBill?.status ?? 'aberta',
    }

    if (editingBillId) {
      await updateDoc(doc(billsCollection(user.uid), editingBillId), payload)
    } else {
      await addDoc(billsCollection(user.uid), {
        ...payload,
        createdAt: serverTimestamp(),
      })
    }
    setTitle('')
    setAmount('')
    setDueDate('')
    setIsRecurring(true)
    setRecurringEndDate('')
    setEditingBillId(null)
    setLoading(false)
  }

  const handleToggleStatus = async (bill: Bill) => {
    if (!user) return
    const nextStatus = bill.status === 'aberta' ? 'paga' : 'aberta'
    await updateDoc(doc(billsCollection(user.uid), bill.id), {
      status: nextStatus,
    })

    if (
      nextStatus === 'paga' &&
      bill.recurring &&
      bill.recurringActive &&
      bill.seriesId
    ) {
      const nextDueDate = addMonths(bill.dueDate, 1)
      if (bill.recurringEndDate && nextDueDate > bill.recurringEndDate) {
        return
      }
      const seriesQuery = query(
        billsCollection(user.uid),
        where('seriesId', '==', bill.seriesId),
      )
      const existing = await getDocs(seriesQuery)
      const alreadyExists = existing.docs.some(
        (docItem) => docItem.data().dueDate === nextDueDate,
      )
      if (!alreadyExists) {
        await addDoc(billsCollection(user.uid), {
          title: bill.title,
          amount: bill.amount,
          dueDate: nextDueDate,
          recurring: true,
          recurringActive: true,
          seriesId: bill.seriesId,
          recurringEndDate: bill.recurringEndDate ?? '',
          status: 'aberta',
          createdAt: serverTimestamp(),
        })
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!user) return
    await deleteDoc(doc(billsCollection(user.uid), id))
  }

  const handleEdit = (bill: Bill) => {
    setEditingBillId(bill.id)
    setTitle(bill.title)
    setAmount(String(bill.amount))
    setDueDate(bill.dueDate)
    setIsRecurring(bill.recurring)
    setRecurringEndDate(bill.recurringEndDate ?? '')
  }

  const handleCancelEdit = () => {
    setEditingBillId(null)
    setTitle('')
    setAmount('')
    setDueDate('')
    setIsRecurring(true)
    setRecurringEndDate('')
  }

  const handleStopRecurring = async (seriesId: string) => {
    if (!user || !seriesId) return
    const seriesQuery = query(
      billsCollection(user.uid),
      where('seriesId', '==', seriesId),
    )
    const snapshot = await getDocs(seriesQuery)
    const updates = snapshot.docs.map((docItem) =>
      updateDoc(doc(billsCollection(user.uid), docItem.id), {
        recurringActive: false,
      }),
    )
    await Promise.all(updates)
  }

  const filteredBills = bills.filter((bill) =>
    bill.dueDate.startsWith(monthFilter),
  )

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Contas da casa</h2>
          <p>Água, luz, internet e outras despesas fixas.</p>
        </div>
      </header>

      <div className="grid-2">
        <form className="card form" onSubmit={handleSubmit}>
          <h3>{editingBillId ? 'Editar conta' : 'Nova conta'}</h3>
          <label>
            Conta
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              placeholder="Ex: Energia elétrica"
            />
          </label>
          <label>
            Valor (R$)
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              min="0"
            />
          </label>
          <label>
            Vencimento
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              required
            />
          </label>
          <label>
            Recorrência
            <select
              value={isRecurring ? 'recorrente' : 'unica'}
              onChange={(event) => setIsRecurring(event.target.value === 'recorrente')}
            >
              <option value="recorrente">Recorrente (todo mês)</option>
              <option value="unica">Apenas uma vez</option>
            </select>
          </label>
          {isRecurring && (
            <label>
              Data final da recorrência (opcional)
              <input
                type="date"
                value={recurringEndDate}
                onChange={(event) => setRecurringEndDate(event.target.value)}
                placeholder="Deixe em branco para recorrência contínua"
              />
            </label>
          )}
          <button className="button primary" type="submit" disabled={loading}>
            {loading
              ? 'Salvando...'
              : editingBillId
                ? 'Atualizar conta'
                : 'Salvar conta'}
          </button>
          {editingBillId && (
            <button
              className="button secondary"
              type="button"
              onClick={handleCancelEdit}
            >
              Cancelar edição
            </button>
          )}
        </form>

        <div className="card">
          <div className="card-header-row">
            <h3>Contas cadastradas</h3>
            <label className="inline-field">
              Mês
              <input
                type="month"
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
              />
            </label>
          </div>
          {filteredBills.length === 0 ? (
            <p className="muted">Nenhuma conta para este mês.</p>
          ) : (
            <ul className="list">
              {filteredBills.map((bill) => (
                <li key={bill.id}>
                  <div>
                    <strong>{bill.title}</strong>
                    <small>
                      {formatCurrency(bill.amount)} • vence em{' '}
                      {formatDate(bill.dueDate)} •{' '}
                      {bill.recurring
                        ? bill.recurringActive
                          ? bill.recurringEndDate
                            ? `recorrente até ${formatDate(
                                bill.recurringEndDate,
                              )}`
                            : 'recorrente'
                          : 'recorrência encerrada'
                        : 'única'}
                    </small>
                  </div>
                  <div className="list-actions">
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => handleToggleStatus(bill)}
                    >
                      {bill.status === 'aberta' ? 'Marcar paga' : 'Reabrir'}
                    </button>
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => handleEdit(bill)}
                    >
                      Editar
                    </button>
                    {bill.recurring && bill.recurringActive && (
                      <button
                        className="button ghost"
                        type="button"
                        onClick={() => handleStopRecurring(bill.seriesId)}
                      >
                        Parar recorrência
                      </button>
                    )}
                    <button
                      className="button ghost danger"
                      type="button"
                      onClick={() => handleDelete(bill.id)}
                    >
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
