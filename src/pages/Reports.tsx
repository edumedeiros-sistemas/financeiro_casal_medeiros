import { onSnapshot, orderBy, query } from 'firebase/firestore'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  billsCollection,
  categoriesCollection,
  debtsCollection,
  peopleCollection,
} from '../lib/collections'
import { formatCurrency, formatDate } from '../lib/format'

type Person = {
  id: string
  name: string
  phone?: string
}

type Debt = {
  id: string
  personId: string
  description: string
  amount: number
  installmentNumber: number
  installmentsCount: number
  dueDate: string
  paidAmount: number
  status: 'aberta' | 'parcial' | 'paga'
}

type Bill = {
  id: string
  title: string
  amount: number
  dueDate: string
  recurring: boolean
  recurringActive: boolean
  recurringEndDate?: string
  seriesId: string
  categoryId?: string
  personId?: string
  status: 'aberta' | 'paga'
}

type Category = {
  id: string
  name: string
}

const monthKeyFromDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const addMonths = (date: Date, monthsToAdd: number) => {
  const next = new Date(date)
  next.setMonth(next.getMonth() + monthsToAdd)
  return next
}

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) return monthKey
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
}

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase()

/**
 * Ano / mês / categoria em “Nenhum” → listas vazias.
 * Pessoa em “Nenhum” → não filtra por pessoa nas contas; oculta resumo/lista de dívidas por pessoa.
 */
const REPORT_FILTER_NONE = '__report_none__'

let cachedFontData: string | null = null

const loadPdfFont = async (doc: jsPDF) => {
  if (!cachedFontData) {
    const response = await fetch('/fonts/NotoSans-Regular.ttf')
    const buffer = await response.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })
    cachedFontData = btoa(binary)
  }
  doc.addFileToVFS('NotoSans-Regular.ttf', cachedFontData)
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
  doc.setFont('NotoSans', 'normal')
}

