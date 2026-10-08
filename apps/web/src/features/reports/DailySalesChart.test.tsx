import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { DailySalesChart } from './DailySalesChart'
afterEach(cleanup)
it('permite recorrer el periodo y consultar un día sin ventas con teclado', () => {
  render(
    <DailySalesChart
      days={Array.from({ length: 9 }, (_, i) => ({
        date: '2026-10-' + String(i + 1).padStart(2, '0'),
        amount: i === 1 ? 0 : 10,
        count: i === 1 ? 0 : 1,
      }))}
    />,
  )
  expect(
    screen.getByRole('button', { name: 'Ver días siguientes' }),
  ).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Ver días anteriores' }))
  expect(
    screen.getByRole('button', { name: 'Ver días anteriores' }),
  ).toBeDisabled()
  const day = screen.getByRole('button', {
    name: /viernes,? 2 de octubre.*0 tickets/i,
  })
  fireEvent.focus(day)
  expect(day).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('0 tickets completados')).toBeInTheDocument()
})
it('explica un periodo sin ventas sin dibujar importes inexistentes', () => {
  render(
    <DailySalesChart days={[{ date: '2026-10-01', amount: 0, count: 0 }]} />,
  )
  expect(
    screen.getByText('Sin ventas completadas en este periodo.'),
  ).toBeInTheDocument()
})
it('distingue los tickets con total cero de un periodo sin ventas', () => {
  render(
    <DailySalesChart days={[{ date: '2026-10-01', amount: 0, count: 2 }]} />,
  )
  expect(screen.getByText('2 tickets completados')).toBeInTheDocument()
  expect(
    screen.queryByText('Sin ventas completadas en este periodo.'),
  ).not.toBeInTheDocument()
})
