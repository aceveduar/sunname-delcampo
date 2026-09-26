import { supabase } from '@/lib/supabase'

export type CashBalance = {
  openingAmount: number
  cashSales: number
  expectedAmount: number
}
export const cashDifference = (counted: number, expected: number) =>
  Math.round(counted * 100) - Math.round(expected * 100)

export async function fetchCashBalance(
  sessionId: string,
): Promise<CashBalance> {
  const { data, error } = await supabase
    .from('cash_session_balances')
    .select('opening_amount, cash_sales, expected_amount')
    .eq('id', sessionId)
    .single()
  if (error) throw error
  if (
    data.expected_amount === null ||
    data.opening_amount === null ||
    data.cash_sales === null
  )
    throw new Error('No se pudo calcular el efectivo esperado')
  return {
    openingAmount: data.opening_amount,
    cashSales: data.cash_sales,
    expectedAmount: data.expected_amount,
  }
}