export function Reports() {
  const { user, householdId } = useAuth()
  const [searchParams] = useSearchParams()
  const [people, setPeople] = useState<Person[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [personFilter, setPersonFilter] = useState(REPORT_FILTER_NONE)
  const [yearFilter, setYearFilter] = useState(REPORT_FILTER_NONE)
  const [monthFilter, setMonthFilter] = useState(REPORT_FILTER_NONE)
  const [categoryFilter, setCategoryFilter] = useState(REPORT_FILTER_NONE)
  const [detailed, setDetailed] = useState(false)
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [showBillsDetailed, setShowBillsDetailed] = useState(false)

  useEffect(() => {
    const personParam = searchParams.get('person')
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')
    const detailedParam = searchParams.get('detailed')
    const overdueParam = searchParams.get('overdue')
    const categoryParam = searchParams.get('category')

    if (personParam && personParam !== personFilter) {
      setPersonFilter(personParam)
    }

    if (categoryParam !== null) {
      if (categoryParam === 'all' && categoryFilter !== 'all') {
        setCategoryFilter('all')
      } else if (
        categoryParam === '__none__' &&
        categoryFilter !== '__none__'
      ) {
        setCategoryFilter('__none__')
      } else if (
        categoryParam &&
        categoryParam !== 'all' &&
        categoryParam !== '__none__' &&
        categoryParam !== categoryFilter
      ) {
        setCategoryFilter(categoryParam)
      }
    }

    if (monthParam) {
      if (monthParam !== monthFilter) {
        setMonthFilter(monthParam)
      }
      const derivedYear = monthParam.slice(0, 4)
      if (derivedYear && derivedYear !== yearFilter) {
        setYearFilter(derivedYear)
      }
    } else if (yearParam && yearParam !== yearFilter) {
      setYearFilter(yearParam)
      if (monthFilter && monthFilter !== REPORT_FILTER_NONE) {
        setMonthFilter(REPORT_FILTER_NONE)
      }
    }

    if (detailedParam !== null) {
      const nextDetailed = detailedParam === '1' || detailedParam === 'true'
      if (nextDetailed !== detailed) {
        setDetailed(nextDetailed)
      }
    }

    if (overdueParam !== null) {
      const nextOverdue = overdueParam === '1' || overdueParam === 'true'
      if (nextOverdue !== onlyOverdue) {
        setOnlyOverdue(nextOverdue)
      }
    }
  }, [
    searchParams,
    personFilter,
    monthFilter,
    yearFilter,
    categoryFilter,
    detailed,
    onlyOverdue,
  ])

  useEffect(() => {
    if (!user || !householdId) return

    const peopleQuery = query(
      peopleCollection(householdId),
      orderBy('name', 'asc'),
    )
    const debtsQuery = query(debtsCollection(householdId))
    const billsQuery = query(billsCollection(householdId))
    const categoriesQuery = query(
      categoriesCollection(householdId),
      orderBy('name', 'asc'),
    )

    const unsubscribePeople = onSnapshot(peopleQuery, (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        name: docItem.data().name,
        phone: docItem.data().phone || '',
      }))
      setPeople(data)
    })

    const unsubscribeDebts = onSnapshot(debtsQuery, (snapshot) => {
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
          dueDate: docItem.data().dueDate || '',
          paidAmount: paidAmount > 0 || status !== 'paga' ? paidAmount : amount,
          status,
        }
      })
      setDebts(data)
    })

    const unsubscribeBills = onSnapshot(billsQuery, (snapshot) => {
      const data = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        title: docItem.data().title,
        amount: Number(docItem.data().amount || 0),
        dueDate: docItem.data().dueDate || '',
        recurring: Boolean(docItem.data().recurring),
        recurringActive: Boolean(
          docItem.data().recurringActive ?? docItem.data().recurring ?? false,
        ),
        recurringEndDate: docItem.data().recurringEndDate || '',
        seriesId: docItem.data().seriesId || docItem.id,
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

    return () => {
      unsubscribePeople()
      unsubscribeDebts()
      unsubscribeBills()
      unsubscribeCategories()
    }
  }, [user, householdId])

  const peopleMap = useMemo(
    () => new Map(people.map((person) => [person.id, person.name])),
    [people],
  )
  const categoriesMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  )

  const availableYears = useMemo(() => {
    const years = new Set<string>()
    debts.forEach((debt) => {
      if (debt.dueDate) {
        years.add(debt.dueDate.slice(0, 4))
      }
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [debts])

  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    debts.forEach((debt) => {
      if (debt.dueDate) {
        months.add(debt.dueDate.slice(0, 7))
      }
    })
    return Array.from(months).sort((a, b) => b.localeCompare(a))
  }, [debts])

  const filteredDebts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return debts.filter((debt) => {
      if (
        yearFilter === REPORT_FILTER_NONE ||
        monthFilter === REPORT_FILTER_NONE
      ) {
        return false
      }
      const remaining = Math.max(0, debt.amount - debt.paidAmount)
      if (onlyOverdue && !(debt.dueDate && debt.dueDate < today)) {
        return false
      }
      if (onlyOverdue && remaining === 0) {
        return false
      }
      if (
        personFilter !== 'all' &&
        personFilter !== REPORT_FILTER_NONE &&
        debt.personId !== personFilter
      ) {
        return false
      }
      if (monthFilter) {
        return debt.dueDate.startsWith(monthFilter)
      }
      if (yearFilter !== 'all') {
        return debt.dueDate.startsWith(yearFilter)
      }
      return true
    })
  }, [debts, personFilter, monthFilter, yearFilter, onlyOverdue])

  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      if (
        yearFilter === REPORT_FILTER_NONE ||
        monthFilter === REPORT_FILTER_NONE ||
        categoryFilter === REPORT_FILTER_NONE
      ) {
        return false
      }
      if (categoryFilter === '__none__') {
        if (bill.categoryId) return false
      } else if (categoryFilter !== 'all') {
        if (bill.categoryId !== categoryFilter) return false
      }
      if (
        personFilter !== 'all' &&
        personFilter !== REPORT_FILTER_NONE &&
        bill.personId !== personFilter
      ) {
        return false
      }
      if (monthFilter) {
        return bill.dueDate.startsWith(monthFilter)
      }
      if (yearFilter !== 'all') {
        return bill.dueDate.startsWith(yearFilter)
      }
      return true
    })
  }, [bills, personFilter, monthFilter, yearFilter, categoryFilter])

  const hasReportFiltersApplied = useMemo(() => {
    const noScope =
      yearFilter === REPORT_FILTER_NONE &&
      monthFilter === REPORT_FILTER_NONE &&
      categoryFilter === REPORT_FILTER_NONE &&
      !onlyOverdue
    return !noScope
  }, [yearFilter, monthFilter, categoryFilter, onlyOverdue])

  const billsDetailedSorted = useMemo(
    () =>
      [...filteredBills].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [filteredBills],
  )

  const billsDetailedTotal = useMemo(
    () => billsDetailedSorted.reduce((sum, bill) => sum + bill.amount, 0),
    [billsDetailedSorted],
  )

  const billsDetailedPaidTotal = useMemo(
    () =>
      billsDetailedSorted.reduce(
        (sum, bill) => sum + (bill.status === 'paga' ? bill.amount : 0),
        0,
      ),
    [billsDetailedSorted],
  )

  const personSummaries = useMemo(() => {
    const totals = new Map<
      string,
      {
        debtsOpen: number
        debtsPaid: number
        debtsTotal: number
        billsOpen: number
        billsPaid: number
        billsTotal: number
      }
    >()
    const ensure = (personId: string) => {
      if (!totals.has(personId)) {
        totals.set(personId, {
          debtsOpen: 0,
          debtsPaid: 0,
          debtsTotal: 0,
          billsOpen: 0,
          billsPaid: 0,
          billsTotal: 0,
        })
      }
      return totals.get(personId)!
    }

    filteredDebts.forEach((debt) => {
      const current = ensure(debt.personId)
      current.debtsPaid += debt.paidAmount
      current.debtsOpen += Math.max(0, debt.amount - debt.paidAmount)
      current.debtsTotal += debt.amount
    })

    filteredBills.forEach((bill) => {
      if (!bill.personId) return
      const current = ensure(bill.personId)
      current.billsTotal += bill.amount
      if (bill.status === 'paga') {
        current.billsPaid += bill.amount
      } else {
        current.billsOpen += bill.amount
      }
    })

    return Array.from(totals.entries())
      .map(([personId, values]) => ({
        personId,
        ...values,
        balance: values.debtsOpen - values.billsOpen,
        volume: values.debtsTotal + values.billsTotal,
      }))
      .sort((a, b) => b.volume - a.volume)
  }, [filteredDebts, filteredBills])

  const recurringSeries = useMemo(() => {
    const seriesMap = new Map<
      string,
      { title: string; amount: number; recurringEndDate?: string }
    >()
    bills
      .filter((bill) => bill.recurring && bill.recurringActive)
      .filter((bill) => {
        if (categoryFilter === REPORT_FILTER_NONE) return false
        if (categoryFilter === 'all') return true
        if (categoryFilter === '__none__') return !bill.categoryId
        return bill.categoryId === categoryFilter
      })
      .forEach((bill) => {
        if (!seriesMap.has(bill.seriesId)) {
          seriesMap.set(bill.seriesId, {
            title: bill.title,
            amount: bill.amount,
            recurringEndDate: bill.recurringEndDate || '',
          })
        }
      })
    return Array.from(seriesMap.values())
  }, [bills, categoryFilter])

  const projectionMonths = useMemo(() => {
    const start = new Date()
    return Array.from({ length: 6 }, (_, index) =>
      monthKeyFromDate(addMonths(start, index)),
    )
  }, [])

  const filteredProjectionMonths = useMemo(() => {
    if (
      yearFilter === REPORT_FILTER_NONE ||
      monthFilter === REPORT_FILTER_NONE
    ) {
      return []
    }
    return projectionMonths.filter((monthKey) => {
      if (monthFilter) return monthKey === monthFilter
      if (yearFilter !== 'all') return monthKey.startsWith(yearFilter)
      return true
    })
  }, [projectionMonths, monthFilter, yearFilter])

  const projectionTotals = useMemo(() => {
    return filteredProjectionMonths.map((monthKey) => {
      const total = recurringSeries.reduce((sum, series) => {
        if (
          series.recurringEndDate &&
          monthKey > series.recurringEndDate.slice(0, 7)
        ) {
          return sum
        }
        return sum + series.amount
      }, 0)
      return { monthKey, total }
    })
  }, [filteredProjectionMonths, recurringSeries])

  const filterSummary = useMemo(() => {
    const personLabel =
      personFilter === REPORT_FILTER_NONE
        ? 'Nenhum'
        : personFilter === 'all'
          ? 'Todos'
          : peopleMap.get(personFilter) ?? 'Pessoa'
    const yearLabel =
      yearFilter === REPORT_FILTER_NONE
        ? 'Nenhum'
        : yearFilter === 'all'
          ? 'Todos'
          : yearFilter
    const monthLabel =
      monthFilter === REPORT_FILTER_NONE
        ? 'Nenhum'
        : monthFilter
          ? formatMonthLabel(monthFilter)
          : 'Todos'
    const categoryLabel =
      categoryFilter === REPORT_FILTER_NONE
        ? 'Nenhum'
        : categoryFilter === 'all'
          ? 'Todas'
          : categoryFilter === '__none__'
            ? 'Sem categoria'
            : categoriesMap.get(categoryFilter) ?? 'Categoria'
    return { personLabel, yearLabel, monthLabel, categoryLabel }
  }, [personFilter, peopleMap, yearFilter, monthFilter, categoryFilter, categoriesMap])

  const getWhatsappNumber = (personId: string) => {
    const person = people.find((item) => item.id === personId)
    if (!person) return ''
    const raw = (person as { phone?: string }).phone ?? ''
    return raw.replace(/\D/g, '')
  }

  const getWhatsappMessage = () => {
    const monthLabel =
      monthFilter === REPORT_FILTER_NONE
        ? 'Nenhum'
        : monthFilter
          ? formatMonthLabel(monthFilter)
          : 'todos os meses'
    return `Olá! Segue o relatório das nossas contas (${monthLabel}). Caso precise de algo, estou à disposição.`
  }

  const exportDebtsPdf = async () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    await loadPdfFont(doc)
    const nowDate = new Date()
    const dateStamp = nowDate.toISOString().slice(0, 10)
    const personSlug = slugify(filterSummary.personLabel)
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 40
    const headerHeight = 90

    doc.setFillColor(37, 99, 235)
    doc.rect(0, 0, pageWidth, headerHeight, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.text('Finanças Casal Medeiros', margin, 32)
    doc.setFontSize(12)
    doc.text('Relatório de Dívidas', margin, 54)
    doc.setFontSize(10)
    doc.text(`Gerado em ${formatDateTime(nowDate)}`, margin, 72)

    doc.setTextColor(15, 23, 42)
    doc.setFontSize(11)
    doc.text(
      `Pessoa: ${filterSummary.personLabel} • Ano: ${filterSummary.yearLabel} • Mês: ${filterSummary.monthLabel} • Categoria: ${filterSummary.categoryLabel}`,
      margin,
      headerHeight + 24,
    )

    let summaryEndY = headerHeight + 40

    if (personFilter !== REPORT_FILTER_NONE) {
      autoTable(doc, {
        startY: headerHeight + 40,
        head: [
          [
            'Pessoa',
            'Dívidas (total)',
            'A receber',
            'Contas (total)',
            'A pagar',
            'Saldo',
          ],
        ],
        body: personSummaries.map((item) => [
          peopleMap.get(item.personId) ?? 'Pessoa',
          formatCurrency(item.debtsTotal),
          formatCurrency(item.debtsOpen),
          formatCurrency(item.billsTotal),
          formatCurrency(item.billsOpen),
          formatCurrency(item.balance),
        ]),
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          font: 'NotoSans',
        },
        styles: { fontSize: 9, font: 'NotoSans' },
      })
      summaryEndY =
        (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
          ?.finalY ?? headerHeight + 40
    } else {
      doc.setFontSize(10)
      doc.text(
        'Resumo por pessoa omitido (Pessoa: Nenhum — use contas detalhadas ou exportação de contas).',
        margin,
        headerHeight + 44,
      )
      summaryEndY = headerHeight + 62
    }

    const selectedSummary =
      personFilter === 'all' || personFilter === REPORT_FILTER_NONE
        ? null
        : personSummaries.find((item) => item.personId === personFilter)
    if (selectedSummary && summaryEndY) {
      doc.setFontSize(10)
      doc.text(
        `Resumo com ${filterSummary.personLabel}: ` +
          `A receber ${formatCurrency(selectedSummary.debtsOpen)} • ` +
          `A pagar ${formatCurrency(selectedSummary.billsOpen)} • ` +
          `Saldo ${formatCurrency(selectedSummary.balance)}`,
        margin,
        summaryEndY + 14,
      )
    }

    if (detailed) {
      if (personFilter !== REPORT_FILTER_NONE) {
        const sortedDebts = [...filteredDebts].sort((a, b) =>
          a.dueDate.localeCompare(b.dueDate),
        )
        autoTable(doc, {
          startY: summaryEndY + (selectedSummary ? 28 : 16),
          head: [
            [
              'Pessoa',
              'Descrição',
              'Parcela',
              'Vencimento',
              'Valor',
              'Pago',
              'Saldo',
            ],
          ],
          body: sortedDebts.map((debt) => [
            peopleMap.get(debt.personId) ?? 'Pessoa',
            debt.description,
            `${debt.installmentNumber}/${debt.installmentsCount}`,
            debt.dueDate,
            formatCurrency(debt.amount),
            formatCurrency(debt.paidAmount),
            formatCurrency(Math.max(0, debt.amount - debt.paidAmount)),
          ]),
          theme: 'grid',
          headStyles: {
            fillColor: [37, 99, 235],
            textColor: [255, 255, 255],
            font: 'NotoSans',
          },
          styles: { fontSize: 8, font: 'NotoSans' },
        })
      }

      const sortedBills = [...filteredBills].sort((a, b) =>
        a.dueDate.localeCompare(b.dueDate),
      )
      const afterDebtsY =
        personFilter !== REPORT_FILTER_NONE
          ? (doc as jsPDF & { lastAutoTable?: { finalY: number } })
              .lastAutoTable?.finalY
          : undefined
      const billsStartY =
        personFilter !== REPORT_FILTER_NONE && afterDebtsY
          ? afterDebtsY + 16
          : summaryEndY + (selectedSummary ? 28 : 16)
      if (sortedBills.length > 0) {
        autoTable(doc, {
          startY: billsStartY,
          head: [
            [
              'Conta',
              'Categoria',
              'Pessoa',
              'Vencimento',
              'Valor',
              'Status',
            ],
          ],
          body: sortedBills.map((bill) => [
            bill.title,
            categoriesMap.get(bill.categoryId ?? '') ?? 'Sem categoria',
            bill.personId ? peopleMap.get(bill.personId) ?? 'Pessoa' : '—',
            bill.dueDate,
            formatCurrency(bill.amount),
            bill.status === 'paga' ? 'Paga' : 'Em aberto',
          ]),
          theme: 'grid',
          headStyles: {
            fillColor: [22, 163, 74],
            textColor: [255, 255, 255],
            font: 'NotoSans',
          },
          styles: { fontSize: 8, font: 'NotoSans' },
        })
      } else {
        doc.setFontSize(10)
        doc.text('Sem contas para este filtro.', margin, billsStartY + 12)
      }
    }

    doc.save(`relatorio-dividas-${personSlug}-${dateStamp}.pdf`)
  }

  const exportBillsPdf = async () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    await loadPdfFont(doc)
    const nowDate = new Date()
    const dateStamp = nowDate.toISOString().slice(0, 10)
    const personSlug = slugify(filterSummary.personLabel)
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 40
    const headerHeight = 90

    doc.setFillColor(22, 163, 74)
    doc.rect(0, 0, pageWidth, headerHeight, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.text('Finanças Casal Medeiros', margin, 32)
    doc.setFontSize(12)
    doc.text('Relatório de Contas', margin, 54)
    doc.setFontSize(10)
    doc.text(`Gerado em ${formatDateTime(nowDate)}`, margin, 72)

    doc.setTextColor(15, 23, 42)
    doc.setFontSize(11)
    doc.text(
      `Pessoa: ${filterSummary.personLabel} • Ano: ${filterSummary.yearLabel} • Mês: ${filterSummary.monthLabel} • Categoria: ${filterSummary.categoryLabel}`,
      margin,
      headerHeight + 24,
    )

    autoTable(doc, {
      startY: headerHeight + 40,
      head: [['Mês', 'Total projetado']],
      body: projectionTotals.map((item) => [
        formatMonthLabel(item.monthKey),
        formatCurrency(item.total),
      ]),
      theme: 'striped',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        font: 'NotoSans',
      },
      styles: { fontSize: 9, font: 'NotoSans' },
    })

    if (detailed) {
      const sortedBills = [...filteredBills].sort((a, b) =>
        a.dueDate.localeCompare(b.dueDate),
      )
      autoTable(doc, {
        startY: (doc as jsPDF & { lastAutoTable?: { finalY: number } })
          .lastAutoTable?.finalY
          ? (doc as jsPDF & { lastAutoTable?: { finalY: number } })
              .lastAutoTable!.finalY + 16
          : headerHeight + 40,
        head: [
          [
            'Conta',
            'Categoria',
            'Pessoa',
            'Vencimento',
            'Valor',
            'Recorrência',
            'Status',
          ],
        ],
        body: sortedBills.map((bill) => [
          bill.title,
          categoriesMap.get(bill.categoryId ?? '') ?? 'Sem categoria',
          bill.personId ? peopleMap.get(bill.personId) ?? 'Pessoa' : '—',
          bill.dueDate,
          formatCurrency(bill.amount),
          bill.recurring
            ? bill.recurringActive
              ? bill.recurringEndDate
                ? `Até ${bill.recurringEndDate}`
                : 'Recorrente'
              : 'Encerrada'
            : 'Única',
          bill.status === 'paga' ? 'Paga' : 'Em aberto',
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: [22, 163, 74],
          textColor: [255, 255, 255],
          font: 'NotoSans',
        },
        styles: { fontSize: 8, font: 'NotoSans' },
      })
    }

    doc.save(`relatorio-contas-${personSlug}-${dateStamp}.pdf`)
  }

  const handleWhatsappSend = async () => {
    setActionMessage('')
    if (
      personFilter === 'all' ||
      personFilter === REPORT_FILTER_NONE
    ) {
      setActionMessage('Selecione uma pessoa para enviar no WhatsApp.')
      return
    }
    const phone = getWhatsappNumber(personFilter)
    if (!phone) {
      setActionMessage('A pessoa selecionada não possui telefone cadastrado.')
      return
    }
    await exportDebtsPdf()
    const message = encodeURIComponent(getWhatsappMessage())
    const appUrl = `whatsapp://send?phone=${phone}&text=${message}`
    const webUrl = `https://wa.me/${phone}?text=${message}`
    setTimeout(() => {
      window.open(appUrl, '_blank', 'noopener,noreferrer')
      setTimeout(() => {
        window.open(webUrl, '_blank', 'noopener,noreferrer')
      }, 600)
    }, 400)
    setActionMessage(
      'PDF baixado. Agora envie manualmente no WhatsApp aberto.',
    )
  }

  if (!householdId) {
    return (
      <section className="page">
        <div className="card">
          <h3>Selecione um household</h3>
          <p className="muted">
            Para gerar relatórios, escolha um casal em{' '}
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
          <h2>Relatórios</h2>
          <p>Visão analítica das dívidas e projeções de contas.</p>
        </div>
      </header>

      <div className="card">
        <div className="card-header-row">
          <h3>Filtros</h3>
          <div className="list-actions">
            <button className="button secondary" onClick={exportDebtsPdf}>
              Exportar dívidas (PDF)
            </button>
            <button className="button secondary" onClick={exportBillsPdf}>
              Exportar contas (PDF)
            </button>
            <button className="button secondary" onClick={handleWhatsappSend}>
              Enviar por WhatsApp
            </button>
          </div>
        </div>
        {actionMessage && <span className="muted">{actionMessage}</span>}
        <div className="grid-2">
          <label className="inline-field">
            Pessoa
            <select
              value={personFilter}
              onChange={(event) => setPersonFilter(event.target.value)}
            >
              <option value={REPORT_FILTER_NONE}>Nenhum</option>
              <option value="all">Todos</option>
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
                setMonthFilter(REPORT_FILTER_NONE)
              }}
            >
              <option value={REPORT_FILTER_NONE}>Nenhum</option>
              <option value="all">Todos</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            Mês
            <select
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
            >
              <option value={REPORT_FILTER_NONE}>Nenhum</option>
              <option value="">Todos</option>
              {availableMonths
                .filter((month) =>
                  yearFilter === 'all' || yearFilter === REPORT_FILTER_NONE
                    ? true
                    : month.startsWith(yearFilter),
                )
                .map((month) => (
                  <option key={month} value={month}>
                    {formatMonthLabel(month)}
                  </option>
                ))}
            </select>
          </label>
          <label className="inline-field">
            Categoria
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value={REPORT_FILTER_NONE}>Nenhum</option>
              <option value="all">Todas</option>
              <option value="__none__">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            Relatório detalhado
            <input
              type="checkbox"
              checked={detailed}
              onChange={(event) => setDetailed(event.target.checked)}
            />
          </label>
          <label className="inline-field">
            Contas detalhadas
            <input
              type="checkbox"
              checked={showBillsDetailed}
              onChange={(event) => setShowBillsDetailed(event.target.checked)}
            />
          </label>
          <label className="inline-field">
            Somente dívidas vencidas
            <input
              type="checkbox"
              checked={onlyOverdue}
              onChange={(event) => setOnlyOverdue(event.target.checked)}
            />
          </label>
        </div>
      </div>

      {!hasReportFiltersApplied && (
        <p className="muted">
          O resumo <strong>Dívidas por pessoa</strong> aparece quando você
          escolhe ano, mês ou categoria (ou marca somente dívidas vencidas). Com{' '}
          <strong>Pessoa</strong> em <strong>Nenhum</strong>, esse resumo e as
          dívidas detalhadas ficam ocultos (foco em contas).{' '}
          <strong>Nenhum</strong> em ano, mês ou categoria deixa listas vazias.
        </p>
      )}

      {hasReportFiltersApplied && personFilter === REPORT_FILTER_NONE && (
        <p className="muted">
          <strong>Pessoa</strong> em <strong>Nenhum</strong>: sem resumo por
          pessoa nem lista de dívidas — use <strong>Contas detalhadas</strong>{' '}
          (e exportação de contas) para ver contas com os filtros atuais.
        </p>
      )}

      {hasReportFiltersApplied && personFilter !== REPORT_FILTER_NONE && (
        <div className="card">
          <h3>Dívidas por pessoa</h3>
          {personSummaries.length === 0 ? (
            <p className="muted">Nenhum dado para estes filtros.</p>
          ) : (
            <ul className="list">
              {personSummaries.map((item) => (
                <li key={item.personId}>
                  <div>
                    <strong>{peopleMap.get(item.personId) ?? 'Pessoa'}</strong>
                    <small>
                      Dívidas: {formatCurrency(item.debtsTotal)} • A receber:{' '}
                      {formatCurrency(item.debtsOpen)}
                    </small>
                    <small>
                      Contas: {formatCurrency(item.billsTotal)} • A pagar:{' '}
                      {formatCurrency(item.billsOpen)}
                    </small>
                    <small>
                      Saldo com a pessoa: {formatCurrency(item.balance)}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {detailed && personFilter !== REPORT_FILTER_NONE && (
        <div className="card">
          <h3>Dívidas detalhadas</h3>
          {filteredDebts.length === 0 ? (
            <p className="muted">Nenhuma dívida para este filtro.</p>
          ) : (
            <ul className="list">
              {filteredDebts.map((debt) => (
                <li key={debt.id}>
                  <div>
                    <strong>{peopleMap.get(debt.personId) ?? 'Pessoa'}</strong>
                    <span>{debt.description}</span>
                    <small>
                      {formatCurrency(debt.amount)} • parcela{' '}
                      {debt.installmentNumber}/{debt.installmentsCount} • vence{' '}
                      {formatMonthLabel(debt.dueDate.slice(0, 7))}
                    </small>
                    <small>
                      Pago: {formatCurrency(debt.paidAmount)} • saldo{' '}
                      {formatCurrency(
                        Math.max(0, debt.amount - debt.paidAmount),
                      )}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showBillsDetailed && (
        <div className="card">
          <h3>Contas detalhadas</h3>
          <p className="muted">
            Usa os mesmos filtros da seção Filtros acima:{' '}
            <strong>Pessoa</strong>, <strong>Ano</strong>, <strong>Mês</strong> e{' '}
            <strong>Categoria</strong>.
          </p>
          {billsDetailedSorted.length === 0 ? (
            <p className="muted">Nenhuma conta para estes filtros.</p>
          ) : (
            <>
              <ul className="list">
                {billsDetailedSorted.map((bill) => (
                  <li key={bill.id}>
                    <div>
                      <strong>{bill.title}</strong>
                      <span>
                        {categoriesMap.get(bill.categoryId ?? '') ??
                          'Sem categoria'}
                        {bill.personId
                          ? ` • ${peopleMap.get(bill.personId) ?? 'Pessoa'}`
                          : ''}
                      </span>
                      <small>
                        {formatCurrency(bill.amount)} • vence{' '}
                        {formatDate(bill.dueDate)} •{' '}
                        {bill.status === 'paga' ? 'Paga' : 'Em aberto'}
                        {bill.recurring
                          ? bill.recurringActive
                            ? bill.recurringEndDate
                              ? ` • Recorrente até ${formatDate(bill.recurringEndDate)}`
                              : ' • Recorrente'
                            : ' • Recorrência encerrada'
                          : ''}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="muted">
                Total no período:{' '}
                <strong>{formatCurrency(billsDetailedTotal)}</strong>
              </p>
              <p className="muted">
                Pago no período:{' '}
                <strong>{formatCurrency(billsDetailedPaidTotal)}</strong>
              </p>
            </>
          )}
        </div>
      )}

      <div className="card">
        <h3>Projeção de contas (próximos 6 meses)</h3>
        {projectionTotals.length === 0 ? (
          <p className="muted">Nenhuma conta recorrente ativa.</p>
        ) : (
          <ul className="list">
            {projectionTotals.map((item) => (
              <li key={item.monthKey}>
                <div>
                  <strong>{formatMonthLabel(item.monthKey)}</strong>
                  <small>{formatCurrency(item.total)}</small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
