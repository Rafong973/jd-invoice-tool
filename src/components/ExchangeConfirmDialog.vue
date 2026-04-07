<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3>确认换开发票</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <div class="confirm-info">
          <div class="info-row">
            <span class="label">开票方:</span>
            <span class="value">{{ group?.orgName }}</span>
          </div>
          <div class="info-row">
            <span class="label">订单数:</span>
            <span class="value">{{ selectedOrders.length }} 笔</span>
          </div>
          <div class="info-row">
            <span class="label">合计金额:</span>
            <span class="value amount">¥{{ selectedTotal.toFixed(2) }}</span>
          </div>
        </div>

        <div class="title-section">
          <label class="label">选择发票抬头</label>
          <select v-model="selectedTitleId" class="select">
            <option value="">请选择发票抬头</option>
            <optgroup label="个人">
              <option
                v-for="t in personalTitles"
                :key="t.id"
                :value="t.id"
              >
                {{ t.titleName }} - {{ t.email }}{{ t.isDefault ? ' (默认)' : '' }}
              </option>
            </optgroup>
            <optgroup label="公司">
              <option
                v-for="t in companyTitles"
                :key="t.id"
                :value="t.id"
              >
                {{ t.titleName }} - {{ t.taxNo }} - {{ t.email }}{{ t.isDefault ? ' (默认)' : '' }}
              </option>
            </optgroup>
          </select>
        </div>

        <div class="order-preview">
          <h4>已选订单</h4>
          <div class="order-list">
            <div v-for="(order, i) in selectedOrders" :key="i" class="order-item">
              <span class="sku">{{ getSkuName(order) }}</span>
              <span class="price">¥{{ getOrderAmount(order) }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">取消</button>
        <button class="btn btn-primary" :disabled="!selectedTitleId" @click="$emit('confirm', selectedTitleId)">
          确认换开
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import type { MergeGroup } from '@/types'
import type { InvoiceTitle } from '@/types/title'

const props = defineProps<{
  visible: boolean
  group: MergeGroup | null
  selectedOrders: Record<string, unknown>[]
  titles: InvoiceTitle[]
}>()

defineEmits<{
  close: []
  confirm: [titleId: string]
}>()

const selectedTitleId = ref('')

watch(() => props.visible, (val) => {
  if (val) {
    const defaultTitle = props.titles.find((t) => t.isDefault)
    selectedTitleId.value = defaultTitle?.id || ''
  }
})

const personalTitles = computed(() => props.titles.filter((t) => t.titleType === 'personal'))
const companyTitles = computed(() => props.titles.filter((t) => t.titleType === 'company'))

const selectedTotal = computed(() => {
  return props.selectedOrders.reduce((sum, o) => {
    const val = (o as Record<string, unknown>).ivcAmount ?? (o as Record<string, unknown>).totalAmount
    const num = typeof val === 'string' ? parseFloat(val) : (typeof val === 'number' ? val : 0)
    return sum + num
  }, 0)
})

function getSkuName(order: Record<string, unknown>): string {
  const detailList = order.detailList as Record<string, unknown>[] | undefined
  if (detailList && detailList.length > 0) {
    return (detailList[0].skuName as string) || '商品'
  }
  return '商品'
}

function getOrderAmount(order: Record<string, unknown>): string {
  const val = order.ivcAmount ?? order.totalAmount
  if (typeof val === 'string') return val
  if (typeof val === 'number') return val.toFixed(2)
  return '0'
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  width: 480px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
  padding: 0 4px;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.confirm-info {
  background: #fafafa;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  margin-bottom: 6px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.label {
  color: #999;
}

.value {
  color: #333;
}

.value.amount {
  color: #e2231a;
  font-weight: 600;
}

.title-section {
  margin-bottom: 16px;
}

.title-section .label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
}

.select:focus {
  border-color: #e2231a;
}

.order-preview h4 {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 8px;
  color: #333;
}

.order-list {
  max-height: 150px;
  overflow-y: auto;
}

.order-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid #f5f5f5;
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

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #eee;
}
</style>
