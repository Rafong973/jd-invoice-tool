<template>
  <div class="invoice-card card">
    <div class="card-header">
      <div class="header-left">
        <span class="title">{{ invoice.ivcTitle }}</span>
        <span class="status-badge" :class="statusClass">{{ statusText }}</span>
        <span v-if="invoice.isJd" class="tag-jd">自营</span>
      </div>
      <span class="amount">¥{{ invoice.amount || '-' }}</span>
    </div>
    <div class="card-body">
      <div class="info-row">
        <span class="label">订单号:</span>
        <span class="value">{{ invoice.orderId }}</span>
      </div>
      <div class="info-row">
        <span class="label">商品:</span>
        <span class="value">{{ productsText }}</span>
      </div>
      <div class="info-row" v-if="invoice.venderName">
        <span class="label">店铺:</span>
        <span class="value">{{ invoice.venderName }}</span>
      </div>
      <div class="info-row">
        <span class="label">发票类型:</span>
        <span class="value">{{ invoice.ivcContentName }}</span>
      </div>
    </div>
    <div class="card-actions">
      <button class="btn btn-secondary" @click="$emit('download', invoice)">
        下载
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { InvoiceItem } from '@/types'

const props = defineProps<{
  invoice: InvoiceItem
}>()

defineEmits<{
  download: [invoice: InvoiceItem]
}>()

const statusText = computed(() => {
  switch (props.invoice.ivcStatus) {
    case '0': return '待开票'
    case '1': return '已开票'
    case '2': return '开票中'
    case '3': return '已作废'
    case '4': return '开票失败'
    default: return '未知'
  }
})

const statusClass = computed(() => {
  switch (props.invoice.ivcStatus) {
    case '0': return 'status-info'
    case '1': return 'status-success'
    case '2': return 'status-warning'
    case '3': return 'status-danger'
    case '4': return 'status-danger'
    default: return 'status-default'
  }
})

const productsText = computed(() => {
  if (!props.invoice.products || props.invoice.products.length === 0) return '-'
  return props.invoice.products.map((p: Record<string, unknown>) => p.name as string).join('、')
})
</script>

<style scoped>
.invoice-card {
  transition: box-shadow 0.2s;
}

.invoice-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title {
  font-weight: 600;
  font-size: 14px;
  color: #333;
}

.status-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.tag-jd {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: #f0f0f0;
  color: #666;
}

.status-success {
  background-color: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.status-warning {
  background-color: #fffbe6;
  color: #faad14;
  border: 1px solid #ffe58f;
}

.status-info {
  background-color: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
}

.status-danger {
  background-color: #fff2f0;
  color: #ff4d4f;
  border: 1px solid #ffccc7;
}

.status-default {
  background-color: #fafafa;
  color: #999;
  border: 1px solid #d9d9d9;
}

.amount {
  font-weight: 700;
  font-size: 16px;
  color: #e2231a;
  white-space: nowrap;
}

.card-body {
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 4px;
}

.label {
  color: #999;
  min-width: 70px;
}

.value {
  color: #666;
  word-break: break-all;
}

.card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
}
</style>
