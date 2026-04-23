<template>
  <div class="exchange-view">
    <div class="page-header">
      <h2>换开发票</h2>
      <div class="actions">
        <button class="btn btn-primary" :disabled="store.loading" @click="loadGroups">
          {{ store.loading ? '处理中...' : '获取可换开发票' }}
        </button>
        <button class="btn btn-secondary" :disabled="store.loading" @click="showFilters = !showFilters">
          {{ showFilters ? '收起筛选' : '筛选条件' }}
        </button>
      </div>
    </div>

    <div v-if="showFilters" class="filter-panel card">
      <div class="filter-grid">
        <label class="field">
          <span class="field-label">金额下限</span>
          <input v-model="filters.amountMin" type="number" min="0" step="0.01" class="input" placeholder="不限" />
        </label>
        <label class="field">
          <span class="field-label">金额上限</span>
          <input v-model="filters.amountMax" type="number" min="0" step="0.01" class="input" placeholder="不限" />
        </label>
        <label class="field">
          <span class="field-label">开票日期开始</span>
          <input v-model="filters.dateStart" type="date" class="input" />
        </label>
        <label class="field">
          <span class="field-label">开票日期结束</span>
          <input v-model="filters.dateEnd" type="date" class="input" />
        </label>
        <label class="field">
          <span class="field-label">现有发票抬头</span>
          <select v-model="filters.ivcTitles" class="input multi-select" multiple>
            <option v-for="title in titleOptions" :key="title" :value="title">
              {{ title }}
            </option>
          </select>
        </label>
      </div>
      <div class="filter-actions">
        <span class="filter-tip">可按金额、日期和现有发票抬头多选筛选。</span>
        <button class="btn btn-secondary" @click="resetFilters">恢复默认筛选</button>
      </div>
    </div>

    <div v-if="store.error" class="error-msg">
      {{ store.error }}
    </div>

    <div v-if="!store.hasFetchedMergeGroups && !store.loading" class="empty">
      <p>点击按钮获取可换开的发票分组</p>
      <button class="btn btn-primary" @click="loadGroups">开始获取</button>
    </div>

    <div v-else-if="filteredGroups.length === 0 && store.hasFetchedMergeGroups && !store.loading" class="empty">
      <p>{{ store.mergeGroups.length === 0 ? '暂无可换开的发票数据' : '当前筛选条件下暂无可换开的发票' }}</p>
      <div class="empty-actions">
        <button class="btn btn-primary" @click="loadGroups">重新获取</button>
        <button v-if="store.mergeGroups.length > 0" class="btn btn-secondary" @click="resetFilters">恢复默认筛选</button>
      </div>
    </div>

    <div v-else class="groups">
      <p class="summary">共 {{ filteredGroups.length }} 个开票方，可换开金额合计 ¥{{ totalAmount }}</p>
      <InvoiceGroupCard
        v-for="(group, index) in filteredGroups"
        :key="`${group.orgName}-${index}-${group.orders.length}`"
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
import { computed, onMounted, reactive, ref, watch } from 'vue'
import InvoiceGroupCard from '@/components/InvoiceGroupCard.vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import ExchangeConfirmDialog from '@/components/ExchangeConfirmDialog.vue'
import { useAppStore } from '@/stores/app'
import type { MergeFilters, MergeGroup, MergeOrder } from '@/types'
import { DEFAULT_MERGE_FILTERS, filterMergeGroups, getMergeOrderTitle } from '@/utils/mergeOrder'

const store = useAppStore()

const showFilters = ref(false)
const showConfirmDialog = ref(false)
const confirmGroup = ref<MergeGroup | null>(null)
const confirmOrders = ref<MergeOrder[]>([])
const filters = reactive<MergeFilters>({ ...DEFAULT_MERGE_FILTERS })

onMounted(() => {
  void store.loadTitles()
})

const allOrders = computed(() => store.mergeGroups.flatMap((group) => group.orders))

const titleOptions = computed(() => {
  const titles = new Set<string>()
  allOrders.value.forEach((order) => {
    const title = getMergeOrderTitle(order)
    if (title) {
      titles.add(title)
    }
  })
  return Array.from(titles)
})

const filteredGroups = computed(() => filterMergeGroups(store.mergeGroups, filters))

const totalAmount = computed(() => {
  return filteredGroups.value.reduce((sum: number, group: MergeGroup) => sum + group.total, 0).toFixed(2)
})

watch(titleOptions, (nextTitles) => {
  filters.ivcTitles = filters.ivcTitles.filter((title) => nextTitles.includes(title))
})

async function loadGroups() {
  await store.loadMergeGroups()
}

function resetFilters() {
  Object.assign(filters, DEFAULT_MERGE_FILTERS)
}

function handleExchange(group: MergeGroup, orders: MergeOrder[]) {
  confirmGroup.value = group
  confirmOrders.value = orders
  showConfirmDialog.value = true
}

async function handleConfirmExchange(titleId: string) {
  const title = store.titles.find((item) => item.id === titleId)
  if (!title) {
    alert('请选择发票抬头')
    return
  }

  alert('暂不支持换开发票')
}
</script>

<style scoped>
.exchange-view {
  display: grid;
  gap: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h2 {
  font-size: 20px;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 10px;
}

.filter-panel {
  margin-bottom: 0;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.field {
  display: grid;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  color: #666;
}

.multi-select {
  min-height: 112px;
}

.filter-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #f0f0f0;
}

.filter-tip {
  font-size: 13px;
  color: #666;
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

.empty-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
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

@media (max-width: 640px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .actions,
  .filter-actions,
  .empty-actions {
    flex-direction: column;
  }

  .actions .btn,
  .filter-actions .btn,
  .empty-actions .btn {
    width: 100%;
  }

  .filter-actions {
    align-items: stretch;
  }
}
</style>
