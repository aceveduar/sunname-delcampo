import { expect, it } from 'vitest'
import { navigationItems } from './navigation'
it('limita Inicio y administración al rol y respeta módulos desactivados', () => {
  expect(
    navigationItems(false, false, () => false).map((item) => item.to),
  ).toEqual(['/caja', '/catalogo', '/inventario'])
  const admin = navigationItems(true, false, (key) => key === 'crm').map(
    (item) => item.to,
  )
  expect(admin).toContain('/inicio')
  expect(admin).toContain('/reportes')
  expect(admin).toContain('/clientes')
  expect(admin).not.toContain('/compras')
  expect(admin).not.toContain('/configuracion')
  expect(
    navigationItems(true, true, () => true).map((item) => item.to),
  ).toContain('/configuracion')
})
