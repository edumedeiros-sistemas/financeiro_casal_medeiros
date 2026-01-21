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
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  billsCollection,
  categoriesCollection,
  peopleCollection,
} from '../lib/collections'
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
  categoryId?: string
  personId?: string
  status: 'aberta' | 'paga'
}

type Category = {
  id: string
  name: string
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

type Person = {
  id: string
  name: string
}

export function Bills() {
  const { user, householdId } = useAuth()
  const [bills, setBills] = useState<Bill[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isRecurring, setIsRecurring] = useState(true)
  const [recurringEndDate, setRecurringEndDate] = useState('')
  const [editingBillId, setEditingBillId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [personId, setPersonId] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [monthFilter, setMonthFilter] = useState(
    new Date().toISOString().slice(0, 7),
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || !householdId) return

    const billsQuery = query(
      billsCollection(householdId),
      orderBy('dueDate', 'asc'),
    )
    const categoriesQuery = query(
      categoriesCollection(householdId),
      orderBy('name', 'asc'),
    )
    const peopleQuery = query(
      peopleCollection(householdId),
      orderBy('name', 'asc'),
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
        categoryId: docItem.data().categoryId || '',
        personId: docItem.data().personId || '',
        status: docItem.data().status,
      }))
      setBills(data)
    })

    const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        name: docItem.data().name,
      }))
      setCategories(data)
    })

    const unsubscribePeople = onSnapshot(peopleQuery, (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        name: docItem.data().name,
      }))
      setPeople(data)
    })

    return () => {
      unsubscribe()
      unsubscribeCategories()
      unsubscribePeople()
    }
  }, [user, householdId])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !householdId) return
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
      categoryId: categoryId || '',
      personId: personId || '',
      status: editingBill?.status ?? 'aberta',
    }

    if (editingBillId) {
      await updateDoc(doc(billsCollection(householdId), editingBillId), payload)
    } else {
      await addDoc(billsCollection(householdId), {
        ...payload,
        createdAt: serverTimestamp(),
      })
    }
    setTitle('')
    setAmount('')
    setDueDate('')
    setIsRecurring(true)
    setRecurringEndDate('')
    setCategoryId('')
    setPersonId('')
    setEditingBillId(null)
    setLoading(false)
  }

  const handleToggleStatus = async (bill: Bill) => {
    if (!user || !householdId) return
    const nextStatus = bill.status === 'aberta' ? 'paga' : 'aberta'
    await updateDoc(doc(billsCollection(householdId), bill.id), {
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
        billsCollection(householdId),
        where('seriesId', '==', bill.seriesId),
      )
      const existing = await getDocs(seriesQuery)
      const alreadyExists = existing.docs.some(
        (docItem) => docItem.data().dueDate === nextDueDate,
      )
      if (!alreadyExists) {
        await addDoc(billsCollection(householdId), {
          title: bill.title,
          amount: bill.amount,
          dueDate: nextDueDate,
          recurring: true,
          recurringActive: true,
          seriesId: bill.seriesId,
          recurringEndDate: bill.recurringEndDate ?? '',
          categoryId: bill.categoryId ?? '',
          personId: bill.personId ?? '',
          status: 'aberta',
          createdAt: serverTimestamp(),
        })
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!user || !householdId) return
    await deleteDoc(doc(billsCollection(householdId), id))
  }

  const handleEdit = (bill: Bill) => {
    setEditingBillId(bill.id)
    setTitle(bill.title)
    setAmount(String(bill.amount))
    setDueDate(bill.dueDate)
    setIsRecurring(bill.recurring)
    setRecurringEndDate(bill.recurringEndDate ?? '')
    setCategoryId(bill.categoryId ?? '')
    setPersonId(bill.personId ?? '')
  }

  const handleCancelEdit = () => {
    setEditingBillId(null)
    setTitle('')
    setAmount('')
    setDueDate('')
    setIsRecurring(true)
    setRecurringEndDate('')
    setCategoryId('')
    setPersonId('')
  }

  const handleStopRecurring = async (seriesId: string) => {
    if (!user || !householdId || !seriesId) return
    const seriesQuery = query(
      billsCollection(householdId),
      where('seriesId', '==', seriesId),
    )
    const snapshot = await getDocs(seriesQuery)
    const updates = snapshot.docs.map((docItem) =>
      updateDoc(doc(billsCollection(householdId), docItem.id), {
        recurringActive: false,
      }),
    )
    await Promise.all(updates)
  }

  const filteredBills = bills.filter((bill) =>
    bill.dueDate.startsWith(monthFilter),
  )
  const categoriesMap = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name])),
    [categories],
  )
  const peopleMap = useMemo(
    () => new Map(people.map((item) => [item.id, item.name])),
    [people],
  )

  if (!householdId) {
    return (
      <section className="page">
        <div className="card">
          <h3>Selecione um household</h3>
          <p className="muted">
            Para cadastrar contas, escolha um casal em{' '}
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
            Categoria
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Pessoa (opcional)
            <select
              value={personId}
              onChange={(event) => setPersonId(event.target.value)}
            >
              <option value="">Sem pessoa</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
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
                      {categoriesMap.get(bill.categoryId ?? '') ??
                        'Sem categoria'}{' '}
                      {bill.personId
                        ? `• ${peopleMap.get(bill.personId) ?? 'Pessoa'}`
                        : ''}{' '}
                      •{' '}
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
