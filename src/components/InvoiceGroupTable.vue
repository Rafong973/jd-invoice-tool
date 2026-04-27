<template>
  <div class="invoice-group-table card">
    <div class="table-toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">发票分组表</span>
        <span class="toolbar-tip">表头可排序，智能凑单可 Hold 单张发票后重新生成组合</span>
      </div>
      <div class="toolbar-actions">
        <button
          v-if="mode === 'smart'"
          class="btn btn-secondary btn-small"
          @click="toggleSelectAllExchangeableGroups"
        >
          {{ allExchangeableGroupsSelected ? '取消全选' : '全选可换开组合' }}
        </button>
          <span v-if="mode === 'smart'" class="selected-summary">已选 {{ selectedExchangeableGroups.length }} 组</span>
        <label class="group-field">
          <span>分组</span>
          <select :value="groupBy" class="mini-select" @change="handleGroupByChange">
            <option value="none">不分组</option>
            <option value="sourceOrgName">开票方</option>
            <option value="title">发票抬头</option>
            <option value="company">公司</option>
            <option v-if="mode === 'smart'" value="availability">换开状态</option>
            <option value="kind">分组类型</option>
          </select>
        </label>
      </div>
    </div>

    <div class="table-scroll">
      <table class="invoice-table">
        <thead>
          <tr>
            <th class="select-col">选择</th>
            <th>
              <button class="th-btn" @click="toggleSort('group')">组合/开票方 {{ sortMark('group') }}</button>
            </th>
            <th>
              <button class="th-btn" @click="toggleSort('orders')">订单数 {{ sortMark('orders') }}</button>
            </th>
            <th>
              <button class="th-btn" @click="toggleSort('selected')">已选订单 {{ sortMark('selected') }}</button>
            </th>
            <th>
              <button class="th-btn" @click="toggleSort('total')">可换开金额 {{ sortMark('total') }}</button>
            </th>
            <th>
              <button class="th-btn" @click="toggleSort('invoiceTime')">最近开票 {{ sortMark('invoiceTime') }}</button>
            </th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody :key="tableRenderKey">
          <template v-for="section in groupedRows" :key="section.key">
            <tr
              v-if="groupBy !== 'none'"
              class="section-row"
            >
              <td colspan="7">
                <button class="section-toggle" @click="toggleSection(section.key)">
                  <span>{{ collapsedSections.has(section.key) ? '展开' : '收起' }}</span>
                  <strong>{{ section.label }}</strong>
                  <span>{{ section.rows.length }} 组</span>
                  <span>￥{{ section.total.toFixed(2) }}</span>
                </button>
              </td>
            </tr>

            <template v-if="groupBy === 'none' || !collapsedSections.has(section.key)">
              <template v-for="row in section.rows" :key="row.id">
                <tr
                  class="group-row"
                  :class="{ expanded: expandedRows.has(row.id), disabled: !row.exchangeable }"
                >
                  <td class="select-col">
                    <input
                      type="checkbox"
                      :checked="isAllSelected(row.id)"
                      :indeterminate="isIndeterminate(row.id)"
                      :disabled="!row.exchangeable"
                      @change="toggleSelectAll(row.id)"
                    />
                  </td>
                  <td>
                    <button class="expand-btn" @click="toggleExpanded(row.id)">
                      {{ expandedRows.has(row.id) ? '收起' : '展开' }}
                    </button>
                    <span class="group-name">{{ row.group.displayName || row.group.orgName }}</span>
                    <span v-if="mode === 'smart'" class="kind-pill" :class="{ muted: !row.exchangeable }">
                      {{ row.exchangeable ? '可换开' : '筛选外' }}
                    </span>
                  </td>
                  <td>{{ row.group.orders.length }}</td>
                  <td>
                    {{ getSelectedCount(row.id) }}/{{ row.group.orders.length }}
                    <template v-if="getSelectedCount(row.id) > 0">，合计 ￥{{ getSelectedTotal(row).toFixed(2) }}</template>
                  </td>
                  <td class="amount">￥{{ row.group.total.toFixed(2) }}</td>
                  <td>{{ row.latestInvoiceTime || '--' }}</td>
                  <td>
                    <button
                      class="btn btn-primary btn-small"
                      :disabled="getSelectedCount(row.id) === 0 || !canExchange(row)"
                      @click="emitExchange(row)"
                    >
                      申请换开
                    </button>
                  </td>
                </tr>

                <tr v-if="expandedRows.has(row.id)" class="orders-row">
                  <td></td>
                  <td colspan="6">
                    <table class="order-table">
                      <thead>
                        <tr>
                          <th>选择</th>
                          <th><button class="th-btn" @click="toggleOrderSort('sku')">商品 {{ orderSortMark('sku') }}</button></th>
                          <th><button class="th-btn" @click="toggleOrderSort('amount')">金额 {{ orderSortMark('amount') }}</button></th>
                          <th><button class="th-btn" @click="toggleOrderSort('orderTime')">下单时间 {{ orderSortMark('orderTime') }}</button></th>
                          <th><button class="th-btn" @click="toggleOrderSort('invoiceTime')">开票时间 {{ orderSortMark('invoiceTime') }}</button></th>
                          <th>公司</th>
                          <th>抬头</th>
                          <th v-if="mode === 'smart'">Hold</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="orderRow in getSortedOrders(row)" :key="orderRow.key">
                          <td>
                            <input
                              type="checkbox"
                              :checked="isOrderSelected(row.id, orderRow.index)"
                              :disabled="!row.exchangeable"
                              @change="toggleOrder(row.id, orderRow.index)"
                            />
                          </td>
                          <td class="sku-cell">
                            {{ getMergeOrderSku(orderRow.order) }}
                            <span v-if="!isMergeOrderAmountResolved(orderRow.order)" class="amount-warning">金额未校准</span>
                          </td>
                          <td class="amount">￥{{ formatMergeOrderAmount(orderRow.order) }}</td>
                          <td>{{ formatMergeDateTime(getMergeOrderOrderTime(orderRow.order)) }}</td>
                          <td>{{ formatMergeDateTime(getMergeOrderInvoiceTime(orderRow.order)) }}</td>
                          <td>{{ getMergeOrderCompany(orderRow.order) || '--' }}</td>
                          <td>{{ getMergeOrderTitle(orderRow.order) || '--' }}</td>
                          <td v-if="mode === 'smart'">
                            <button
                              class="hold-btn"
                              type="button"
                              @click="emitToggleHold(orderRow.order)"
                            >
                              {{ isOrderHeld(orderRow.order) ? '取消 Hold' : 'Hold' }}
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </template>
            </template>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DisplayMergeGroup, ExchangeMode, MergeOrder } from '@/types'
