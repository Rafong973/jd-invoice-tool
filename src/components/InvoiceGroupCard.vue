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
          <h3 class="org-name">{{ group.orgName }}</h3>
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
          :key="index"
          class="order-item"
          :class="{ selected: selectedIds.has(index) }"
          @click="toggleOrder(index)"
        >
          <input
            type="checkbox"
            class="order-checkbox"
            :checked="selectedIds.has(index)"
            @change.stop="toggleOrder(index)"
          />
          <span class="sku">{{ getDetailSku(order) }}</span>
          <span class="price">¥{{ getOrderAmount(order) }}</span>
        </div>
      </div>
    </div>
    <div class="card-actions">
      <button
        class="btn btn-primary"
        :disabled="selectedCount === 0"
        @click="$emit('exchange', group, getSelectedOrders())"
      >
        申请换开 ({{ selectedCount }})
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { MergeGroup } from '@/types'

const props = defineProps<{
  group: MergeGroup
}>()

defineEmits<{
  exchange: [group: MergeGroup, orders: Record<string, unknown>[]]
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
    sum += extractAmount(props.group.orders[id])
  }
  return sum
})

function extractAmount(order: Record<string, unknown>): number {
  const val = order.ivcAmount ?? order.totalAmount
  if (typeof val === 'string') return parseFloat(val) || 0
  if (typeof val === 'number') return val
  return 0
}

function getOrderAmount(order: Record<string, unknown>): string {
  const val = order.ivcAmount ?? order.totalAmount
  if (typeof val === 'string') return val
  if (typeof val === 'number') return val.toFixed(2)
  return '0'
}

function getDetailSku(order: Record<string, unknown>): string {
  const detailList = order.detailList as Record<string, unknown>[] | undefined
  if (detailList && detailList.length > 0) {
    return (detailList[0].skuName as string) || '商品'
  }
  return '商品'
}

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
    for (let i = 0; i < props.group.orders.length; i++) {
      selectedIds.value.add(i)
    }
  }
  selectedIds.value = new Set(selectedIds.value)
}

function getSelectedOrders(): Record<string, unknown>[] {
  return Array.from(selectedIds.value).map(i => props.group.orders[i])
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

.checkbox-label input[type="checkbox"] {
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
  max-height: 240px;
  overflow-y: auto;
}

.order-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
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

.sku {
  color: #666;
  flex: 1;
  margin-right: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.price {
  color: #333;
  font-weight: 500;
  white-space: nowrap;
}

.card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
}
</style>
