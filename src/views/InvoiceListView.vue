<template>
  <div class="invoice-list" ref="scrollContainer" @scroll="onScroll">
    <div class="page-header">
      <h2>发票列表</h2>
      <div class="actions">
        <button class="btn btn-primary" :disabled="store.loading" @click="refresh">
          {{ store.loading ? "加载中..." : "刷新" }}
        </button>
      </div>
    </div>

    <div v-if="store.error" class="error-msg">
      {{ store.error }}
    </div>

    <div v-if="store.invoices.length === 0 && !store.loading" class="empty">
      <p>暂无发票数据</p>
      <button class="btn btn-primary" @click="refresh">获取发票</button>
    </div>

    <div v-else class="list">
      <template v-for="invoice in store.invoices" :key="invoice.orderId">
        <InvoiceCard :invoice="invoice" @download="handleDownload" />
      </template>
    </div>

    <div v-if="store.invoices.length > 0" class="load-more">
      <div v-if="store.loadingMore" class="loading-text">加载中...</div>
      <div v-else-if="!store.invoiceHasMore" class="loading-text">没有更多了</div>
    </div>

    <LoadingOverlay :visible="store.loading" text="正在获取发票数据..." />
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from "vue"
  import { useAppStore } from "@/stores/app"
  import { fetchInvoiceDetail, downloadInvoice } from "@/api"
  import type { InvoiceItem } from "@/types"
  import InvoiceCard from "@/components/InvoiceCard.vue"
  import LoadingOverlay from "@/components/LoadingOverlay.vue"

  const store = useAppStore()
  const scrollContainer = ref<HTMLElement | null>(null)

  onMounted(() => {
    if (store.isLoggedIn && store.invoices.length === 0) {
      store.loadInvoices()
    }
  })

  function onScroll() {
    const el = scrollContainer.value
    if (!el || store.loadingMore || !store.invoiceHasMore || store.loading) return

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200
    if (isNearBottom) {
      store.loadMoreInvoices()
    }
  }

  async function refresh() {
    await store.loadInvoices()
  }

  async function handleDownload(invoice: InvoiceItem) {
    try {
      const files = await fetchInvoiceDetail(invoice.orderId)
      if (files.length > 0) {
        const fileUrl = files[0].fileUrl
        const filename = `invoice_${invoice.orderId}.pdf`
        const path = await downloadInvoice(fileUrl, filename)
        alert(`发票已下载到: ${path}`)
      } else {
        alert("未找到发票文件")
      }
    } catch (e: unknown) {
      alert(`下载失败: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
</script>

<style scoped>
  .invoice-list {
    height: calc(100vh - 96px);
    overflow-y: auto;
    padding: 0 20px 20px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    position: sticky;
    top: 0;
    background: #f5f5f5;
    padding: 10px 0;
    z-index: 1;
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

  .list {
    display: grid;
    gap: 12px;
  }

  .load-more {
    padding: 20px 0;
    text-align: center;
  }

  .loading-text {
    color: #999;
    font-size: 13px;
  }
</style>