import {
  formatMergeDateTime,
  formatMergeOrderAmount,
  getMergeOrderAmount,
  getMergeOrderCompany,
  getMergeOrderId,
  getMergeOrderInvoiceTime,
  getMergeOrderOrderTime,
  getMergeOrderSku,
  getMergeOrderTitle,
  isMergeOrderAmountResolved,
} from '@/utils/mergeOrder'

type GroupBy = 'none' | 'sourceOrgName' | 'title' | 'company' | 'availability' | 'kind'
type SortKey = 'group' | 'orders' | 'selected' | 'total' | 'invoiceTime'
type OrderSortKey = 'sku' | 'amount' | 'orderTime' | 'invoiceTime'
type SortDirection = 'asc' | 'desc'

interface TableRow {
  id: string
  group: DisplayMergeGroup
  sourceIndex: number
  latestInvoiceTime: string
  exchangeable: boolean
}

const props = defineProps<{
  groups: DisplayMergeGroup[]
  secondaryGroups?: DisplayMergeGroup[]
  heldOrderIds?: Set<string>
  mode: ExchangeMode
}>()

const emit = defineEmits<{
  exchange: [group: DisplayMergeGroup, orders: MergeOrder[]]
  selectionChange: [groups: DisplayMergeGroup[]]
  toggleHold: [order: MergeOrder]
}>()

const groupBy = ref<GroupBy>(getDefaultGroupBy(props.mode))
const sortKey = ref<SortKey>('total')
const sortDirection = ref<SortDirection>('desc')
const orderSortKey = ref<OrderSortKey>('invoiceTime')
const orderSortDirection = ref<SortDirection>('desc')
const selectedIds = ref<Record<string, number[]>>({})
const expandedRows = ref<Set<string>>(new Set())
const collapsedSections = ref<Set<string>>(new Set())
const renderVersion = ref(0)

const rows = computed<TableRow[]>(() => {
  const primaryRows = props.groups.map((group, index) => buildRow(group, index, true))
  const secondaryRows = (props.secondaryGroups ?? []).map((group, index) => buildRow(group, index, false))
  return [...primaryRows, ...secondaryRows]
})

const rowById = computed(() => new Map(rows.value.map((row) => [row.id, row])))

