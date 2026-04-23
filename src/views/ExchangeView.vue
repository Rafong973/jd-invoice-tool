<template>
  <div class="exchange-view">
    <div class="page-header">
      <div class="header-main">
        <h2>换开发票</h2>
        <div class="mode-switch">
          <button
            class="mode-btn"
            :class="{ active: mode === 'original' }"
            @click="mode = 'original'"
          >
            原始分组
          </button>
          <button
            class="mode-btn"
            :class="{ active: mode === 'smart' }"
            @click="mode = 'smart'"
          >
            智能凑单
          </button>
        </div>
      </div>
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
        <div class="filter-buttons">
          <button class="btn btn-secondary" @click="applyCommonFilters">常见筛选</button>
          <button class="btn btn-secondary" @click="resetFilters">恢复默认筛选</button>
        </div>
      </div>
    </div>

    <div v-if="store.error" class="error-msg">
      {{ store.error }}
    </div>

    <div v-if="unresolvedAmountCount > 0" class="warning-msg">
      当前有 {{ unresolvedAmountCount }} 张订单金额未校准，仍在使用换开页原始金额兜底。请打开控制台查看未匹配的 orderId。
    </div>

    <div v-if="!store.hasFetchedMergeGroups && !store.loading" class="empty">
      <p>点击按钮获取可换开的发票分组</p>
      <button class="btn btn-primary" @click="loadGroups">开始获取</button>
    </div>

    <div v-else-if="displayGroups.length === 0 && store.hasFetchedMergeGroups && !store.loading" class="empty">
      <p>{{ emptyMessage }}</p>
      <div class="empty-actions">
        <button class="btn btn-primary" @click="loadGroups">重新获取</button>
        <button v-if="store.mergeGroups.length > 0" class="btn btn-secondary" @click="resetFilters">恢复默认筛选</button>
      </div>
    </div>

    <div v-else class="groups">
      <p class="summary">{{ summaryText }}</p>
      <InvoiceGroupCard
        v-for="(group, index) in displayGroups"
        :key="`${group.kind}-${group.sourceOrgName}-${group.comboIndex ?? index}-${group.orders.length}`"
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
      :submitting="submittingExchange"
      @close="showConfirmDialog = false"
      @confirm="handleConfirmExchange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { submitMergeExchange } from '@/api'
import InvoiceGroupCard from '@/components/InvoiceGroupCard.vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import ExchangeConfirmDialog from '@/components/ExchangeConfirmDialog.vue'
import { useAppStore } from '@/stores/app'
import type { DisplayMergeGroup, ExchangeMode, MergeFilters, MergeOrder } from '@/types'
import {
  buildOriginalDisplayGroups,
  buildSmartMergeGroups,
  DEFAULT_MERGE_FILTERS,
  filterMergeGroups,
  getMergeOrderTitle,
  isMergeOrderAmountResolved,
} from '@/utils/mergeOrder'

const store = useAppStore()

const mode = ref<ExchangeMode>('original')
const showFilters = ref(false)
const showConfirmDialog = ref(false)
const submittingExchange = ref(false)
const confirmGroup = ref<DisplayMergeGroup | null>(null)
const confirmOrders = ref<MergeOrder[]>([])
const filters = reactive<MergeFilters>({ ...DEFAULT_MERGE_FILTERS })
const originalModeFilters = ref<MergeFilters>({ ...DEFAULT_MERGE_FILTERS })
const smartModeFilters = ref<MergeFilters>({ ...DEFAULT_MERGE_FILTERS, amountMax: '99.99' })
const smartFiltersInitialized = ref(false)

onMounted(() => {
  void store.loadTitles()
})

const allOrders = computed(() => store.mergeGroups.flatMap((group) => group.orders))
const unresolvedAmountCount = computed(() => allOrders.value.filter((order) => !isMergeOrderAmountResolved(order)).length)

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

function getSmartDefaultFilters(): MergeFilters {
  return {
    ...DEFAULT_MERGE_FILTERS,
    amountMax: '99.99',
    ivcTitles: titleOptions.value.filter((title) => !title.includes('公司')),
  }
}

const filteredGroups = computed(() => filterMergeGroups(store.mergeGroups, filters))
const originalDisplayGroups = computed(() => buildOriginalDisplayGroups(filteredGroups.value))
const smartDisplayGroups = computed(() => buildSmartMergeGroups(filteredGroups.value))

const displayGroups = computed(() => {
  return mode.value === 'smart' ? smartDisplayGroups.value : originalDisplayGroups.value
})

const totalAmount = computed(() => {
  return displayGroups.value.reduce((sum, group) => sum + group.total, 0).toFixed(2)
})

