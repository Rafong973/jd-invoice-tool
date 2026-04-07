export interface InvoiceItem {
  orderId: string
  ivcTitle: string
  ivcStatus: string
  ivcType: string
  ivcContentName: string
  amount: string
  canHk: boolean
  isJd: boolean
  venderName: string
  products: Record<string, unknown>[]
  raw: Record<string, unknown>
}

export interface InvoiceFile {
  ivcNo: string
  amount: string
  invoiceDate: string
  fileUrl: string
}

export interface MergeGroup {
  orgName: string
  total: number
  orders: Record<string, unknown>[]
}

export interface AppState {
  isLoggedIn: boolean
  cookie: string | null
  invoices: InvoiceItem[]
  mergeGroups: MergeGroup[]
  loading: boolean
  error: string | null
}
