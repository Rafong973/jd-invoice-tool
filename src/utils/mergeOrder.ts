import type { DisplayMergeGroup, MergeFilters, MergeGroup, MergeOrder } from '@/types'

const SMART_THRESHOLD_CENTS = 10000
const SMART_MAX_CENTS = 19999
const SMART_EXACT_SEARCH_LIMIT = 18

type SmartCandidate = {
  amountCents: number
  order: MergeOrder
  orderId: string
  orderTimeKey: number
}

type SmartSearchState = {
  combos: number[][]
  comboCount: number
}

type SmartSolution = {
  combos: number[][]
  comboCount: number
  excesses: number[]
  usedOrderTimes: number[]
  usedIndices: number[]
}

type GreedyComboState = {
  indices: number[]
  orderTimeKeys: number[]
}

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

function toAmountCents(amount: number): number {
  return Math.round(amount * 100)
}

function parseOrderTimeKey(order: MergeOrder): number {
  const raw = getMergeOrderOrderTime(order)
  if (!raw) {
    return Number.MAX_SAFE_INTEGER
  }

  const parsed = Date.parse(raw.replace(' ', 'T'))
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER
}

function compareNumberVectors(left: number[], right: number[]): number {
  const size = Math.min(left.length, right.length)
  for (let index = 0; index < size; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index]
    }
  }
  return left.length - right.length
}

function compareStringVectors(left: string[], right: string[]): number {
  const size = Math.min(left.length, right.length)
  for (let index = 0; index < size; index += 1) {
    if (left[index] !== right[index]) {
      return left[index].localeCompare(right[index])
    }
  }
  return left.length - right.length
}

function summarizeSolution(candidates: SmartCandidate[], combos: number[][]): SmartSolution {
  const excesses = combos
    .map((combo) => combo.reduce((sum, index) => sum + candidates[index].amountCents, 0) - SMART_THRESHOLD_CENTS)
    .sort((left, right) => left - right)

  const usedIndices = combos.flat().sort((left, right) => left - right)
  const usedOrderTimes = usedIndices
    .map((index) => candidates[index].orderTimeKey)
    .sort((left, right) => left - right)

  return {
    combos: combos.map((combo) => [...combo]),
    comboCount: combos.length,
    excesses,
    usedOrderTimes,
    usedIndices,
  }
}

function compareSolutions(left: SmartSolution | null, right: SmartSolution | null): number {
  if (!left && !right) {
    return 0
  }
  if (!left) {
    return -1
  }
  if (!right) {
    return 1
  }
  if (left.comboCount !== right.comboCount) {
    return left.comboCount - right.comboCount
  }

  const excessComparison = compareNumberVectors(
    right.excesses,
    left.excesses,
  )
  if (excessComparison !== 0) {
    return excessComparison
  }

  const usedTimeComparison = compareNumberVectors(
    right.usedOrderTimes,
    left.usedOrderTimes,
  )
  if (usedTimeComparison !== 0) {
    return usedTimeComparison
  }

  return compareNumberVectors(
    right.usedIndices,
    left.usedIndices,
  )
}

function sortSmartCandidates(orders: MergeOrder[]): SmartCandidate[] {
  return orders
    .map((order, index) => ({
      amountCents: toAmountCents(getMergeOrderAmount(order)),
      order,
      orderId: readText(order.orderId) || `${index}`,
      orderTimeKey: parseOrderTimeKey(order),
    }))
    .filter((candidate) => candidate.amountCents > 0 && candidate.amountCents < SMART_THRESHOLD_CENTS)
    .sort((left, right) => {
      if (left.orderTimeKey !== right.orderTimeKey) {
        return left.orderTimeKey - right.orderTimeKey
      }
      if (left.amountCents !== right.amountCents) {
        return left.amountCents - right.amountCents
      }
      return left.orderId.localeCompare(right.orderId)
    })
}

function sortComboCandidates(candidates: SmartCandidate[], combos: number[][]): number[][] {
  return combos.sort((left, right) => {
    const leftSum = left.reduce((sum, index) => sum + candidates[index].amountCents, 0)
    const rightSum = right.reduce((sum, index) => sum + candidates[index].amountCents, 0)
    const leftExcess = leftSum - SMART_THRESHOLD_CENTS
    const rightExcess = rightSum - SMART_THRESHOLD_CENTS

    if (leftExcess !== rightExcess) {
      return leftExcess - rightExcess
    }

    const leftTimes = left.map((index) => candidates[index].orderTimeKey).sort((a, b) => a - b)
    const rightTimes = right.map((index) => candidates[index].orderTimeKey).sort((a, b) => a - b)
    const timeComparison = compareNumberVectors(leftTimes, rightTimes)
    if (timeComparison !== 0) {
      return timeComparison
    }

    const leftIds = left.map((index) => candidates[index].orderId).sort((a, b) => a.localeCompare(b))
    const rightIds = right.map((index) => candidates[index].orderId).sort((a, b) => a.localeCompare(b))
    return compareStringVectors(leftIds, rightIds)
  })
}

