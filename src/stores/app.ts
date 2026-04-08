import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getCookie, saveCookie, deleteCookie, fetchInvoices, fetchBatchOrders, checkMerge, getTitles, saveTitles } from '@/api'
import type { InvoiceItem, MergeGroup } from '@/types'
import type { InvoiceTitle } from '@/types/title'

export const useAppStore = defineStore('app', () => {
  const isLoggedIn = ref(false)
  const cookie = ref<string | null>(null)
  const invoices = ref<InvoiceItem[]>([])
  const mergeGroups = ref<MergeGroup[]>([])
  const hasFetchedMergeGroups = ref(false)
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref<string | null>(null)
  const invoicePage = ref(1)
  const invoiceHasMore = ref(true)
  const invoiceSeen = ref<Set<string>>(new Set())
  const titles = ref<InvoiceTitle[]>([])

  async function initCookie() {
    const saved = await getCookie()
    if (saved) {
      cookie.value = saved
      isLoggedIn.value = true
    }
  }

  async function setCookie(newCookie: string) {
    await saveCookie(newCookie)
    cookie.value = newCookie
    isLoggedIn.value = true
  }

  async function logout() {
    await clearCookie()
  }

  async function loadTitles() {
    try {
      titles.value = await getTitles()
    } catch (e) {
      console.error('Failed to load titles:', e)
      titles.value = []
    }
  }

  async function saveTitlesData(newTitles: InvoiceTitle[]) {
    titles.value = newTitles
    await saveTitles(JSON.stringify(newTitles))
  }

  async function clearCookie() {
    await deleteCookie()
    cookie.value = null
    isLoggedIn.value = false
    invoices.value = []
    mergeGroups.value = []
    invoicePage.value = 1
    invoiceHasMore.value = true
    invoiceSeen.value = new Set()
  }

  async function loadInvoices() {
    loading.value = true
    loadingMore.value = false
    error.value = null
    invoicePage.value = 1
    invoiceHasMore.value = true
    invoiceSeen.value = new Set()
    invoices.value = []

    try {
      await loadNextPage()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function loadMoreInvoices() {
    if (loadingMore.value || !invoiceHasMore.value || loading.value) return
    loadingMore.value = true
    error.value = null

    try {
      await loadNextPage()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loadingMore.value = false
    }
  }

  async function loadNextPage() {
    console.log(`[DEBUG] loadNextPage page=${invoicePage.value}`)
    const pageResults = await fetchInvoices(invoicePage.value)
    console.log(`[DEBUG] loadNextPage got ${pageResults.length} items`)

    if (pageResults.length === 0) {
      invoiceHasMore.value = false
      return
    }

    for (const item of pageResults) {
      invoices.value.push(item)
    }

    console.log(`[DEBUG] loadNextPage total invoices=${invoices.value.length}`)

    invoicePage.value++
  }

  async function loadMergeGroups() {
    loading.value = true
    error.value = null
    try {
      console.log('[DEBUG] fetchBatchOrders start')
      const orders = await fetchBatchOrders()
      console.log('[DEBUG] fetchBatchOrders result count:', orders.length)
      console.log('[DEBUG] fetchBatchOrders sample:', JSON.stringify(orders.slice(0, 2)))

      if (orders.length === 0) {
        mergeGroups.value = []
        hasFetchedMergeGroups.value = true
        return
      }

      const BATCH_SIZE = 40
      const allGroups: MergeGroup[] = []

      for (let i = 0; i < orders.length; i += BATCH_SIZE) {
        const batch = orders.slice(i, i + BATCH_SIZE)
        const orderListJson = encodeURIComponent(JSON.stringify(batch))
        console.log(`[DEBUG] checkMerge batch ${i / BATCH_SIZE + 1}, orders: ${batch.length}`)
        const groups = await checkMerge(orderListJson)
        console.log(`[DEBUG] checkMerge result count:`, groups.length, JSON.stringify(groups.slice(0, 2)))
        allGroups.push(...groups)

        await new Promise((r) => setTimeout(r, 800))
      }

      console.log('[DEBUG] allGroups total:', allGroups.length)
      mergeGroups.value = allGroups
      hasFetchedMergeGroups.value = true
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      console.error('[DEBUG] loadMergeGroups error:', error.value)
      hasFetchedMergeGroups.value = true
    } finally {
      loading.value = false
    }
  }

  return {
    isLoggedIn,
    cookie,
    invoices,
    mergeGroups,
    hasFetchedMergeGroups,
    loading,
    loadingMore,
    invoiceHasMore,
    error,
    initCookie,
    setCookie,
    logout,
    clearCookie,
    loadInvoices,
    loadMoreInvoices,
    loadMergeGroups,
    titles,
    loadTitles,
    saveTitlesData,
  }
})
