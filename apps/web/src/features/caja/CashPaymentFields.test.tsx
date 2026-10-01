import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CashPaymentFields } from './CashPaymentFields'

afterEach(cleanup)

it('captura efectivo exacto con centavos y reemplaza el importe al elegir un billete', () => {
  const onChange = vi.fn()
  const { rerender } = render(
    <CashPaymentFields
      total={33.8}
      value=""
      change={null}
      onChange={onChange}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Exacto' }))
  expect(onChange).toHaveBeenLastCalledWith('33.80')
  fireEvent.click(screen.getByRole('button', { name: 'Recibí $50.00' }))
  expect(onChange).toHaveBeenLastCalledWith('50.00')
  expect(screen.queryByRole('button', { name: 'Recibí $20.00' })).toBeNull()
  rerender(
    <CashPaymentFields
      total={51.2}
      value="50"
      change={-1.2}
      onChange={onChange}
    />,
  )
  expect(screen.getByRole('status')).toHaveTextContent('Falta $1.20')
  fireEvent.click(screen.getByRole('button', { name: 'Exacto' }))
  expect(onChange).toHaveBeenLastCalledWith('51.20')
})

it('muestra el cambio exacto sin redondearlo a pesos', () => {
  render(
    <CashPaymentFields
      total={49.6}
      value="50"
      change={0.4}
      onChange={vi.fn()}
    />,
  )
  expect(screen.getByRole('status')).toHaveTextContent('Cambio: $0.40')
})

it('ofrece importes cercanos y explica por qué falta efectivo', () => {
  const onChange = vi.fn()
  render(
    <CashPaymentFields
      total={224}
      value=""
      change={-224}
      onChange={onChange}
    />,
  )
  expect(screen.getByRole('status')).toHaveTextContent(
    'Ingresa el efectivo recibido para cobrar.',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Recibí $250.00' }))
  expect(onChange).toHaveBeenLastCalledWith('250.00')
  expect(
    screen.getByRole('button', { name: 'Recibí $300.00' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Recibí $500.00' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Recibí $1,000.00' })).toBeNull()
})
