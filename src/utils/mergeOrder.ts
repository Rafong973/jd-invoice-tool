import type { MergeFilters, MergeGroup, MergeOrder } from '@/types'

export const DEFAULT_MERGE_FILTERS: MergeFilters = {
  amountMin: '',
  amountMax: '',
  dateStart: '',
  dateEnd: '',
  ivcTitles: [],
}

function readText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return ''
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function getMergeOrderAmount(order: MergeOrder): number {
  const ivcAmount = readNumber(order.ivcAmount ?? order.totalAmount)
  const actualPayMoney = readNumber(order.actualPayMoney)

  if (ivcAmount !== null && actualPayMoney !== null && ivcAmount > actualPayMoney) {
    return Math.max(ivcAmount - actualPayMoney, 0)
  }

  return ivcAmount ?? 0
}

export function formatMergeOrderAmount(order: MergeOrder): string {
  return getMergeOrderAmount(order).toFixed(2)
}

export function getMergeOrderSku(order: MergeOrder): string {
  const detailList = order.detailList
  if (Array.isArray(detailList) && detailList.length > 0) {
    const first = detailList[0]
    if (first && typeof first === 'object' && 'skuName' in first) {
      return readText(first.skuName) || '商品'
    }
  }
  return '商品'
}

export function getMergeOrderCompany(order: MergeOrder): string {
  return readText(order.ivcCompany)
}

export function getMergeOrderTitle(order: MergeOrder): string {
  return readText(order.ivcTitle)
}

export function getMergeOrderOrderTime(order: MergeOrder): string {
  return readText(order.orderTime)
}

export function getMergeOrderInvoiceTime(order: MergeOrder): string {
  return readText(order.ivcTime)
}

export function formatMergeDateTime(value: string): string {
  if (!value) {
    return '--'
  }
  return value.length > 16 ? value.slice(0, 16) : value
}

function getMergeOrderFilterDate(order: MergeOrder): string {
  const source = getMergeOrderInvoiceTime(order) || getMergeOrderOrderTime(order)
  return source ? source.slice(0, 10) : ''
}

function matchesAmount(order: MergeOrder, filters: MergeFilters): boolean {
  const amount = getMergeOrderAmount(order)
  const min = filters.amountMin ? Number.parseFloat(filters.amountMin) : Number.NaN
  const max = filters.amountMax ? Number.parseFloat(filters.amountMax) : Number.NaN

  if (Number.isFinite(min) && amount < min) {
    return false
  }
  if (Number.isFinite(max) && amount > max) {
    return false
  }
  return true
}

function matchesDate(order: MergeOrder, filters: MergeFilters): boolean {
  const dateValue = getMergeOrderFilterDate(order)

  if (filters.dateStart && (!dateValue || dateValue < filters.dateStart)) {
    return false
  }
  if (filters.dateEnd && (!dateValue || dateValue > filters.dateEnd)) {
    return false
  }

  return true
}

function matchesTitleFields(order: MergeOrder, filters: MergeFilters): boolean {
  const title = getMergeOrderTitle(order)

  if (filters.ivcTitles.length > 0 && !filters.ivcTitles.includes(title)) {
    return false
  }

  return true
}

function matchesFilters(order: MergeOrder, filters: MergeFilters): boolean {
  return matchesAmount(order, filters) && matchesDate(order, filters) && matchesTitleFields(order, filters)
}

export function filterMergeGroups(groups: MergeGroup[], filters: MergeFilters): MergeGroup[] {
  return groups
    .map((group) => {
      const orders = group.orders.filter((order) => matchesFilters(order, filters))
      return {
        ...group,
        orders,
        total: orders.reduce((sum, order) => sum + getMergeOrderAmount(order), 0),
      }
    })
    .filter((group) => group.orders.length > 0)
}