const orderedRows = computed(() => {
  return [...rows.value].sort(compareRows)
})

const groupedRows = computed(() => {
  const sections = new Map<string, { key: string, label: string, rows: TableRow[], total: number }>()
  for (const row of orderedRows.value) {
    const key = getSectionKey(row)
    const label = getSectionLabel(row)
    const section = sections.get(key) ?? { key, label, rows: [], total: 0 }
    section.rows.push(row)
    section.total += row.group.total
    sections.set(key, section)
  }

  return Array.from(sections.values()).sort((left, right) => {
    if (groupBy.value === 'availability') {
      return getAvailabilitySort(left.key) - getAvailabilitySort(right.key)
    }

    return left.label.localeCompare(right.label, 'zh-CN')
  })
})

const exchangeableRows = computed(() => rows.value.filter((row) => row.exchangeable))

const selectedExchangeableGroups = computed(() => exchangeableRows.value.filter((row) => isAllSelected(row.id)).map((row) => row.group))

const allExchangeableGroupsSelected = computed(() => {
  return exchangeableRows.value.length > 0 && selectedExchangeableGroups.value.length === exchangeableRows.value.length
})

watch(selectedExchangeableGroups, (groups) => {
  emit('selectionChange', groups)
})

watch(rows, (nextRows) => {
  const validIds = new Set(nextRows.map((row) => row.id))

  const nextSelected: Record<string, number[]> = {}
  for (const row of nextRows) {
    const existing = selectedIds.value[row.id] ?? []
    nextSelected[row.id] = existing.filter((index) => index >= 0 && index < row.group.orders.length)
  }
  selectedIds.value = nextSelected
  expandedRows.value = new Set(Array.from(expandedRows.value).filter((id) => validIds.has(id)))
}, { immediate: true })

watch(groupedRows, (sections) => {
  const validKeys = new Set(sections.map((section) => section.key))
  collapsedSections.value = new Set(Array.from(collapsedSections.value).filter((key) => validKeys.has(key)))
}, { immediate: true })

watch(groupBy, () => {
  resetGroupingState()
})

watch(() => props.mode, (nextMode) => {
  groupBy.value = getDefaultGroupBy(nextMode)
  resetTableState()
})

function getDefaultGroupBy(nextMode: ExchangeMode): GroupBy {
  return nextMode === 'smart' ? 'availability' : 'none'
}

function resetTableState() {
  selectedIds.value = {}
  expandedRows.value = new Set()
  collapsedSections.value = new Set()
}

const tableRenderKey = computed(() => `${groupBy.value}-${renderVersion.value}`)

function handleGroupByChange(event: Event) {
  const target = event.target as HTMLSelectElement
  groupBy.value = target.value as GroupBy
}

function resetGroupingState() {
  collapsedSections.value = new Set(groupedRows.value.map((section) => section.key))
  renderVersion.value += 1
}

function buildRow(group: DisplayMergeGroup, index: number, exchangeable: boolean): TableRow {
  return {
    id: getGroupId(group, index, exchangeable),
    group,
    sourceIndex: index,
    latestInvoiceTime: getLatestInvoiceTime(group.orders),
    exchangeable,
  }
}

function getGroupId(group: DisplayMergeGroup, index: number, exchangeable: boolean): string {
  const orderIds = group.orders.map((order) => order.orderId ?? '').join('|')
  return [exchangeable ? 'primary' : 'secondary', group.kind, group.sourceOrgName, group.comboIndex ?? index, orderIds, group.orders.length].join('::')
}

function getLatestInvoiceTime(orders: MergeOrder[]): string {
  const times = orders
    .map((order) => getMergeOrderInvoiceTime(order))
    .filter(Boolean)
    .sort()
  return times.length > 0 ? times[times.length - 1] : ''
}

function getSectionKey(row: TableRow): string {
  return groupBy.value === 'none' ? 'none' : `${groupBy.value}:${getSectionLabel(row)}`
}

function getSectionLabel(row: TableRow): string {
  if (groupBy.value === 'availability') {
    return row.exchangeable ? '可换开推荐组合' : '筛选外组合'
  }
  if (groupBy.value === 'title') {
    return getFirstValue(row.group.orders, getMergeOrderTitle) || '无抬头'
  }
  if (groupBy.value === 'company') {
    return getFirstValue(row.group.orders, getMergeOrderCompany) || '无公司'
  }
  if (groupBy.value === 'kind') {
    return row.group.kind === 'smart' ? '推荐组合' : '原始分组'
  }
  return row.group.sourceOrgName || row.group.orgName || '未知开票方'
}

