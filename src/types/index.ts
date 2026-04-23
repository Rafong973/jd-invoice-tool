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
  orgId?: string | number
  orderTime?: string
  ivcTime?: string
  ivcCompany?: string
  ivcTitle?: string
  amountResolved?: boolean
  resolvedAmount?: string | number | null
  orderAmountQuery?: string
  originalOrderInfo?: unknown
  ivcAmount?: string | number | null
  totalAmount?: string | number | null
  detailList?: Record<string, unknown>[]
  [key: string]: unknown
}

export interface BatchOrderSeed {
  orderId: string
  orderAmountQuery: string
  resolvedAmount?: string | null
  originalOrderInfo: unknown
}

export interface MergeExchangeTitleInput {
  titleType: 'personal' | 'company'
  titleName: string
  email: string
  taxNo: string
}

export interface MergeExchangeResult {
  allSuccess: boolean
  message: string
  orderCount: number
  canMergeCount: number
  cannotMergeCount: number
  groupCount: number
}

export interface MergeGroup {
  orgName: string
  total: number
  orders: MergeOrder[]
}

export type MergeGroupKind = 'original' | 'smart'

export type ExchangeMode = 'original' | 'smart'

export interface DisplayMergeGroup extends MergeGroup {
  sourceOrgName: string
  displayName: string
  kind: MergeGroupKind
  comboIndex?: number
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
