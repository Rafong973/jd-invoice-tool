<template>
  <div class="exchange-view">
    <div class="page-header">
      <h2>换开发票</h2>
      <div class="actions">
        <button class="btn btn-primary" :disabled="store.loading" @click="loadGroups">
          {{ store.loading ? '处理中...' : '获取可换开发票' }}
        </button>
      </div>
    </div>

    <div v-if="store.error" class="error-msg">
      {{ store.error }}
    </div>

    <div v-if="!store.hasFetchedMergeGroups && !store.loading" class="empty">
      <p>点击按钮获取可换开的发票分组</p>
      <button class="btn btn-primary" @click="loadGroups">开始获取</button>
    </div>

    <div v-else-if="store.mergeGroups.length === 0 && store.hasFetchedMergeGroups && !store.loading" class="empty">
      <p>暂无可换开的发票数据</p>
      <button class="btn btn-primary" @click="loadGroups">重新获取</button>
    </div>

    <div v-else class="groups">
      <p class="summary">共 {{ store.mergeGroups.length }} 个开票方，可换开金额合计 ¥{{ totalAmount }}</p>
      <InvoiceGroupCard
        v-for="(group, index) in store.mergeGroups"
        :key="index"
        :group="group"
        @exchange="handleExchange"
      />
    </div>

    <LoadingOverlay :visible="store.loading" text="正在获取换开发票数据..." />

    <ExchangeConfirmDialog
      :visible="showConfirmDialog"
      :group="confirmGroup"
      :selected-orders="confirmOrders"
      :titles="store.titles"
      @close="showConfirmDialog = false"
      @confirm="handleConfirmExchange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import type { MergeGroup } from '@/types'
import InvoiceGroupCard from '@/components/InvoiceGroupCard.vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import ExchangeConfirmDialog from '@/components/ExchangeConfirmDialog.vue'

const store = useAppStore()

const showConfirmDialog = ref(false)
const confirmGroup = ref<MergeGroup | null>(null)
const confirmOrders = ref<Record<string, unknown>[]>([])

onMounted(() => {
  store.loadTitles()
})

const totalAmount = computed(() => {
  return store.mergeGroups.reduce((sum: number, g: MergeGroup) => sum + g.total, 0).toFixed(2)
})

async function loadGroups() {
  await store.loadMergeGroups()
}

function handleExchange(group: MergeGroup, orders: Record<string, unknown>[]) {
  confirmGroup.value = group
  confirmOrders.value = orders
  showConfirmDialog.value = true
}

async function handleConfirmExchange(titleId: string) {
  const title = store.titles.find((t) => t.id === titleId)
  if (!title) {
    alert('请选择发票抬头')
    return
  }
  const total = confirmOrders.value.reduce((sum, o) => {
    const val = (o as Record<string, unknown>).ivcAmount ?? (o as Record<string, unknown>).totalAmount
    const num = typeof val === 'string' ? parseFloat(val) : (typeof val === 'number' ? val : 0)
    return sum + num
  }, 0)
  alert(`换开成功！\n开票方: ${confirmGroup.value?.orgName}\n抬头: ${title.titleName}\n邮箱: ${title.email}${title.taxNo ? '\n税号: ' + title.taxNo : ''}\n金额: ¥${total.toFixed(2)}\n订单数: ${confirmOrders.value.length}`)
  showConfirmDialog.value = false
}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  font-size: 20px;
  font-weight: 600;
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.empty p {
  margin-bottom: 16px;
  font-size: 16px;
}

.summary {
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
  padding: 10px 14px;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 6px;
}

.groups {
  display: grid;
  gap: 12px;
}
</style>
