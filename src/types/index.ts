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

export interface MergeOrder {
  orderId?: string
  orderTime?: string
  ivcTime?: string
  ivcCompany?: string
  ivcTitle?: string
  ivcAmount?: string | number | null
  totalAmount?: string | number | null
  detailList?: Record<string, unknown>[]
  [key: string]: unknown
}

export interface MergeGroup {
  orgName: string
  total: number
  orders: MergeOrder[]
}

export interface MergeFilters {
  amountMin: string
  amountMax: string
  dateStart: string
  dateEnd: string
  ivcTitles: string[]
}

export interface AppState {
  isLoggedIn: boolean
  cookie: string | null
  invoices: InvoiceItem[]
  mergeGroups: MergeGroup[]
  loading: boolean
  error: string | null
}
