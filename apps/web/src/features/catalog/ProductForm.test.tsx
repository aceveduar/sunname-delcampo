import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductForm } from './ProductForm'
import type { Product } from './useProducts'
import type { UnitOfMeasure } from './useUnits'

const { registerMovement } = vi.hoisted(() => ({ registerMovement: vi.fn() }))

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
vi.mock('@/components/BarcodeScannerDialog', () => ({
  BarcodeScannerDialog: () => null,
}))
vi.mock('@/features/inventory/useRegisterMovement', () => ({
  useRegisterMovement: () => registerMovement,
}))

afterEach(() => {
  cleanup()
  registerMovement.mockReset()
})

function props() {
  return {
    product: null as Product | null,
    open: true,
    onOpenChange: vi.fn(),
    categories: [],
    units: [
      {
        id: 'unit-1',
        code: 'PZA',
        name: 'Pieza',
        active: true,
      } as UnitOfMeasure,
    ],
    defaultUnitId: 'unit-1',
    createProduct: vi.fn().mockResolvedValue('new-product'),
    updateProduct: vi.fn().mockResolvedValue(true),
    fetchCost: vi.fn().mockResolvedValue(20),
  }
}

describe('Guardado de productos', () => {
  it('captura los campos y evita envíos duplicados mientras espera al servidor', async () => {
    const input = props()
    let finish!: (value: string) => void
    input.createProduct.mockReturnValue(
      new Promise<string>((resolve) => {
        finish = resolve
      }),
    )
    render(<ProductForm {...input} />)
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Producto de prueba' },
    })
    const form = document.querySelector('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(input.createProduct).toHaveBeenCalledTimes(1)
    expect(input.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Producto De Prueba',
        unit_id: 'unit-1',
      }),
    )
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(input.onOpenChange).not.toHaveBeenCalled()
    await act(async () => {
      finish('new-product')
    })
    expect(input.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('permite reintentar después de un error inesperado', async () => {
    const input = props()
    input.createProduct.mockRejectedValueOnce(new Error('Sin conexión'))
    render(<ProductForm {...input} />)
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Prueba' },
    })
    fireEvent.submit(document.querySelector('form')!)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Crear producto' }),
      ).toBeEnabled(),
    )
    expect(input.onOpenChange).not.toHaveBeenCalled()
    fireEvent.submit(document.querySelector('form')!)
    await waitFor(() => expect(input.onOpenChange).toHaveBeenCalledWith(false))
    expect(input.createProduct).toHaveBeenCalledTimes(2)
  })

  it('no permite sobrescribir el costo cuando falla su carga', async () => {
    const input = props()
    input.product = {
      id: 'existing',
      name: 'Prueba',
      unit_id: 'unit-1',
      price: 30,
    } as Product
    input.fetchCost.mockResolvedValue(null)
    render(<ProductForm {...input} />)
    await screen.findByRole('alert')
    expect(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    ).toBeDisabled()
    fireEvent.submit(document.querySelector('form')!)
    expect(input.updateProduct).not.toHaveBeenCalled()
  })

  it('cierra el alta si el producto se creó pero el movimiento inicial falló', async () => {
    const input = props()
    registerMovement.mockRejectedValueOnce(new Error('Sin conexión'))
    render(<ProductForm {...input} />)
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Prueba' },
    })
    fireEvent.change(screen.getByLabelText(/Existencia inicial/), {
      target: { value: '5' },
    })
    fireEvent.submit(document.querySelector('form')!)
    await waitFor(() => expect(input.onOpenChange).toHaveBeenCalledWith(false))
    expect(input.createProduct).toHaveBeenCalledTimes(1)
    expect(registerMovement).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'new-product', quantity: 5 }),
    )
  })
})

it('conserva la captura al cancelar el descarte y solo cierra tras confirmarlo', async () => {
  const input = props()
  render(<ProductForm {...input} />)
  fireEvent.change(screen.getByLabelText('Nombre'), {
    target: { value: 'Producto nuevo' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(input.onOpenChange).not.toHaveBeenCalled()
  expect(
    screen.getByRole('heading', { name: '¿Descartar cambios del producto?' }),
  ).toBeInTheDocument()
  const dialogs = screen.getAllByRole('dialog')
  fireEvent.click(
    within(dialogs[dialogs.length - 1]).getByRole('button', {
      name: 'Cancelar',
    }),
  )
  await waitFor(() =>
    expect(screen.getByLabelText('Nombre')).toHaveValue('Producto nuevo'),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('heading', {
        name: '¿Descartar cambios del producto?',
      }),
    ).not.toBeInTheDocument(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }))
  expect(input.onOpenChange).toHaveBeenCalledWith(false)
})
