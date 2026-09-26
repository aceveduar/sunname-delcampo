import { supabase } from '@/lib/supabase'

export type CashBalance = {
  openingAmount: number
  cashSales: number
  cashIn: number
  cashOut: number
  expectedAmount: number
}
export const cashDifference = (counted: number, expected: number) =>
  Math.round(counted * 100) - Math.round(expected * 100)

export async function fetchCashBalance(
  sessionId: string,
): Promise<CashBalance> {
  const { data, error } = await supabase
    .from('cash_session_balances')
    .select('opening_amount, cash_sales, cash_in, cash_out, expected_amount')
    .eq('id', sessionId)
    .single()
  if (error) throw error
  if (
    data.expected_amount === null ||
    data.opening_amount === null ||
    data.cash_sales === null ||
    data.cash_in === null ||
    data.cash_out === null
  )
    throw new Error('No se pudo calcular el efectivo esperado')
  return {
    openingAmount: data.opening_amount,
    cashSales: data.cash_sales,
    cashIn: data.cash_in,
    cashOut: data.cash_out,
    expectedAmount: data.expected_amount,
  }
}
