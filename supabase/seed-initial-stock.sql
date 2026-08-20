-- Existencia inicial para los 5 productos reales de Del Campo, para
-- poder probar el flujo completo de venta a granel (Inventario parte
-- de cero porque nunca hubo una entrada real registrada). Cantidad
-- puesta como referencia razonable -- el dueño debe ajustarla a su
-- conteo físico real cuando abra operación.

insert into inventory_movements (product_id, type, quantity, notes, created_by)
select id, 'in', 5.000, 'Existencia inicial (ajustar a conteo físico real)',
  'efde879b-a8c5-494a-a0b3-041d97992fa7'
from products
where sku in ('AJO', 'CAC', 'COM', 'TAP', 'GUA');
