import { onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { billsCollection, debtsCollection } from '../lib/collections'
import { formatCurrency } from '../lib/format'

type Debt = {
  id: string
  amount: number
  dueDate: string
  status: 'aberta' | 'paga'
}

type Bill = {
  id: string
  amount: number
  dueDate: string
  status: 'aberta' | 'paga'
}

export function Dashboard() {
  const { user, householdId } = useAuth()
  const [debts, setDebts] = useState<Debt[]>([])
  const [bills, setBills] = useState<Bill[]>([])

  useEffect(() => {
    if (!user || !householdId) return

    const debtsQuery = query(debtsCollection(householdId))
    const billsQuery = query(billsCollection(householdId))

    const unsubscribeDebts = onSnapshot(debtsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        amount: Number(doc.data().amount || 0),
        dueDate: doc.data().dueDate || '',
        status: doc.data().status,
      }))
      setDebts(data)
    })

    const unsubscribeBills = onSnapshot(billsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        amount: Number(doc.data().amount || 0),
        dueDate: doc.data().dueDate || '',
        status: doc.data().status,
      }))
      setBills(data)
    })

    return () => {
      unsubscribeDebts()
      unsubscribeBills()
    }
  }, [user, householdId])

  const openDebts = useMemo(
    () => debts.filter((item) => item.status === 'aberta'),
    [debts],
  )
  const paidDebts = useMemo(
    () => debts.filter((item) => item.status === 'paga'),
    [debts],
  )
  const totalDebtsOpen = useMemo(
    () => openDebts.reduce((total, item) => total + item.amount, 0),
    [openDebts],
  )
  const totalDebtsPaid = useMemo(
    () => paidDebts.reduce((total, item) => total + item.amount, 0),
    [paidDebts],
  )
  const openBills = useMemo(
    () => bills.filter((item) => item.status === 'aberta'),
    [bills],
  )
  const paidBills = useMemo(
    () => bills.filter((item) => item.status === 'paga'),
    [bills],
  )
  const totalBillsOpen = useMemo(
    () => openBills.reduce((total, item) => total + item.amount, 0),
    [openBills],
  )
  const totalBillsPaid = useMemo(
    () => paidBills.reduce((total, item) => total + item.amount, 0),
    [paidBills],
  )
  const now = new Date()
  const currentMonthKey = now.toISOString().slice(0, 7)
  const currentYear = now.getFullYear()
  const monthlyDebts = useMemo(
    () => debts.filter((item) => item.dueDate.startsWith(currentMonthKey)),
    [debts, currentMonthKey],
  )
  const monthlyPaidDebts = useMemo(
    () => paidDebts.filter((item) => item.dueDate.startsWith(currentMonthKey)),
    [paidDebts, currentMonthKey],
  )
  const monthlyBills = useMemo(
    () => bills.filter((item) => item.dueDate.startsWith(currentMonthKey)),
    [bills, currentMonthKey],
  )
  const monthlyPaidBills = useMemo(
    () => paidBills.filter((item) => item.dueDate.startsWith(currentMonthKey)),
    [paidBills, currentMonthKey],
  )
  const totalMonthlyDebts = useMemo(
    () => monthlyDebts.reduce((total, item) => total + item.amount, 0),
    [monthlyDebts],
  )
  const totalMonthlyPaidDebts = useMemo(
    () => monthlyPaidDebts.reduce((total, item) => total + item.amount, 0),
    [monthlyPaidDebts],
  )
  const totalMonthlyBills = useMemo(
    () => monthlyBills.reduce((total, item) => total + item.amount, 0),
    [monthlyBills],
  )
  const totalMonthlyPaidBills = useMemo(
    () => monthlyPaidBills.reduce((total, item) => total + item.amount, 0),
    [monthlyPaidBills],
  )

  const overdueDebts = useMemo(() => {
    const today = now.toISOString().slice(0, 10)
    return openDebts.filter((item) => item.dueDate && item.dueDate < today)
  }, [openDebts, now])
  const overdueBills = useMemo(() => {
    const today = now.toISOString().slice(0, 10)
    return openBills.filter((item) => item.dueDate && item.dueDate < today)
  }, [openBills, now])
  const totalOverdueDebts = useMemo(
    () => overdueDebts.reduce((total, item) => total + item.amount, 0),
    [overdueDebts],
  )
  const totalOverdueBills = useMemo(
    () => overdueBills.reduce((total, item) => total + item.amount, 0),
    [overdueBills],
  )

  const buildYearlySeries = (items: { amount: number; dueDate: string }[]) => {
    const months = Array.from({ length: 12 }, (_, index) => index)
    return months.map((monthIndex) => {
      const monthKey = `${currentYear}-${String(monthIndex + 1).padStart(
        2,
        '0',
      )}`
      return items
        .filter((item) => item.dueDate.startsWith(monthKey))
        .reduce((total, item) => total + item.amount, 0)
    })
  }

  const yearlyDebtSeries = useMemo(
    () => buildYearlySeries(openDebts),
    [openDebts, currentYear],
  )
  const yearlyBillSeries = useMemo(
    () => buildYearlySeries(openBills),
    [openBills, currentYear],
  )

  const monthLabels = useMemo(
    () => [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ],
    [],
  )

  const LineChart = ({
    data,
    color,
  }: {
    data: number[]
    color: string
  }) => {
    const maxValue = Math.max(...data, 1)
    const roundedMax = Math.max(500, Math.ceil(maxValue / 500) * 500)
    const padding = 10
    const usableHeight = 100 - padding * 2
    const points = data
      .map((value, index) => {
        const x =
          data.length === 1 ? 50 : (index / (data.length - 1)) * 100
        const y = 100 - padding - (value / roundedMax) * usableHeight
        return `${x},${y}`
      })
      .join(' ')
    const ticks = Array.from(
      { length: Math.floor(roundedMax / 500) + 1 },
      (_, index) => index * 500,
    ).reverse()

    return (
      <div className="chart">
        <div className="chart-area">
          <div className="chart-y">
            {ticks.map((tick) => (
              <span key={tick}>{formatCurrency(tick)}</span>
            ))}
          </div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="3"
              points={points}
            />
          </svg>
        </div>
        <div className="chart-months-row">
          <div className="chart-months-spacer" />
          <div className="chart-months">
            {monthLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!householdId) {
    return (
      <section className="page">
        <div className="card">
          <h3>Selecione um household</h3>
          <p className="muted">
            Para visualizar o resumo, escolha um casal em{' '}
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
          <h2>Resumo geral</h2>
          <p>Visão rápida do que está em aberto.</p>
        </div>
      </header>

      <div className="grid-2">
        <div className="card highlight">
          <h3>Dívidas a receber</h3>
          <strong>{formatCurrency(totalDebtsOpen)}</strong>
          <span>{openDebts.length} registros em aberto</span>
        </div>
        <div className="card highlight">
          <h3>Dívidas recebidas</h3>
          <strong>{formatCurrency(totalDebtsPaid)}</strong>
          <span>{paidDebts.length} registros pagos</span>
        </div>
      </div>

      <div className="card">
        <h3>Resumo do mês</h3>
        <div className="grid-2">
          <div className="card highlight">
            <h4>Dívidas a receber</h4>
            <strong>{formatCurrency(totalMonthlyDebts)}</strong>
            <span>{monthlyDebts.length} parcelas no mês atual</span>
          </div>
          <div className="card highlight">
            <h4>Dívidas recebidas</h4>
            <strong>{formatCurrency(totalMonthlyPaidDebts)}</strong>
            <span>{monthlyPaidDebts.length} parcelas pagas no mês</span>
          </div>
          <div className="card highlight">
            <h4>Faltando receber</h4>
            <strong>
              {formatCurrency(totalMonthlyDebts - totalMonthlyPaidDebts)}
            </strong>
            <span>Saldo do mês de dívidas</span>
          </div>
          <div className="card highlight">
            <h4>Contas da casa</h4>
            <strong>{formatCurrency(totalMonthlyBills)}</strong>
            <span>{monthlyBills.length} contas no mês atual</span>
          </div>
          <div className="card highlight">
            <h4>Contas pagas</h4>
            <strong>{formatCurrency(totalMonthlyPaidBills)}</strong>
            <span>{monthlyPaidBills.length} contas pagas no mês</span>
          </div>
          <div className="card highlight">
            <h4>Faltando pagar</h4>
            <strong>
              {formatCurrency(totalMonthlyBills - totalMonthlyPaidBills)}
            </strong>
            <span>Saldo do mês de contas</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Vencidos</h3>
        <div className="grid-2">
          <div className="card highlight alert">
            <h4>Dívidas vencidas</h4>
            <strong>{formatCurrency(totalOverdueDebts)}</strong>
            <span>{overdueDebts.length} parcelas vencidas</span>
          </div>
          <div className="card highlight alert">
            <h4>Contas vencidas</h4>
            <strong>{formatCurrency(totalOverdueBills)}</strong>
            <span>{overdueBills.length} contas vencidas</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Gráfico anual ({currentYear})</h3>
        <div className="grid-2">
          <div className="card">
            <div className="chart-header">
              <h4>Dívidas a receber</h4>
              <span className="muted">
                {formatCurrency(
                  yearlyDebtSeries.reduce((total, item) => total + item, 0),
                )}
              </span>
            </div>
            <LineChart data={yearlyDebtSeries} color="#2563eb" />
          </div>
          <div className="card">
            <div className="chart-header">
              <h4>Contas da casa</h4>
              <span className="muted">
                {formatCurrency(
                  yearlyBillSeries.reduce((total, item) => total + item, 0),
                )}
              </span>
            </div>
            <LineChart data={yearlyBillSeries} color="#16a34a" />
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Organização rápida</h3>
        <p>
          Use as abas acima para cadastrar pessoas que pegaram o cartão,
          registrar as dívidas delas e também controlar as contas fixas da casa.
        </p>
      </div>
    </section>
  )
}
