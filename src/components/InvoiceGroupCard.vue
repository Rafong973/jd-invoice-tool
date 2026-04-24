<template>
  <div class="group-card card">
    <div class="card-header">
      <div class="header-left">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="allSelected"
            :indeterminate.prop="indeterminate"
            @change="toggleSelectAll"
          />
          <h3 class="org-name">{{ group.displayName || group.orgName }}</h3>
        </label>
      </div>
      <span class="total">
        已选 {{ selectedCount }}/{{ group.orders.length }} 笔
        <template v-if="selectedCount > 0">
          &nbsp;合计 ¥{{ selectedTotal.toFixed(2) }}
        </template>
      </span>
    </div>
    <div class="card-body">
      <div class="order-list">
        <div
          v-for="(order, index) in group.orders"
          :key="order.orderId ?? index"
          class="order-item"
          :class="{ selected: selectedIds.has(index) }"
          @click="toggleOrder(index)"
        >
          <input
            type="checkbox"
            class="order-checkbox"
            :checked="selectedIds.has(index)"
            @click.stop
            @change.stop="toggleOrder(index)"
          />
          <div class="order-content">
            <span class="sku">{{ getMergeOrderSku(order) }}</span>
            <div class="meta-row">
              <span>下单 {{ formatMergeDateTime(getMergeOrderOrderTime(order)) }}</span>
              <span>开票 {{ formatMergeDateTime(getMergeOrderInvoiceTime(order)) }}</span>
              <span>公司 {{ getMergeOrderCompany(order) || '--' }}</span>
              <span>抬头 {{ getMergeOrderTitle(order) || '--' }}</span>
              <span v-if="!isMergeOrderAmountResolved(order)" class="amount-warning">金额未校准</span>
            </div>
          </div>
          <span class="price">¥{{ formatMergeOrderAmount(order) }}</span>
        </div>
      </div>
    </div>
    <div class="card-actions">
      <button
        class="btn btn-primary"
        :disabled="selectedCount === 0 || !canExchangeSelection"
        @click="$emit('exchange', group, getSelectedOrders())"
      >
        申请换开 ({{ selectedCount }})
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DisplayMergeGroup, MergeOrder } from '@/types'
import {
  formatMergeDateTime,
  formatMergeOrderAmount,
  getMergeOrderAmount,
  getMergeOrderCompany,
  getMergeOrderInvoiceTime,
  getMergeOrderOrderTime,
  getMergeOrderSku,
  getMergeOrderTitle,
  isMergeOrderAmountResolved,
} from '@/utils/mergeOrder'

const props = defineProps<{
  group: DisplayMergeGroup
}>()

defineEmits<{
  exchange: [group: DisplayMergeGroup, orders: MergeOrder[]]
}>()

const selectedIds = ref<Set<number>>(new Set())

const selectedCount = computed(() => selectedIds.value.size)

const allSelected = computed(() => selectedIds.value.size === props.group.orders.length && props.group.orders.length > 0)

const indeterminate = computed(() => {
  const count = selectedIds.value.size
  return count > 0 && count < props.group.orders.length
})

const selectedTotal = computed(() => {
  let sum = 0
  for (const id of selectedIds.value) {
    sum += getMergeOrderAmount(props.group.orders[id])
  }
  return sum
})

const canExchangeSelection = computed(() => {
  if (props.group.kind !== 'smart') {
    return true
  }

  return selectedTotal.value >= 100
})

watch(
  () => props.group.orders,
  () => {
    selectedIds.value = new Set()
  },
)

function toggleOrder(index: number) {
  if (selectedIds.value.has(index)) {
    selectedIds.value.delete(index)
  } else {
    selectedIds.value.add(index)
  }
  selectedIds.value = new Set(selectedIds.value)
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value.clear()
  } else {
    for (let index = 0; index < props.group.orders.length; index += 1) {
      selectedIds.value.add(index)
    }
  }
  selectedIds.value = new Set(selectedIds.value)
}

function getSelectedOrders(): MergeOrder[] {
  return Array.from(selectedIds.value).map((index) => props.group.orders[index])
}
</script>

<style scoped>
.group-card {
  transition: box-shadow 0.2s;
}

.group-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}

.header-left {
  flex: 1;
  min-width: 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #e2231a;
}

.org-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.total {
  font-size: 14px;
  font-weight: 600;
  color: #e2231a;
  white-space: nowrap;
}

.card-body {
  margin-bottom: 12px;
}

.order-list {
  max-height: 320px;
  overflow-y: auto;
}

.order-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  font-size: 13px;
  border-bottom: 1px solid #f5f5f5;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.order-item:last-child {
  border-bottom: none;
}

.order-item:hover {
  background-color: #fafafa;
}

.order-item.selected {
  background-color: #fff5f5;
}

.order-checkbox {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: #e2231a;
  flex-shrink: 0;
}

.order-content {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.sku {
  color: #333;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: #666;
  font-size: 12px;
}

.amount-warning {
  color: #b54708;
  background: #fff4e5;
  border-radius: 999px;
  padding: 2px 8px;
  font-weight: 600;
}

.price {
  color: #333;
  font-weight: 600;
  white-space: nowrap;
}

.card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
}

@media (max-width: 720px) {
  .card-header {
    flex-direction: column;
    align-items: stretch;
  }

  .total {
    white-space: normal;
  }

  .order-item {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .price {
    grid-column: 2;
    justify-self: end;
  }
}
</style>
