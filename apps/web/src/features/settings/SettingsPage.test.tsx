import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'
import { useTenantModules } from './useTenantModules'

const { read, write } = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }))
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      let values: unknown
      let key: string | number
      const query = {
        select: () => query,
        update: (next: unknown) => {
          values = next
          return query
        },
        eq: (_column: string, value: string | number) => {
          key = value
          return query
        },
        single: () => (values ? write(table, values, key) : read(table)),
        then: (
          resolve: (value: unknown) => void,
          reject: (cause: unknown) => void,
        ) => read(table).then(resolve, reject),
      }
      return query
    },
  },
}))

const fiscal = {
  rfc: 'AAA010101AAA',
  legal_name: 'Empresa de prueba',
  regimen_fiscal: '601',
  postal_code: '76000',
}
const modules = ['crm', 'purchasing', 'billing'].map((module_key) => ({
  module_key,
  enabled: true,
}))
function response(table: string) {
  return {
    data:
      table === 'tenant_modules'
        ? modules
        : table === 'tenant_settings'
          ? { business_name: 'Del Campo' }
          : fiscal,
    error: null,
  }
}
function Harness() {
  const tenantModules = useTenantModules()
  return (
    <>
      <nav>
        {tenantModules.isEnabled('crm') && <a href="/clientes">Clientes</a>}
      </nav>
      <SettingsPage tenantModules={tenantModules} />
    </>
  )
}
beforeEach(() => {
  read
    .mockReset()
    .mockImplementation((table) => Promise.resolve(response(table)))
  write
    .mockReset()
    .mockImplementation((_table, values, key) =>
      Promise.resolve({ data: { ...values, module_key: key }, error: null }),
    )
})
afterEach(cleanup)

describe('Configuración segura', () => {
  it('un fallo de lectura fiscal no muestra campos vacíos editables; reintentar recupera los datos', async () => {
    let failed = true
    read.mockImplementation((table) =>
      Promise.resolve(
        table === 'tenant_fiscal_settings' && failed
          ? { data: null, error: new Error('503') }
          : response(table),
      ),
    )
    render(<Harness />)
    await screen.findByText('No se pudieron cargar los datos fiscales')
    expect(screen.queryByLabelText('RFC')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Guardar datos fiscales' }),
    ).not.toBeInTheDocument()
    expect(write).not.toHaveBeenCalled()
    failed = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByLabelText('RFC')).toHaveValue(fiscal.rfc)
  })

  it('conserva la captura tras un guardado rechazado y evita dos envíos simultáneos', async () => {
    let finish!: (result: unknown) => void
    write.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    render(<Harness />)
    const input = await screen.findByLabelText('Razón social')
    fireEvent.change(input, { target: { value: 'Nuevo nombre fiscal' } })
    const form = input.closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(write).toHaveBeenCalledTimes(1)
    expect(input).toBeDisabled()
    expect(screen.getByLabelText('Régimen fiscal')).toBeDisabled()
    await act(async () => {
      finish({ data: null, error: new Error('Sin conexión') })
    })
    expect(input).toHaveValue('Nuevo nombre fiscal')
    expect(input).toBeEnabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Tu captura sigue aquí')
    fireEvent.submit(form)
    await waitFor(() => expect(write).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText('Razón social')).toBe(input)
    expect(write).toHaveBeenLastCalledWith(
      'tenant_fiscal_settings',
      expect.objectContaining({ legal_name: 'Nuevo nombre fiscal' }),
      1,
    )
  })

  it('el módulo actualiza el menú sin desmontar el borrador; un fallo conserva el estado previo', async () => {
    let finish!: (result: unknown) => void
    write.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    render(<Harness />)
    const name = await screen.findByLabelText('Nombre del negocio')
    fireEvent.change(name, { target: { value: 'Nombre pendiente' } })
    const crm = screen.getByRole('switch', { name: 'Clientes (CRM)' })
    await waitFor(() => expect(crm).toBeChecked())
    fireEvent.click(crm)
    expect(crm).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('link', { name: 'Clientes' })).toBeInTheDocument()
    await act(async () => {
      finish({ data: { module_key: 'crm', enabled: false }, error: null })
    })
    expect(
      screen.queryByRole('link', { name: 'Clientes' }),
    ).not.toBeInTheDocument()
    expect(name).toHaveValue('Nombre pendiente')
    expect(screen.getByLabelText('Nombre del negocio')).toBe(name)
    write.mockResolvedValueOnce({ data: null, error: new Error('503') })
    fireEvent.click(crm)
    await screen.findByText('No se guardó el cambio. Inténtalo de nuevo.')
    expect(crm).not.toBeChecked()
    expect(crm).not.toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.queryByRole('link', { name: 'Clientes' }),
    ).not.toBeInTheDocument()
  })

  it('no habilita el nombre del negocio si falla la carga ni deja el guardado bloqueado tras una excepción', async () => {
    let failed = true
    read.mockImplementation((table) =>
      Promise.resolve(
        table === 'tenant_settings' && failed
          ? { data: null, error: new Error('503') }
          : response(table),
      ),
    )
    render(<Harness />)
    await screen.findByText('No se pudo cargar la configuración del negocio')
    expect(
      screen.queryByLabelText('Nombre del negocio'),
    ).not.toBeInTheDocument()
    failed = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    const name = await screen.findByLabelText('Nombre del negocio')
    write.mockRejectedValueOnce(new Error('Network failure'))
    fireEvent.change(name, { target: { value: 'Mi negocio' } })
    fireEvent.submit(name.closest('form')!)
    await screen.findByRole('alert')
    expect(name).toBeEnabled()
    expect(name).toHaveValue('Mi negocio')
    fireEvent.submit(name.closest('form')!)
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
  })
})