function getAvailabilitySort(sectionKey: string): number {
  return sectionKey.includes('可换开推荐组合') ? 0 : 1
}

function getFirstValue(orders: MergeOrder[], getter: (order: MergeOrder) => string): string {
  return orders.map(getter).find(Boolean) ?? ''
}

function compareRows(left: TableRow, right: TableRow): number {
  const factor = sortDirection.value === 'asc' ? 1 : -1
  if (sortKey.value === 'orders') {
    return (left.group.orders.length - right.group.orders.length) * factor
  }
  if (sortKey.value === 'selected') {
    return (getSelectedCount(left.id) - getSelectedCount(right.id)) * factor
  }
  if (sortKey.value === 'total') {
    return (left.group.total - right.group.total) * factor
  }
  if (sortKey.value === 'invoiceTime') {
    return left.latestInvoiceTime.localeCompare(right.latestInvoiceTime) * factor
  }
  return (left.group.displayName || left.group.orgName).localeCompare(right.group.displayName || right.group.orgName, 'zh-CN') * factor
}

function toggleSort(nextKey: SortKey) {
  if (sortKey.value === nextKey) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortKey.value = nextKey
  sortDirection.value = nextKey === 'group' ? 'asc' : 'desc'
}

function sortMark(key: SortKey): string {
  if (sortKey.value !== key) {
    return '↕'
  }
  return sortDirection.value === 'asc' ? '↑' : '↓'
}

function toggleOrderSort(nextKey: OrderSortKey) {
  if (orderSortKey.value === nextKey) {
    orderSortDirection.value = orderSortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }
  orderSortKey.value = nextKey
  orderSortDirection.value = nextKey === 'sku' ? 'asc' : 'desc'
}

function orderSortMark(key: OrderSortKey): string {
  if (orderSortKey.value !== key) {
    return '↕'
  }
  return orderSortDirection.value === 'asc' ? '↑' : '↓'
}

function getSortedOrders(row: TableRow) {
  const factor = orderSortDirection.value === 'asc' ? 1 : -1
  return row.group.orders
    .map((order, index) => ({ order, index, key: `${order.orderId ?? index}-${index}` }))
    .sort((left, right) => {
      if (orderSortKey.value === 'amount') {
        return (getMergeOrderAmount(left.order) - getMergeOrderAmount(right.order)) * factor
      }
      if (orderSortKey.value === 'orderTime') {
        return getMergeOrderOrderTime(left.order).localeCompare(getMergeOrderOrderTime(right.order)) * factor
      }
      if (orderSortKey.value === 'invoiceTime') {
        return getMergeOrderInvoiceTime(left.order).localeCompare(getMergeOrderInvoiceTime(right.order)) * factor
      }
      return getMergeOrderSku(left.order).localeCompare(getMergeOrderSku(right.order), 'zh-CN') * factor
    })
}

function getSelectedIndexes(rowId: string): number[] {
  return selectedIds.value[rowId] ?? []
}

function getSelectedCount(rowId: string): number {
  return getSelectedIndexes(rowId).length
}

function getSelectedTotal(row: TableRow): number {
  return getSelectedIndexes(row.id).reduce((sum, index) => sum + getMergeOrderAmount(row.group.orders[index]), 0)
}

function isAllSelected(rowId: string): boolean {
  const row = rowById.value.get(rowId)
  return Boolean(row && row.group.orders.length > 0 && getSelectedCount(rowId) === row.group.orders.length)
}

function isIndeterminate(rowId: string): boolean {
  const row = rowById.value.get(rowId)
  const count = getSelectedCount(rowId)
  return Boolean(row && count > 0 && count < row.group.orders.length)
}

function isOrderSelected(rowId: string, index: number): boolean {
  return getSelectedIndexes(rowId).includes(index)
}

function toggleSelectAll(rowId: string) {
  const row = rowById.value.get(rowId)
  if (!row || !row.exchangeable) {
    return
  }

  selectedIds.value = {
    ...selectedIds.value,
    [rowId]: isAllSelected(rowId) ? [] : row.group.orders.map((_, index) => index),
  }
}

function toggleOrder(rowId: string, index: number) {
  const row = rowById.value.get(rowId)
  if (!row || !row.exchangeable) {
    return
  }

  const selected = new Set(getSelectedIndexes(rowId))
  if (selected.has(index)) {
    selected.delete(index)
  } else {
    selected.add(index)
  }

  selectedIds.value = {
    ...selectedIds.value,
    [rowId]: Array.from(selected).sort((left, right) => left - right),
  }
}

