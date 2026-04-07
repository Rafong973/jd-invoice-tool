import { invoke } from '@tauri-apps/api/core'
import type { InvoiceItem, InvoiceFile, MergeGroup } from '@/types'
import type { InvoiceTitle } from '@/types/title'

export async function openBrowser(url: string): Promise<void> {
  await invoke<string>('open_browser', { url })
}

export async function saveCookie(cookie: string): Promise<string> {
  return invoke<string>('save_cookie', { cookie })
}

export async function getCookie(): Promise<string | null> {
  return invoke<string | null>('get_cookie')
}

export async function deleteCookie(): Promise<string> {
  return invoke<string>('delete_cookie')
}

export async function fetchInvoices(page: number): Promise<InvoiceItem[]> {
  const result = await invoke<InvoiceItem[]>('fetch_invoices', { page })
  return result
}

export async function fetchInvoiceDetail(orderId: string): Promise<InvoiceFile[]> {
  return invoke<InvoiceFile[]>('fetch_invoice_detail', { orderId })
}

export async function fetchBatchOrders(): Promise<Record<string, unknown>[]> {
  return invoke<Record<string, unknown>[]>('fetch_batch_orders')
}

export async function checkMerge(orderListJson: string): Promise<MergeGroup[]> {
  return invoke<MergeGroup[]>('check_merge', { orderListJson })
}

export async function downloadInvoice(url: string, filename: string): Promise<string> {
  return invoke<string>('download_invoice', { url, filename })
}

export async function getTitles(): Promise<InvoiceTitle[]> {
  return invoke<InvoiceTitle[]>('get_titles')
}

export async function saveTitles(titlesJson: string): Promise<string> {
  return invoke<string>('save_titles', { titlesJson })
}
