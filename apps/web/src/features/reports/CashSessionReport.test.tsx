import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { CashSessionReport } from './CashSessionReport'
import type { CashSessionRow } from './useSalesReport'

afterEach(cleanup)
const base: CashSessionRow = {
  id: 'one',
  openedBy: 'Ana',
  openedAt: '2026-09-29T15:00:00Z',
  closedAt: '2026-09-30T02:00:00Z',
  openingAmount: 100,
  cashSales: 200,
  cashIn: 50,
  cashOut: 20,
  expectedClosing: 330,
  closingAmount: 330,
  difference: 0,
  notes: null,
}
it('mantiene faltantes y sobrantes visibles aunque se compensen entre sí', () => {
  render(
    <CashSessionReport
      sessions={[
        base,
        {
          ...base,
          id: 'two',
          openedBy: 'Beto',
          closingAmount: 320,
          difference: -10,
          notes: 'Revisar cambio',
        },
        {
          ...base,
          id: 'three',
          openedBy: 'Clara',
          closingAmount: 340,
          difference: 10,
        },
      ]}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Con diferencia (2)' }))
  expect(screen.queryByRole('heading', { name: 'Ana' })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Beto' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Clara' })).toBeInTheDocument()
  expect(screen.getByText('Faltante')).toBeInTheDocument()
  expect(screen.getByText('Sobrante')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Todos (3)' }))
  expect(screen.getByRole('heading', { name: 'Ana' })).toBeInTheDocument()
})