function toggleExpanded(rowId: string) {
  const next = new Set(expandedRows.value)
  if (next.has(rowId)) {
    next.delete(rowId)
  } else {
    next.add(rowId)
  }
  expandedRows.value = next
}

function toggleSection(sectionKey: string) {
  const next = new Set(collapsedSections.value)
  if (next.has(sectionKey)) {
    next.delete(sectionKey)
  } else {
    next.add(sectionKey)
  }
  collapsedSections.value = next
}

function canExchange(row: TableRow): boolean {
  return row.exchangeable && (row.group.kind !== 'smart' || getSelectedTotal(row) >= 100)
}

function emitExchange(row: TableRow) {
  const orders = getSelectedIndexes(row.id).map((index) => row.group.orders[index])
  emit('exchange', row.group, orders)
}

function isOrderHeld(order: MergeOrder): boolean {
  const orderId = getMergeOrderId(order)
  return Boolean(orderId && props.heldOrderIds?.has(orderId))
}

function emitToggleHold(order: MergeOrder) {
  emit('toggleHold', order)
}

function toggleSelectAllExchangeableGroups() {
  if (allExchangeableGroupsSelected.value) {
    const next = { ...selectedIds.value }
    exchangeableRows.value.forEach((row) => {
      next[row.id] = []
    })
    selectedIds.value = next
    return
  }

  const next = { ...selectedIds.value }
  exchangeableRows.value.forEach((row) => {
    next[row.id] = row.group.orders.map((_, index) => index)
  })
  selectedIds.value = next
}
</script>

<style scoped>
.invoice-group-table {
  padding: 0;
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.toolbar-left {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
}

.toolbar-title {
  font-weight: 600;
  color: #333;
}

.toolbar-tip {
  color: #999;
  font-size: 13px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.selected-summary {
  color: #666;
  font-size: 13px;
  white-space: nowrap;
}

.group-field {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 13px;
  white-space: nowrap;
}

.mini-select {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 6px 8px;
  background: #fff;
  color: #333;
}

.table-scroll {
  overflow-x: auto;
}

.invoice-table,
.order-table {
  width: 100%;
  border-collapse: collapse;
}

.invoice-table th,
.invoice-table td,
.order-table th,
.order-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f2f2f2;
  text-align: left;
  font-size: 13px;
  vertical-align: middle;
}

.invoice-table th,
.order-table th {
  color: #666;
  font-weight: 600;
  background: #fafafa;
  white-space: nowrap;
}

.th-btn {
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.th-btn:hover {
  color: #e2231a;
}

.select-col {
  width: 56px;
  text-align: center !important;
}

.section-row {
  background: #fff7f6;
}

.section-row td {
  border-bottom-color: #ffe3e0;
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  border: 0;
  background: transparent;
  color: #333;
  cursor: pointer;
  text-align: left;
}

.group-row {
  background: #fff;
}

.group-row:hover,
.group-row.expanded {
  background: #fffdf7;
}

.group-row.disabled {
  color: #999;
  background: #fafafa;
}

.expand-btn {
  border: 0;
  background: transparent;
  color: #666;
  cursor: pointer;
  margin-right: 6px;
}

.group-name {
  font-weight: 600;
}

.kind-pill,
.amount-warning {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f5f5f5;
  color: #666;
  font-size: 12px;
  font-weight: 500;
}

.amount-warning {
  background: #fff4e5;
  color: #b54708;
}

.kind-pill.muted {
  background: #eee;
  color: #999;
}

.amount {
  color: #e2231a;
  font-weight: 600;
  white-space: nowrap;
}

.btn-small {
  padding: 6px 10px;
  font-size: 13px;
  white-space: nowrap;
}

.hold-btn {
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  color: #555;
  cursor: pointer;
  font-size: 12px;
  padding: 5px 8px;
  white-space: nowrap;
}

.hold-btn:hover {
  color: #e2231a;
  border-color: #e2231a;
}

.orders-row > td {
  background: #fcfcfc;
  padding-top: 0;
}

.order-table {
  margin: 6px 0;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 6px;
  overflow: hidden;
}

.sku-cell {
  min-width: 240px;
  max-width: 360px;
}

input[type='checkbox'] {
  width: 15px;
  height: 15px;
  cursor: pointer;
  accent-color: #e2231a;
}

@media (max-width: 720px) {
  .table-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .invoice-table,
  .order-table {
    min-width: 980px;
  }
}
</style>