function buildSmartCombosExact(candidates: SmartCandidate[]): SmartCandidate[][] {
  if (candidates.length === 0) {
    return []
  }

  const used = Array.from({ length: candidates.length }, () => false)
  let best: SmartSolution | null = null

  function findFirstUnusedIndex(): number {
    for (let index = 0; index < used.length; index += 1) {
      if (!used[index]) {
        return index
      }
    }
    return -1
  }

  function getRemainingSum(): number {
    let sum = 0
    for (let index = 0; index < candidates.length; index += 1) {
      if (!used[index]) {
        sum += candidates[index].amountCents
      }
    }
    return sum
  }

  function updateBest(state: SmartSearchState): void {
    const solution = summarizeSolution(candidates, state.combos)
    if (compareSolutions(solution, best) > 0) {
      best = solution
    }
  }

  function enumerateCombos(
    startIndex: number,
    sumCents: number,
    combo: number[],
    result: number[][],
  ): void {
    if (sumCents >= SMART_THRESHOLD_CENTS) {
      result.push([...combo])
      return
    }

    for (let index = startIndex; index < candidates.length; index += 1) {
      if (used[index]) {
        continue
      }

      const nextSum = sumCents + candidates[index].amountCents
      if (nextSum > SMART_MAX_CENTS) {
        continue
      }

      combo.push(index)
      enumerateCombos(index + 1, nextSum, combo, result)
      combo.pop()
    }
  }

  function search(state: SmartSearchState): void {
    const remainingSum = getRemainingSum()
    const maxPossible = state.comboCount + Math.floor(remainingSum / SMART_THRESHOLD_CENTS)
    if (best && maxPossible < best.comboCount) {
      return
    }

    const firstUnused = findFirstUnusedIndex()
    if (firstUnused === -1 || remainingSum < SMART_THRESHOLD_CENTS) {
      updateBest(state)
      return
    }

    const comboCandidates: number[][] = []
    used[firstUnused] = true
    enumerateCombos(
      firstUnused + 1,
      candidates[firstUnused].amountCents,
      [firstUnused],
      comboCandidates,
    )
    used[firstUnused] = false

    if (comboCandidates.length > 0) {
      sortComboCandidates(candidates, comboCandidates)

      for (const combo of comboCandidates) {
        combo.forEach((index) => {
          used[index] = true
        })
        state.combos.push(combo)
        state.comboCount += 1
        search(state)
        state.comboCount -= 1
        state.combos.pop()
        combo.forEach((index) => {
          used[index] = false
        })
      }
    }

    const skipRemainingSum = remainingSum - candidates[firstUnused].amountCents
    const skipMaxPossible = state.comboCount + Math.floor(skipRemainingSum / SMART_THRESHOLD_CENTS)
    if (!best || skipMaxPossible >= best.comboCount) {
      used[firstUnused] = true
      search(state)
      used[firstUnused] = false
    }
  }

  search({
    combos: [],
    comboCount: 0,
  })

  if (!best) {
    return []
  }

  const finalCombos = (best as SmartSolution).combos
  return finalCombos.map((combo: number[]) => combo.map((index: number) => candidates[index]))
}

function compareGreedyStates(left: GreedyComboState | null, right: GreedyComboState | null): number {
  if (!left && !right) {
    return 0
  }
  if (!left) {
    return -1
  }
  if (!right) {
    return 1
  }

  const timeComparison = compareNumberVectors(right.orderTimeKeys, left.orderTimeKeys)
  if (timeComparison !== 0) {
    return timeComparison
  }

  return compareNumberVectors(right.indices, left.indices)
}

