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
            <span class="label">分组:</span>
            <span class="value">{{ groupTitle }}</span>
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
              <option v-for="title in personalTitles" :key="title.id" :value="title.id">
                {{ title.titleName }} - {{ title.email }}{{ title.isDefault ? ' (默认)' : '' }}
              </option>
            </optgroup>
            <optgroup label="公司">
              <option v-for="title in companyTitles" :key="title.id" :value="title.id">
                {{ title.titleName }} - {{ title.taxNo }} - {{ title.email }}{{ title.isDefault ? ' (默认)' : '' }}
              </option>
            </optgroup>
          </select>
        </div>

        <div class="order-preview">
          <h4>已选订单</h4>
          <div class="order-list">
            <div v-for="(order, index) in selectedOrders" :key="order.orderId ?? index" class="order-item">
              <div class="order-main">
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
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">取消</button>
        <button class="btn btn-primary" :disabled="!selectedTitleId || submitting" @click="$emit('confirm', selectedTitleId)">
          {{ submitting ? '提交中...' : '确认换开' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DisplayMergeGroup, MergeOrder } from '@/types'
import type { InvoiceTitle } from '@/types/title'
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
  visible: boolean
  group: DisplayMergeGroup | null
  selectedOrders: MergeOrder[]
  titles: InvoiceTitle[]
  submitting?: boolean
}>()

defineEmits<{
  close: []
  confirm: [titleId: string]
}>()

const selectedTitleId = ref('')

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      const defaultTitle = props.titles.find((title) => title.isDefault)
      selectedTitleId.value = defaultTitle?.id || ''
    }
  },
)

const personalTitles = computed(() => props.titles.filter((title) => title.titleType === 'personal'))
const companyTitles = computed(() => props.titles.filter((title) => title.titleType === 'company'))

const selectedTotal = computed(() => props.selectedOrders.reduce((sum, order) => sum + getMergeOrderAmount(order), 0))

const groupTitle = computed(() => props.group?.displayName || props.group?.orgName || '--')
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  width: 560px;
  max-width: 92vw;
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

.amount-warning {
  color: #b54708;
  background: #fff4e5;
  border-radius: 999px;
  padding: 2px 8px;
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
  max-height: 220px;
  overflow-y: auto;
}

.order-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px solid #f5f5f5;
}

.order-main {
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

.price {
  color: #333;
  font-weight: 600;
  white-space: nowrap;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #eee;
}

@media (max-width: 640px) {
  .order-item {
    flex-direction: column;
  }

  .price {
    align-self: flex-end;
  }
}
</style>