const summaryText = computed(() => {
  if (mode.value === 'smart') {
    return `共 ${displayGroups.value.length} 个推荐组合，可换开金额合计 ¥${totalAmount.value}`
  }
  return `共 ${displayGroups.value.length} 个开票方，可换开金额合计 ¥${totalAmount.value}`
})

const emptyMessage = computed(() => {
  if (store.mergeGroups.length === 0) {
    return '暂无可换开的发票数据'
  }
  if (mode.value === 'smart') {
    return filteredGroups.value.length === 0 ? '当前筛选条件下暂无可换开的发票' : '当前筛选条件下暂无可推荐的凑单组合'
  }
  return '当前筛选条件下暂无可换开的发票'
})

watch(titleOptions, (nextTitles) => {
  originalModeFilters.value = {
    ...originalModeFilters.value,
    ivcTitles: originalModeFilters.value.ivcTitles.filter((title) => nextTitles.includes(title)),
  }
  smartModeFilters.value = smartFiltersInitialized.value
    ? {
        ...smartModeFilters.value,
        ivcTitles: smartModeFilters.value.ivcTitles.filter((title) => nextTitles.includes(title)),
      }
    : getSmartDefaultFilters()
  smartFiltersInitialized.value = true
  filters.ivcTitles = filters.ivcTitles.filter((title) => nextTitles.includes(title))
}, { immediate: true })

watch(filters, (nextFilters) => {
  const snapshot = {
    amountMin: nextFilters.amountMin,
    amountMax: nextFilters.amountMax,
    dateStart: nextFilters.dateStart,
    dateEnd: nextFilters.dateEnd,
    ivcTitles: [...nextFilters.ivcTitles],
  }

  if (mode.value === 'smart') {
    smartModeFilters.value = snapshot
    return
  }

  originalModeFilters.value = snapshot
}, { deep: true })

watch(mode, (nextMode) => {
  const nextFilters = nextMode === 'smart' ? smartModeFilters.value : originalModeFilters.value
  Object.assign(filters, {
    ...nextFilters,
    ivcTitles: [...nextFilters.ivcTitles],
  })
}, { immediate: true })

async function loadGroups() {
  await store.loadMergeGroups()
}

function resetFilters() {
  const nextFilters = mode.value === 'smart' ? getSmartDefaultFilters() : { ...DEFAULT_MERGE_FILTERS }
  Object.assign(filters, nextFilters)
}

function applyCommonFilters() {
  const currentYear = new Date().getFullYear()
  Object.assign(filters, {
    ...DEFAULT_MERGE_FILTERS,
    amountMin: '100.01',
    dateEnd: `${currentYear}-02-05`,
    ivcTitles: titleOptions.value.filter((title) => !title.includes('公司')),
  })
}

function handleExchange(group: DisplayMergeGroup, orders: MergeOrder[]) {
  confirmGroup.value = group
  confirmOrders.value = orders
  showConfirmDialog.value = true
}

async function handleConfirmExchange(titleId: string) {
  if (submittingExchange.value) {
    return
  }

  const title = store.titles.find((item) => item.id === titleId)
  if (!title) {
    alert('请选择发票抬头')
    return
  }

  submittingExchange.value = true

  try {
    const result = await submitMergeExchange(confirmOrders.value, {
      titleType: title.titleType,
      titleName: title.titleName,
      email: title.email,
      taxNo: title.taxNo,
    })

    showConfirmDialog.value = false
    store.removeMergedOrders(confirmOrders.value)
    alert(result.message)
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error))
  } finally {
    submittingExchange.value = false
  }
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
  align-items: flex-start;
  gap: 16px;
}

.header-main {
  display: grid;
  gap: 12px;
}

.page-header h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border-radius: 999px;
  background: #f4f4f4;
}

.mode-btn {
  border: none;
  background: transparent;
  color: #666;
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}

.mode-btn.active {
  background: #e2231a;
  color: #fff;
  box-shadow: 0 4px 10px rgba(226, 35, 26, 0.2);
}

.actions {
  display: flex;
  gap: 10px;
}

.filter-panel {
  margin-bottom: 0;
}

.warning-msg {
  padding: 12px 14px;
  border-radius: 10px;
  background: #fff8e6;
  color: #9a6700;
  border: 1px solid #f0d79f;
  font-size: 14px;
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

.filter-buttons {
  display: flex;
  gap: 10px;
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

@media (max-width: 720px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .actions,
  .filter-actions,
  .empty-actions,
  .filter-buttons {
    flex-direction: column;
  }

  .actions .btn,
  .filter-buttons .btn,
  .filter-actions .btn,
  .empty-actions .btn {
    width: 100%;
  }

  .filter-actions {
    align-items: stretch;
  }
}
</style>
