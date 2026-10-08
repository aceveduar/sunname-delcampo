export type ReportRange = { from: string; to: string }
export type PaymentBreakdown = { id: string; name: string; amount: number }
export type TopProduct = {
  id: string
  name: string
  quantity: number
  unit: string
  amount: number
}
export type DailySales = { date: string; amount: number; count: number }
export type CashSessionRow = {
  id: string
  openedBy: string
  openedAt: string
  closedAt: string
  openingAmount: number
  closingAmount: number
  cashSales: number
  cashIn: number
  cashOut: number
  expectedClosing: number
  notes: string | null
  difference: number
}
export type SalesReport = ReportRange & {
  totalAmount: number
  totalCost: number
  missingCostCount: number
  saleCount: number
  byPaymentMethod: PaymentBreakdown[]
  topProducts: TopProduct[]
  dailySales: DailySales[]
  cashSessions: CashSessionRow[]
}
