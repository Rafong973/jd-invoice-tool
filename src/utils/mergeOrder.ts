import type { DisplayMergeGroup, MergeFilters, MergeGroup, MergeOrder } from '@/types'

const SMART_THRESHOLD_CENTS = 10000
const SMART_MAX_CENTS = 19999
// Exact search becomes expensive quickly because this is a set-packing problem.
// Keep the exact path for smaller seller groups and fall back to the fast DP-based
// heuristic before the UI thread becomes noticeably slow.
const SMART_EXACT_SEARCH_LIMIT = 14

type SmartCandidate = {
  amountCents: number
  order: MergeOrder
  orderId: string
  orderTimeKey: number
}

type SmartMaskSolution = {
  comboMasks: number[]
  comboCount: number
  comboTimeSpreads: number[]
  usedOrderTimes: number[]
  usedIndices: number[]
}

type GreedyComboState = {
  indices: number[]
  orderTimeKeys: number[]
  timeSpread: number
}

export const DEFAULT_MERGE_FILTERS: MergeFilters = {
  amountMin: '',
  amountMax: '',
  comboAmountMin: '',
  comboAmountMax: '',
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

function isSmartExchangeEligibleAmount(amount: number): boolean {
  return toAmountCents(amount) >= SMART_THRESHOLD_CENTS
}

function parseOrderTimeKey(order: MergeOrder): number {
  const raw = getMergeOrderOrderTime(order)
  if (!raw) {
    return Number.MAX_SAFE_INTEGER
  }

  const parsed = Date.parse(raw.replace(' ', 'T'))
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER
}

function parseSmartAgeTimeKey(order: MergeOrder): number {
  const raw = getMergeOrderInvoiceTime(order) || getMergeOrderOrderTime(order)
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

function sortSmartCandidates(orders: MergeOrder[]): SmartCandidate[] {
  return orders
    .map((order, index) => ({
      amountCents: toAmountCents(getMergeOrderAmount(order)),
      order,
      orderId: readText(order.orderId) || `${index}`,
      orderTimeKey: parseSmartAgeTimeKey(order),
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

function insertSortedNumber(values: number[], next: number): number[] {
  const result = [...values]
  let index = 0
  while (index < result.length && result[index] <= next) {
    index += 1
  }
  result.splice(index, 0, next)
  return result
}

function mergeSortedNumbers(left: number[], right: number[]): number[] {
  const result: number[] = []
  let leftIndex = 0
  let rightIndex = 0

  while (leftIndex < left.length || rightIndex < right.length) {
    if (rightIndex >= right.length || (leftIndex < left.length && left[leftIndex] <= right[rightIndex])) {
      result.push(left[leftIndex])
      leftIndex += 1
      continue
    }

    result.push(right[rightIndex])
    rightIndex += 1
  }

  return result
}

function getLowestBitIndex(mask: number): number {
  return 31 - Math.clz32(mask & -mask)
}

function getIndicesFromMask(mask: number): number[] {
  const result: number[] = []
  let currentMask = mask

  while (currentMask !== 0) {
    const lowestBit = currentMask & -currentMask
    result.push(31 - Math.clz32(lowestBit))
    currentMask ^= lowestBit
  }

  return result
}

function buildComboOrderTimes(candidates: SmartCandidate[], mask: number): number[] {
  return getIndicesFromMask(mask).map((index) => candidates[index].orderTimeKey)
}

function getNumberRange(values: number[]): number {
  if (values.length <= 1) {
    return 0
  }

  return values[values.length - 1] - values[0]
}

function buildComboTimeSpread(candidates: SmartCandidate[], mask: number): number {
  return getNumberRange(buildComboOrderTimes(candidates, mask).sort((left, right) => left - right))
}

function compareMaskSolutions(left: SmartMaskSolution | null, right: SmartMaskSolution | null): number {
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

  const spreadComparison = compareNumberVectors(
    right.comboTimeSpreads,
    left.comboTimeSpreads,
  )
  if (spreadComparison !== 0) {
    return spreadComparison
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

function buildSmartCombosExact(candidates: SmartCandidate[]): SmartCandidate[][] {
  if (candidates.length === 0) {
    return []
  }

  const fullMask = (1 << candidates.length) - 1
  const subsetSums = new Int32Array(fullMask + 1)
  const validComboMasksByFirst = Array.from({ length: candidates.length }, () => [] as number[])

  for (let mask = 1; mask <= fullMask; mask += 1) {
    const lowestBit = mask & -mask
    const index = getLowestBitIndex(lowestBit)
    const previousMask = mask ^ lowestBit
    const sum = subsetSums[previousMask] + candidates[index].amountCents
    subsetSums[mask] = sum

    if (sum >= SMART_THRESHOLD_CENTS && sum <= SMART_MAX_CENTS) {
      validComboMasksByFirst[index].push(mask)
    }
  }

  validComboMasksByFirst.forEach((masks) => {
    masks.sort((left, right) => {
      const leftSpread = buildComboTimeSpread(candidates, left)
      const rightSpread = buildComboTimeSpread(candidates, right)
      if (leftSpread !== rightSpread) {
        return leftSpread - rightSpread
      }

      const leftTimes = buildComboOrderTimes(candidates, left)
      const rightTimes = buildComboOrderTimes(candidates, right)
      const timeComparison = compareNumberVectors(leftTimes, rightTimes)
      if (timeComparison !== 0) {
        return timeComparison
      }

      return compareNumberVectors(getIndicesFromMask(left), getIndicesFromMask(right))
    })
  })

  const solutionCache: Array<SmartMaskSolution | null | undefined> = Array.from({ length: fullMask + 1 }, () => undefined)

  function search(mask: number): SmartMaskSolution | null {
    if (mask === 0 || subsetSums[mask] < SMART_THRESHOLD_CENTS) {
      return {
        comboMasks: [],
        comboCount: 0,
        comboTimeSpreads: [],
        usedOrderTimes: [],
        usedIndices: [],
      }
    }

    const cached = solutionCache[mask]
    if (cached !== undefined) {
      return cached
    }

    const firstIndex = getLowestBitIndex(mask)
    let best = search(mask ^ (1 << firstIndex))
    const maxPossibleCount = Math.floor(subsetSums[mask] / SMART_THRESHOLD_CENTS)

    if (!best || best.comboCount <= maxPossibleCount) {
      for (const comboMask of validComboMasksByFirst[firstIndex]) {
        if ((comboMask & mask) !== comboMask) {
          continue
        }

        const remainder = search(mask ^ comboMask)
        if (!remainder) {
          continue
        }

        const comboIndices = getIndicesFromMask(comboMask)
        const comboSolution: SmartMaskSolution = {
          comboMasks: [comboMask, ...remainder.comboMasks],
          comboCount: remainder.comboCount + 1,
          comboTimeSpreads: insertSortedNumber(remainder.comboTimeSpreads, buildComboTimeSpread(candidates, comboMask)),
          usedOrderTimes: mergeSortedNumbers(
            buildComboOrderTimes(candidates, comboMask),
            remainder.usedOrderTimes,
          ),
          usedIndices: mergeSortedNumbers(comboIndices, remainder.usedIndices),
        }

        if (compareMaskSolutions(comboSolution, best) > 0) {
          best = comboSolution
        }
      }
    }

    solutionCache[mask] = best
    return best
  }

  const best = search(fullMask)
  if (!best) {
    return []
  }

  return best.comboMasks.map((comboMask) =>
    getIndicesFromMask(comboMask).map((index) => candidates[index]),
  )
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

  if (left.timeSpread !== right.timeSpread) {
    return right.timeSpread - left.timeSpread
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
    timeSpread: 0,
  }

  candidates.forEach((candidate, index) => {
    for (let sum = SMART_MAX_CENTS - candidate.amountCents; sum >= 0; sum -= 1) {
      const previous = dp[sum]
      if (!previous) {
        continue
      }

      const nextSum = sum + candidate.amountCents
      const orderTimeKeys = insertSortedNumber(previous.orderTimeKeys, candidate.orderTimeKey)
      const nextState: GreedyComboState = {
        indices: [...previous.indices, index],
        orderTimeKeys,
        timeSpread: getNumberRange(orderTimeKeys),
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

    if (!bestState) {
      bestSum = sum
      bestState = state
      continue
    }

    const stateComparison = compareGreedyStates(state, bestState)
    if (stateComparison > 0 || (stateComparison === 0 && sum < bestSum)) {
      bestSum = sum
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

export function getMergeOrderId(order: MergeOrder): string {
  return readText(order.orderId)
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

export function buildSmartMergeGroups(groups: MergeGroup[], heldOrderIds: Set<string> = new Set()): DisplayMergeGroup[] {
  const result: DisplayMergeGroup[] = []

  groups.forEach((group) => {
    const availableOrders = group.orders.filter((order) => !heldOrderIds.has(getMergeOrderId(order)))
    const readyOrders = availableOrders.filter((order) => isSmartExchangeEligibleAmount(getMergeOrderAmount(order)))
    const smartGroups: DisplayMergeGroup[] = readyOrders.map((order) => ({
      orgName: group.orgName,
      total: getMergeOrderAmount(order),
      orders: [order],
      sourceOrgName: group.orgName,
      displayName: '',
      kind: 'smart',
    }))

    const smartCombos = buildSmartCombos(sortSmartCandidates(availableOrders))
    smartCombos.forEach((combo) => {
      const orders = combo.map((candidate) => candidate.order)
      const total = orders.reduce((sum, order) => sum + getMergeOrderAmount(order), 0)
      if (!isSmartExchangeEligibleAmount(total)) {
        return
      }

      smartGroups.push({
        orgName: group.orgName,
        total,
        orders,
        sourceOrgName: group.orgName,
        displayName: '',
        kind: 'smart',
      })
    })

    sortDisplayGroups(smartGroups.filter((smartGroup) => isSmartExchangeEligibleAmount(smartGroup.total))).forEach((smartGroup, index) => {
      smartGroup.comboIndex = index + 1
      smartGroup.displayName = `${group.orgName} - 推荐组合 ${index + 1}`
      result.push(smartGroup)
    })
  })

  return result
}
