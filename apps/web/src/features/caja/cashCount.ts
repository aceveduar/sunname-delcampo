// Values in centavos keep denomination sums exact, including coins.
export const CASH_DENOMINATIONS = [
  { id: 'bill1000', kind: 'bill', cents: 100000 },
  { id: 'bill500', kind: 'bill', cents: 50000 },
  { id: 'bill200', kind: 'bill', cents: 20000 },
  { id: 'bill100', kind: 'bill', cents: 10000 },
  { id: 'bill50', kind: 'bill', cents: 5000 },
  { id: 'bill20', kind: 'bill', cents: 2000 },
  { id: 'coin20', kind: 'coin', cents: 2000 },
  { id: 'coin10', kind: 'coin', cents: 1000 },
  { id: 'coin5', kind: 'coin', cents: 500 },
  { id: 'coin2', kind: 'coin', cents: 200 },
  { id: 'coin1', kind: 'coin', cents: 100 },
  { id: 'coin50c', kind: 'coin', cents: 50 },
  { id: 'coin20c', kind: 'coin', cents: 20 },
  { id: 'coin10c', kind: 'coin', cents: 10 },
] as const
export type CashCounts = Partial<
  Record<(typeof CASH_DENOMINATIONS)[number]['id'], string>
>
export function validCashCount(value: string) {
  return value === '' || (/^\d+$/.test(value) && Number(value) <= 999999)
}
export function cashCountTotal(counts: CashCounts): number | null {
  let cents = 0
  for (const denomination of CASH_DENOMINATIONS) {
    const value = counts[denomination.id] ?? ''
    if (!validCashCount(value)) return null
    cents += Number(value) * denomination.cents
  }
  return Number.isSafeInteger(cents) && cents < 1000000000000 ? cents : null
}
