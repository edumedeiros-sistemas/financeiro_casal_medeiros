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
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { debtsCollection, peopleCollection } from '../lib/collections'
import { formatCurrency, formatDate } from '../lib/format'

type Person = {
  id: string
  name: string
}

type Debt = {
  id: string
  personId: string
  description: string
  amount: number
  totalAmount: number
  groupId: string
  installmentNumber: number
  installmentsCount: number
  purchaseDate: string
  dueDate: string
  paidAmount: number
  status: 'aberta' | 'parcial' | 'paga'
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

const formatMonthYear = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number)
  if (!year || !month || !day) return dateString
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export function Debts() {
  const { user, householdId } = useAuth()
  const navigate = useNavigate()
  const [people, setPeople] = useState<Person[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [personId, setPersonId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [installmentsCount, setInstallmentsCount] = useState('1')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [filterPersonId, setFilterPersonId] = useState('all')
  const now = new Date()
  const [yearFilter, setYearFilter] = useState(String(now.getFullYear()))
  const [monthFilter, setMonthFilter] = useState(
    now.toISOString().slice(0, 7),
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || !householdId) return

    const peopleQuery = query(
      peopleCollection(householdId),
      orderBy('name', 'asc'),
    )
    const debtsQuery = query(
      debtsCollection(householdId),
      orderBy('dueDate', 'asc'),
    )

    const unsubscribePeople = onSnapshot(peopleQuery, (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        name: docItem.data().name,
      }))
      setPeople(data)
      if (!personId && data[0]) {
        setPersonId(data[0].id)
      }
    })

    const unsubscribeDebts = onSnapshot(debtsQuery, (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        personId: docItem.data().personId,
        description: docItem.data().description,
        amount: Number(docItem.data().amount || 0),
        totalAmount: Number(docItem.data().totalAmount || 0),
        groupId: docItem.data().groupId || docItem.id,
        installmentNumber: Number(docItem.data().installmentNumber || 1),
        installmentsCount: Number(docItem.data().installmentsCount || 1),
        purchaseDate: docItem.data().purchaseDate || '',
        dueDate: docItem.data().dueDate,
        paidAmount: Number(docItem.data().paidAmount || 0),
        status: docItem.data().status,
      }))
      setDebts(data)
    })

    return () => {
      unsubscribePeople()
      unsubscribeDebts()
    }
  }, [user, householdId])

  const peopleMap = useMemo(
    () => new Map(people.map((person) => [person.id, person.name])),
    [people],
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !householdId) return
    setLoading(true)
    const total = Number(amount)
    const totalInstallments = Math.max(1, Number(installmentsCount) || 1)
    const baseAmount =
      Math.floor((total / totalInstallments) * 100) / 100 || 0
    const remainder = Number(
      (total - baseAmount * totalInstallments).toFixed(2),
    )
    const groupId = editingGroupId ?? crypto.randomUUID()

    if (editingGroupId) {
      const existingQuery = query(
        debtsCollection(householdId),
        where('groupId', '==', editingGroupId),
      )
      const existingSnapshot = await getDocs(existingQuery)
      const deleteWrites = existingSnapshot.docs.map((docItem) =>
        deleteDoc(doc(debtsCollection(householdId), docItem.id)),
      )
      await Promise.all(deleteWrites)
    }

    const writes = Array.from({ length: totalInstallments }, (_, index) =>
      addDoc(debtsCollection(householdId), {
        personId,
        description: description.trim(),
        amount:
          index === totalInstallments - 1
            ? Number((baseAmount + remainder).toFixed(2))
            : baseAmount,
        totalAmount: total,
        installmentNumber: index + 1,
        installmentsCount: totalInstallments,
        purchaseDate,
        dueDate: addMonths(dueDate, index),
        paidAmount: 0,
        status: 'aberta',
        groupId,
        createdAt: serverTimestamp(),
      }),
    )

    await Promise.all(writes)
    setDescription('')
    setAmount('')
    setInstallmentsCount('1')
    setPurchaseDate('')
    setDueDate('')
    setEditingGroupId(null)
    setLoading(false)
  }

  const handleToggleStatus = async (debt: Debt) => {
    if (!user || !householdId) return
    const nextStatus = debt.status === 'paga' ? 'aberta' : 'paga'
    await updateDoc(doc(debtsCollection(householdId), debt.id), {
      status: nextStatus,
      paidAmount: nextStatus === 'paga' ? debt.amount : 0,
    })
  }

  const handleDelete = async (id: string) => {
    if (!user || !householdId) return
    await deleteDoc(doc(debtsCollection(householdId), id))
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!user || !householdId) return
    const groupQuery = query(
      debtsCollection(householdId),
      where('groupId', '==', groupId),
    )
    const snapshot = await getDocs(groupQuery)
    const deletes = snapshot.docs.map((docItem) =>
      deleteDoc(doc(debtsCollection(householdId), docItem.id)),
    )
    await Promise.all(deletes)
  }

  const handleEditGroup = (debt: Debt) => {
    setEditingGroupId(debt.groupId)
    setPersonId(debt.personId)
    setDescription(debt.description)
    setAmount(String(debt.totalAmount || debt.amount * debt.installmentsCount))
    setInstallmentsCount(String(debt.installmentsCount))
    setPurchaseDate(debt.purchaseDate)
    const monthsBack = debt.installmentNumber - 1
    setDueDate(addMonths(debt.dueDate, -monthsBack))
  }

  const handleCancelEdit = () => {
    setEditingGroupId(null)
    setDescription('')
    setAmount('')
    setInstallmentsCount('1')
    setPurchaseDate('')
    setDueDate('')
  }

  const currentMonthDebts = useMemo(() => {
    if (monthFilter) {
      return debts.filter((debt) => debt.dueDate.startsWith(monthFilter))
    }
    if (yearFilter === 'all') {
      return debts
    }
    return debts.filter((debt) => debt.dueDate.startsWith(yearFilter))
  }, [debts, monthFilter, yearFilter])
  const openMonthDebtsAll = useMemo(
    () => currentMonthDebts.filter((debt) => debt.amount > debt.paidAmount),
    [currentMonthDebts],
  )
  const filteredMonthDebts = useMemo(() => {
    if (filterPersonId === 'all') return []
    return currentMonthDebts.filter((debt) => debt.personId === filterPersonId)
  }, [currentMonthDebts, filterPersonId])
  const openDebts = useMemo(
    () => filteredMonthDebts.filter((debt) => debt.amount > debt.paidAmount),
    [filteredMonthDebts],
  )

  const totalsByPerson = useMemo(() => {
    if (filterPersonId === 'all') {
      const total = openMonthDebtsAll.reduce(
        (sum, debt) => sum + (debt.amount - debt.paidAmount),
        0,
      )
      return [['Todos', total]] as Array<[string, number]>
    }
    const totals = new Map<string, number>()
    openDebts.forEach((debt) => {
      totals.set(
        debt.personId,
        (totals.get(debt.personId) || 0) + (debt.amount - debt.paidAmount),
      )
    })
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
  }, [openDebts])

  const totalsByMonth = useMemo(() => {
    if (filterPersonId === 'all') {
      const total = openMonthDebtsAll.reduce(
        (sum, debt) => sum + (debt.amount - debt.paidAmount),
        0,
      )
      return [['Todos', total]] as Array<[string, number]>
    }
    const totals = new Map<string, number>()
    openDebts.forEach((debt) => {
      const monthKey = debt.dueDate.slice(0, 7)
      totals.set(
        monthKey,
        (totals.get(monthKey) || 0) + (debt.amount - debt.paidAmount),
      )
    })
    return Array.from(totals.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [openDebts])

  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    debts.forEach((debt) => {
      if (debt.dueDate) {
        months.add(debt.dueDate.slice(0, 7))
      }
    })
    months.add(new Date().toISOString().slice(0, 7))
    return Array.from(months).sort((a, b) => b.localeCompare(a))
  }, [debts])
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    debts.forEach((debt) => {
      if (debt.dueDate) {
        years.add(debt.dueDate.slice(0, 4))
      }
    })
    years.add(String(now.getFullYear()))
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [debts, now])
  const availableMonthsForYear = useMemo(() => {
    if (yearFilter === 'all') return availableMonths
    return availableMonths.filter((month) => month.startsWith(yearFilter))
  }, [availableMonths, yearFilter])

  if (!householdId) {
    return (
      <section className="page">
        <div className="card">
          <h3>Selecione um household</h3>
          <p className="muted">
            Para registrar dívidas, escolha um casal em{' '}
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
          <h2>Dívidas</h2>
          <p>Registre as contas de quem pegou o cartão.</p>
        </div>
      </header>

      <div className="grid-2">
        <div className="card">
          <h3>Totais por pessoa (em aberto)</h3>
          {totalsByPerson.length === 0 ? (
            <p className="muted">Nenhuma dívida em aberto.</p>
          ) : (
            <ul className="list">
              {totalsByPerson.map(([personIdItem, total]) => (
                <li key={personIdItem}>
                  <div>
                    <strong>
                      {personIdItem === 'Todos'
                        ? 'Todos'
                        : peopleMap.get(personIdItem) ?? 'Pessoa'}
                    </strong>
                    <small>{formatCurrency(total)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3>Totais por vencimento</h3>
          {totalsByMonth.length === 0 ? (
            <p className="muted">Nenhuma parcela em aberto.</p>
          ) : (
            <ul className="list">
              {totalsByMonth.map(([monthKey, total]) => (
                <li key={monthKey}>
                  <div>
                    <strong>
                      {monthKey === 'Todos'
                        ? 'Todos'
                        : formatMonthYear(`${monthKey}-01`)}
                    </strong>
                    <small>{formatCurrency(total)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid-2">
        <form className="card form" onSubmit={handleSubmit}>
          <h3>{editingGroupId ? 'Editar dívida' : 'Nova dívida'}</h3>
          <label>
            Pessoa
            <select
              value={personId}
              onChange={(event) => setPersonId(event.target.value)}
              required
              disabled={people.length === 0}
            >
              {people.length === 0 ? (
                <option value="">Cadastre alguém primeiro</option>
              ) : (
                people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label>
            Descrição
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              placeholder="Ex: Mercado, farmácia..."
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
            Quantidade de parcelas
            <input
              type="number"
              value={installmentsCount}
              onChange={(event) => setInstallmentsCount(event.target.value)}
              required
              min="1"
            />
          </label>
          <label>
            Data da compra
            <input
              type="date"
              value={purchaseDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
              required
            />
          </label>
          <label>
            Vencimento da primeira parcela
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              required
            />
          </label>
          <button
            className="button primary"
            type="submit"
            disabled={loading || people.length === 0}
          >
            {loading
              ? 'Salvando...'
              : editingGroupId
                ? 'Atualizar parcelas'
                : 'Salvar dívida'}
          </button>
          {editingGroupId && (
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
            <h3>Dívidas cadastradas</h3>
            <label className="inline-field">
              Filtrar por pessoa
              <select
                value={filterPersonId}
                onChange={(event) => setFilterPersonId(event.target.value)}
              >
                <option value="all">Todas</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-field">
              Ano
              <select
                value={yearFilter}
                onChange={(event) => {
                  setYearFilter(event.target.value)
                  setMonthFilter('')
                }}
              >
                <option value="all">Todos</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-field">
              Mês (opcional)
              <select
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
              >
                <option value="">Todos</option>
                {availableMonthsForYear.map((month) => (
                  <option key={month} value={month}>
                    {formatMonthYear(`${month}-01`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {filterPersonId !== 'all' && (
            <>
              {filteredMonthDebts.length === 0 ? (
                <p className="muted">Nenhuma dívida para este filtro no mês.</p>
              ) : (
                <ul className="list">
                  {filteredMonthDebts.map((debt) => (
                    <li key={debt.id}>
                      <div>
                        <strong>
                          {peopleMap.get(debt.personId) ?? 'Pessoa'}
                        </strong>
                        <span>{debt.description}</span>
                        <small>
                          {formatCurrency(debt.amount)} • parcela{' '}
                          {debt.installmentNumber}/{debt.installmentsCount} •
                          compra {formatDate(debt.purchaseDate)} • vence em{' '}
                          {formatDate(debt.dueDate)}
                        </small>
                        {debt.paidAmount > 0 && debt.paidAmount < debt.amount && (
                          <small>
                            Pago parcial: {formatCurrency(debt.paidAmount)} •
                            faltam{' '}
                            {formatCurrency(debt.amount - debt.paidAmount)}
                          </small>
                        )}
                      </div>
                      <div className="list-actions">
                        <button
                          className="button ghost"
                          type="button"
                          onClick={() => navigate(`/dividas/${debt.groupId}`)}
                        >
                          {debt.status === 'aberta'
                            ? 'Marcar paga'
                            : 'Ver parcelas'}
                        </button>
                        <button
                          className="button ghost"
                          type="button"
                          onClick={() => handleEditGroup(debt)}
                        >
                          Editar parcelas
                        </button>
                        <button
                          className="button ghost danger"
                          type="button"
                          onClick={() => handleDelete(debt.id)}
                        >
                          Remover parcela
                        </button>
                        <button
                          className="button ghost danger"
                          type="button"
                          onClick={() => handleDeleteGroup(debt.groupId)}
                        >
                          Remover grupo
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