function findBestGreedyCombo(candidates: SmartCandidate[]): SmartCandidate[] {
  const dp: Array<GreedyComboState | null> = Array.from({ length: SMART_MAX_CENTS + 1 }, () => null)
  dp[0] = {
    indices: [],
    orderTimeKeys: [],
  }

  candidates.forEach((candidate, index) => {
    for (let sum = SMART_MAX_CENTS - candidate.amountCents; sum >= 0; sum -= 1) {
      const previous = dp[sum]
      if (!previous) {
        continue
      }

      const nextSum = sum + candidate.amountCents
      const nextState: GreedyComboState = {
        indices: [...previous.indices, index],
        orderTimeKeys: [...previous.orderTimeKeys, candidate.orderTimeKey],
      }

      if (compareGreedyStates(nextState, dp[nextSum]) > 0) {
        dp[nextSum] = nextState
      }
    }
  })

  let bestSum = -1
  let bestState: GreedyComboState | null = null

  for (let sum = SMART_THRESHOLD_CENTS; sum <= SMART_MAX_CENTS; sum += 1) {
    const state = dp[sum]
    if (!state) {
      continue
    }

    if (bestSum === -1 || sum < bestSum) {
      bestSum = sum
      bestState = state
      continue
    }

    if (sum === bestSum && compareGreedyStates(state, bestState) > 0) {
      bestState = state
    }
  }

  if (!bestState) {
    return []
  }

  return bestState.indices.map((index) => candidates[index])
}

function buildSmartCombosGreedy(candidates: SmartCandidate[]): SmartCandidate[][] {
  const remaining = [...candidates]
  const combos: SmartCandidate[][] = []

  while (remaining.length > 0) {
    const combo = findBestGreedyCombo(remaining)
    if (combo.length === 0) {
      break
    }

    combos.push(combo)

    const usedIds = new Set(combo.map((candidate) => candidate.orderId))
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (usedIds.has(remaining[index].orderId)) {
        remaining.splice(index, 1)
      }
    }
  }

  return combos
}

function buildSmartCombos(candidates: SmartCandidate[]): SmartCandidate[][] {
  if (candidates.length <= SMART_EXACT_SEARCH_LIMIT) {
    return buildSmartCombosExact(candidates)
  }

  return buildSmartCombosGreedy(candidates)
}

function sortDisplayGroups(groups: DisplayMergeGroup[]): DisplayMergeGroup[] {
  return groups.sort((left, right) => {
    const leftTimes = left.orders.map((order) => parseOrderTimeKey(order)).sort((a, b) => a - b)
    const rightTimes = right.orders.map((order) => parseOrderTimeKey(order)).sort((a, b) => a - b)
    const timeComparison = compareNumberVectors(leftTimes, rightTimes)
    if (timeComparison !== 0) {
      return timeComparison
    }

    if (left.total !== right.total) {
      return left.total - right.total
    }

    return left.displayName.localeCompare(right.displayName)
  })
}

export function getMergeOrderAmount(order: MergeOrder): number {
  const resolvedAmount = readNumber(order.resolvedAmount)
  if (resolvedAmount !== null) {
    return resolvedAmount
  }

  const ivcAmount = readNumber(order.ivcAmount ?? order.totalAmount)
  const actualPayMoney = readNumber(order.actualPayMoney)

  if (ivcAmount !== null && actualPayMoney !== null && ivcAmount > actualPayMoney) {
    return Math.max(ivcAmount - actualPayMoney, 0)
  }

  return ivcAmount ?? 0
}

export function isMergeOrderAmountResolved(order: MergeOrder): boolean {
  return readNumber(order.resolvedAmount) !== null || order.amountResolved === true
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

export function buildOriginalDisplayGroups(groups: MergeGroup[]): DisplayMergeGroup[] {
  return groups.map((group) => ({
    ...group,
    sourceOrgName: group.orgName,
    displayName: group.orgName,
    kind: 'original',
  }))
}

export function buildSmartMergeGroups(groups: MergeGroup[]): DisplayMergeGroup[] {
  const result: DisplayMergeGroup[] = []

  groups.forEach((group) => {
    const readyOrders = group.orders.filter((order) => getMergeOrderAmount(order) >= 100)
    const smartGroups: DisplayMergeGroup[] = readyOrders.map((order) => ({
      orgName: group.orgName,
      total: getMergeOrderAmount(order),
      orders: [order],
      sourceOrgName: group.orgName,
      displayName: '',
      kind: 'smart',
    }))

    const smartCombos = buildSmartCombos(sortSmartCandidates(group.orders))
    smartCombos.forEach((combo) => {
      const orders = combo.map((candidate) => candidate.order)
      smartGroups.push({
        orgName: group.orgName,
        total: orders.reduce((sum, order) => sum + getMergeOrderAmount(order), 0),
        orders,
        sourceOrgName: group.orgName,
        displayName: '',
        kind: 'smart',
      })
    })

    sortDisplayGroups(smartGroups).forEach((smartGroup, index) => {
      smartGroup.comboIndex = index + 1
      smartGroup.displayName = `${group.orgName} - 推荐组合 ${index + 1}`
      result.push(smartGroup)
    })
  })

  return result
}
