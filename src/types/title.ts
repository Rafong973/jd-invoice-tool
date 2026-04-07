export interface InvoiceTitle {
  id: string
  titleType: 'personal' | 'company'
  titleName: string
  email: string
  taxNo: string
  isDefault: boolean
}
